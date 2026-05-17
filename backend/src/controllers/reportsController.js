const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const reportsRepository = require('../repositories/reportsRepository');
const {
  readReportMarkdown,
  ensureMissingReportsForUser,
} = require('../services/reportGeneratorService');
const { enqueueRemediationJob } = require('../services/remediationQueue');
const {
  buildFollowUpForReport,
  queueReanalysisAfterRemediationPush,
} = require('../services/postRemediationReview');

const appendLogLine = (parts, line) => {
  parts.push(`[${new Date().toISOString()}] ${line}`);
};

const isMissingReportsTable = (error) =>
  error?.code === 'PGRST205' ||
  /analysis_reports/i.test(String(error?.message || '')) ||
  /schema cache/i.test(String(error?.message || ''));

const reportsTableSetupMessage =
  'The analysis_reports table is missing. Run: cd backend && npm run db:migrate:reports';

/**
 * GET /api/reports?page=1&limit=20
 */
const listReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    try {
      await ensureMissingReportsForUser(req.user.id);
    } catch (backfillErr) {
      logger.warn(`listReports backfill skipped: ${backfillErr.message}`);
    }

    const { data, error, count } = await reportsRepository.listReportsForUser({
      userId: req.user.id,
      from,
      to,
    });

    if (error) {
      logger.error('listReports Supabase error', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      if (isMissingReportsTable(error)) {
        throw new AppError(reportsTableSetupMessage, 503);
      }
      throw new AppError(
        process.env.NODE_ENV === 'production' ? 'Failed to fetch reports' : `Failed to fetch reports: ${error.message}`,
        500
      );
    }

    res.json({
      success: true,
      data,
      pagination: { page: Number(page), limit: Number(limit), total: count },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/:id
 */
const getReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: report, error } = await reportsRepository.getReportWithRepo(id);

    if (error) {
      if (isMissingReportsTable(error)) throw new AppError(reportsTableSetupMessage, 503);
      throw new AppError('Report not found', 404);
    }
    if (!report) throw new AppError('Report not found', 404);
    if (report.repositories.user_id !== req.user.id) {
      throw new AppError('Forbidden', 403);
    }

    let followUp = null;
    try {
      followUp = await buildFollowUpForReport(report);
    } catch (followErr) {
      logger.warn(`buildFollowUpForReport: ${followErr.message}`);
    }

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { ...report, followUp } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/:id/markdown
 */
const getReportMarkdown = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: report, error } = await reportsRepository.getReportWithRepo(id);

    if (error) {
      if (isMissingReportsTable(error)) throw new AppError(reportsTableSetupMessage, 503);
      throw new AppError('Report not found', 404);
    }
    if (!report) throw new AppError('Report not found', 404);
    if (report.repositories.user_id !== req.user.id) {
      throw new AppError('Forbidden', 403);
    }

    const markdown = await readReportMarkdown(report.report_path);
    res.json({ success: true, data: { markdown } });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return next(new AppError('Report file not found on disk', 404));
    }
    next(err);
  }
};

/**
 * POST /api/reports/:id/confirm-remediation
 * User explicitly confirms — queues remediation job (never auto-runs on analysis complete).
 */
const confirmRemediation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: report, error } = await reportsRepository.getReportWithRepo(id);

    if (error || !report) throw new AppError('Report not found', 404);
    if (report.repositories.user_id !== req.user.id) {
      throw new AppError('Forbidden', 403);
    }

    if (report.remediation_status === 'pushed') {
      throw new AppError('Fixes were already pushed for this report', 409);
    }
    if (['running', 'validating'].includes(report.remediation_status)) {
      throw new AppError('Remediation is already in progress', 409);
    }

    if (!report.issue_count || report.issue_count === 0) {
      throw new AppError('This report has no issues to remediate', 400);
    }

    await enqueueRemediationJob({
      reportId: id,
      userId: req.user.id,
      repoFullName: report.repositories.full_name,
    });

    res.status(202).json({
      success: true,
      message: 'Remediation queued. Status will update when complete.',
      data: { remediationStatus: 'confirmed' },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reports/:id/rescan-after-fix
 * Queue analysis on the pushed fix commit (for reports remediated before auto re-scan existed).
 */
const rescanAfterFix = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: report, error } = await reportsRepository.getReportWithRepo(id);

    if (error || !report) throw new AppError('Report not found', 404);
    if (report.repositories.user_id !== req.user.id) throw new AppError('Forbidden', 403);
    if (report.remediation_status !== 'pushed' || !report.push_commit_sha) {
      throw new AppError('This report has no pushed remediation commit to re-scan', 400);
    }

    const logParts = [];
    await queueReanalysisAfterRemediationPush({
      reportId: id,
      repositoryId: report.repository_id,
      userId: req.user.id,
      repoFullName: report.repositories.full_name,
      pushCommitSha: report.push_commit_sha,
      branch: report.analyzed_branch,
      logParts,
      appendLog: appendLogLine,
    });

    const followUp = await buildFollowUpForReport(report);

    res.status(202).json({
      success: true,
      message: 'Re-scan queued for the commit with your fixes.',
      data: { followUp },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listReports,
  getReport,
  getReportMarkdown,
  confirmRemediation,
  rescanAfterFix,
};
