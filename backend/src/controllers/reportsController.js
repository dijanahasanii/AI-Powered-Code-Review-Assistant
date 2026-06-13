const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const reportsRepository = require('../repositories/reportsRepository');
const {
  readOrRegenerateReportMarkdown,
  ensureMissingReportsForUser,
} = require('../services/reportGeneratorService');
const { enqueueRemediationJob } = require('../services/remediationQueue');
const {
  isAutoRemediationEnabled,
  AUTO_REMEDIATION_DISABLED_MESSAGE,
} = require('../lib/remediationFeatureFlag');
const { normalizeReportRemediation } = require('../lib/reportRemediationStatus');

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
      data: (data || []).map(normalizeReportRemediation),
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

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: normalizeReportRemediation(report) });
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

    const markdown = await readOrRegenerateReportMarkdown(report);
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

    if (!isAutoRemediationEnabled()) {
      throw new AppError(AUTO_REMEDIATION_DISABLED_MESSAGE, 503);
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

module.exports = {
  listReports,
  getReport,
  getReportMarkdown,
  confirmRemediation,
};
