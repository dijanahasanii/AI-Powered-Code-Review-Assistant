'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const simpleGit = require('simple-git');
const { loadUserAccessToken, fetchRepoDefaultBranch } = require('./githubService');
const reportsRepository = require('../repositories/reportsRepository');
const { loadReviewIssues } = require('./reportGeneratorService');
const { applyFixesToFiles } = require('./targetedFixService');
const { logger } = require('../utils/logger');
const { supabase } = require('../config/database');
const {
  isAutoRemediationEnabled,
  AUTO_REMEDIATION_DISABLED_MESSAGE,
} = require('../lib/remediationFeatureFlag');

const execFileAsync = promisify(execFile);

/** @returns {'strict'|'warn'|'off'} */
function getRemediationValidationMode() {
  const raw = String(process.env.REMEDIATION_VALIDATION || '').trim().toLowerCase();
  if (['off', 'false', '0', 'skip', 'none'].includes(raw)) return 'off';
  if (['warn', 'relaxed', 'optional'].includes(raw)) return 'warn';
  if (['strict', 'true', '1', 'on'].includes(raw)) return 'strict';
  return process.env.NODE_ENV === 'production' ? 'strict' : 'warn';
}

const appendLog = (parts, line) => {
  parts.push(`[${new Date().toISOString()}] ${line}`);
  return parts;
};

async function updateRemediationStatus(reportId, status, extra = {}) {
  await reportsRepository.updateReportById(reportId, {
    remediation_status: status,
    ...extra,
  });
}

async function runValidation(repoDir, logParts) {
  const mode = getRemediationValidationMode();
  if (mode === 'off') {
    appendLog(logParts, 'npm validation disabled (REMEDIATION_VALIDATION=off)');
    return { ok: true, skipped: true };
  }

  const pkgPath = path.join(repoDir, 'package.json');
  try {
    await fs.access(pkgPath);
  } catch {
    appendLog(logParts, 'No package.json — skipping npm validation');
    return { ok: true, skipped: true };
  }

  appendLog(
    logParts,
    mode === 'warn'
      ? 'Validation mode: warn (failures are logged but push may still proceed)'
      : 'Validation mode: strict (push blocked if npm scripts fail)'
  );

  const scripts = ['lint', 'build', 'test'];
  for (const script of scripts) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      if (!pkg.scripts?.[script]) {
        appendLog(logParts, `npm run ${script} not defined — skipped`);
        continue;
      }
      appendLog(logParts, `Running npm run ${script}...`);
      await execFileAsync('npm', ['run', script], {
        cwd: repoDir,
        timeout: 300000,
        shell: process.platform === 'win32',
        maxBuffer: 4 * 1024 * 1024,
      });
      appendLog(logParts, `npm run ${script} passed`);
    } catch (err) {
      const msg = err.stderr?.toString() || err.stdout?.toString() || err.message;
      appendLog(logParts, `Validation failed at npm run ${script}: ${msg.slice(0, 2000)}`);
      if (mode === 'warn') {
        appendLog(
          logParts,
          `Continuing despite ${script} failure (set REMEDIATION_VALIDATION=strict to block push)`
        );
        continue;
      }
      return { ok: false, failedScript: script, message: msg };
    }
  }
  return { ok: true };
}

function appendPushFailureHints(logParts, err) {
  const detail = String(err?.message || err || '');
  appendLog(logParts, `Push failed: ${detail.slice(0, 1500)}`);
  if (/Committer identity unknown|user\.email|user\.name/i.test(detail)) {
    appendLog(
      logParts,
      'Hint: set REMEDIATION_GIT_USER_NAME and REMEDIATION_GIT_USER_EMAIL on the server (or redeploy with the latest fix).'
    );
  }
  if (/403|permission|denied|write access/i.test(detail)) {
    appendLog(
      logParts,
      'Hint: sign out and sign in again so GitHub grants repo scope, and confirm you can push to this branch.'
    );
  }
  if (/protected|GH006|reject/i.test(detail)) {
    appendLog(
      logParts,
      'Hint: branch protection may block direct pushes — adjust rules or push from a feature branch manually.'
    );
  }
  if (/could not read Username|authentication|401/i.test(detail)) {
    appendLog(logParts, 'Hint: GitHub token may be expired — reconnect your GitHub account in Settings.');
  }
}

/**
 * Git requires user.name + user.email in each repo (Railway/Docker have none by default).
 */
async function configureRemediationGitIdentity(repoGit, userId, logParts) {
  const envName = (process.env.REMEDIATION_GIT_USER_NAME || '').trim();
  const envEmail = (process.env.REMEDIATION_GIT_USER_EMAIL || '').trim();
  let gitName = envName;
  let gitEmail = envEmail;

  if (!gitName || !gitEmail) {
    const { data: user } = await supabase
      .from('users')
      .select('username, github_id, email')
      .eq('id', userId)
      .single();

    if (!gitName) {
      gitName = user?.username ? `${user.username} (via AI Review)` : 'AI Code Review';
    }
    if (!gitEmail) {
      if (user?.github_id && user?.username) {
        gitEmail = `${user.github_id}+${user.username}@users.noreply.github.com`;
      } else if (user?.email) {
        gitEmail = user.email;
      } else {
        gitEmail = 'ai-review@users.noreply.github.com';
      }
    }
  }

  await repoGit.addConfig('user.name', gitName, false, 'local');
  await repoGit.addConfig('user.email', gitEmail, false, 'local');
  appendLog(logParts, `Git commit identity: ${gitName} <${gitEmail}>`);
  return { gitName, gitEmail };
}

async function resolveRemediationBranch(report, repoFullName, userId, logParts) {
  if (report.analyzed_branch) {
    return report.analyzed_branch;
  }
  appendLog(logParts, 'No analyzed branch on report — resolving default branch from GitHub...');
  const defaultBranch = await fetchRepoDefaultBranch(repoFullName, userId);
  appendLog(logParts, `Using default branch: ${defaultBranch}`);
  return defaultBranch;
}

/**
 * Run remediation pipeline for a confirmed report.
 * @param {object} opts
 * @param {string} opts.reportId
 * @param {string} opts.userId
 * @param {string} opts.repoFullName - owner/repo
 */
async function runRemediation({ reportId, userId, repoFullName }) {
  if (!isAutoRemediationEnabled()) {
    const err = new Error(AUTO_REMEDIATION_DISABLED_MESSAGE);
    if (reportId) {
      try {
        await updateRemediationStatus(reportId, 'failed', {
          remediation_log: AUTO_REMEDIATION_DISABLED_MESSAGE,
        });
      } catch {
        /* best effort — report may not exist for malformed jobs */
      }
    }
    throw err;
  }

  const logParts = [];

  const { data: report, error } = await reportsRepository.getReportWithRepo(reportId);
  if (error || !report) {
    throw new Error('Report not found');
  }
  if (report.repositories.user_id !== userId) {
    throw new Error('Forbidden');
  }

  if (['running', 'validating'].includes(report.remediation_status)) {
    throw new Error('Remediation is already in progress');
  }
  if (report.remediation_status === 'pushed') {
    throw new Error('Remediation was already applied and pushed');
  }

  const reviewId = report.review_id;

  appendLog(logParts, 'User confirmed remediation — starting pipeline');
  await updateRemediationStatus(reportId, 'confirmed', {
    remediation_log: logParts.join('\n'),
  });

  const token = await loadUserAccessToken(userId);
  if (!token) {
    throw new Error('GitHub access token missing — sign in with GitHub again');
  }

  const branch = await resolveRemediationBranch(report, repoFullName, userId, logParts);

  const issues = await loadReviewIssues(reviewId);
  const fixableIssues = issues.filter((i) => i.suggestion && i.file_path);
  if (fixableIssues.length === 0) {
    await updateRemediationStatus(reportId, 'failed', {
      remediation_log: 'No issues with suggestions available for automatic remediation.',
    });
    throw new Error('No fixable issues in this report');
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-remediate-'));
  const repoDir = path.join(tmpRoot, 'repo');
  const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

  try {
    await updateRemediationStatus(reportId, 'running', {
      remediation_log: logParts.join('\n'),
    });
    appendLog(logParts, `Cloning ${repoFullName} (branch ${branch})...`);

    const git = simpleGit();
    try {
      await git.clone(cloneUrl, repoDir, ['--depth', '50', '--branch', branch, '--single-branch']);
    } catch (cloneErr) {
      appendLog(logParts, `Branch clone failed (${cloneErr.message}); trying default clone + checkout`);
      await git.clone(cloneUrl, repoDir, ['--depth', '50']);
      const repoGitFallback = simpleGit(repoDir);
      await repoGitFallback.checkout(branch);
    }

    const repoGit = simpleGit(repoDir);
    await configureRemediationGitIdentity(repoGit, userId, logParts);
    appendLog(logParts, `On branch ${branch}, pulling latest...`);
    try {
      await repoGit.pull('origin', branch);
    } catch (pullErr) {
      appendLog(logParts, `Pull skipped or failed: ${pullErr.message}`);
    }

    const uniquePaths = [...new Set(fixableIssues.map((i) => i.file_path))];
    const fileMap = new Map();
    for (const fp of uniquePaths) {
      const abs = path.join(repoDir, fp);
      try {
        const content = await fs.readFile(abs, 'utf8');
        fileMap.set(fp, content);
      } catch {
        appendLog(logParts, `Could not read ${fp} — skipped`);
      }
    }

    const { files: patched, applied, skipped } = applyFixesToFiles(fileMap, fixableIssues);
    skipped.slice(0, 20).forEach((s) =>
      appendLog(logParts, `Skipped ${s.filePath}: ${s.note}`)
    );
    if (applied.length === 0) {
      const summary = skipped.length
        ? skipped.map((s) => `${s.filePath}: ${s.note}`).join('; ')
        : 'No matching fix rules for the reported issues';
      appendLog(logParts, `No automatic fixes applied. ${summary}`);
      throw new Error(
        `No automatic fixes could be applied safely. ${summary.slice(0, 500)}`
      );
    }

    for (const [fp, content] of patched.entries()) {
      if (fileMap.get(fp) !== content) {
        await fs.mkdir(path.dirname(path.join(repoDir, fp)), { recursive: true });
        await fs.writeFile(path.join(repoDir, fp), content, 'utf8');
        appendLog(logParts, `Patched ${fp}`);
      }
    }
    await updateRemediationStatus(reportId, 'validating', {
      remediation_log: logParts.join('\n'),
    });

    const validation = await runValidation(repoDir, logParts);
    if (!validation.ok) {
      await updateRemediationStatus(reportId, 'failed', {
        remediation_log: logParts.join('\n'),
      });
      throw new Error(`Validation failed${validation.failedScript ? ` at npm run ${validation.failedScript}` : ''}`);
    }

    await repoGit.add('.');
    const status = await repoGit.status();
    if (status.files.length === 0) {
      throw new Error('No file changes to commit after applying fixes');
    }

    await repoGit.commit('fix(ai): resolve analyzer findings');
    appendLog(logParts, 'Committed changes locally');

    try {
      await repoGit.push('origin', branch);
    } catch (pushErr) {
      appendPushFailureHints(logParts, pushErr);
      throw pushErr;
    }
    const head = await repoGit.revparse(['HEAD']);
    appendLog(logParts, `Pushed to origin/${branch} (${head.slice(0, 7)})`);

    await updateRemediationStatus(reportId, 'pushed', {
      remediation_log: logParts.join('\n'),
      push_commit_sha: head.trim(),
      pushed_at: new Date().toISOString(),
    });

    logger.info('Remediation completed', { reportId, branch, commit: head.slice(0, 7) });
    return { commitSha: head.trim(), branch, appliedCount: applied.length };
  } catch (err) {
    appendLog(logParts, `Remediation error: ${err.message}`);
    await updateRemediationStatus(reportId, 'failed', {
      remediation_log: logParts.join('\n'),
    });
    throw err;
  } finally {
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    } catch {
      /* best effort cleanup */
    }
  }
}

module.exports = { runRemediation };
