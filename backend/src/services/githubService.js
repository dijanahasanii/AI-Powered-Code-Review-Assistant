const { Octokit } = require('@octokit/rest');
const { supabase } = require('../config/database');
const { logger } = require('../utils/logger');
const { shouldScanPath, MAX_FILE_BYTES } = require('../analyzers/pathFilter');

const MAX_REPO_FILES_TO_SCAN = 420;
const BLOB_FETCH_CONCURRENCY = 7;

/**
 * Validates "owner/repo" shape before hitting the GitHub API.
 */
const parseRepoFullName = (repoFullName) => {
  if (!repoFullName || typeof repoFullName !== 'string') {
    throw new Error('repoFullName is missing or not a string');
  }
  const parts = repoFullName.split('/');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    throw new Error(`Invalid repoFullName format: "${repoFullName}" — expected "owner/repo"`);
  }
  return { owner: parts[0].trim(), repo: parts[1].trim() };
};

const githubHttpStatus = (err) => Number(err?.status ?? err?.response?.status ?? 0) || 0;

const isGithubNonRetryable = (err) => [400, 401, 403].includes(githubHttpStatus(err));

/**
 * Retry GitHub reads on transient/network issues; fail fast on 400/401/403.
 */
const withGithubRetry = async (label, fn, maxAttempts = 3) => {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (isGithubNonRetryable(err)) throw err;
      if (attempt >= maxAttempts) throw err;
      const s = githubHttpStatus(err);
      const delayMs = s === 429 ? Math.pow(2, attempt) * 500 : 200 * attempt;
      logger.warn(`${label}: transient GitHub error (${s || err.message}), retry ${attempt}/${maxAttempts} in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
};

const { getGithubAccessTokenForUser } = require('./userTokenService');

const loadUserAccessToken = async (userId) => getGithubAccessTokenForUser(userId);

/**
 * Fetch the diff for a specific commit from GitHub
 */
const fetchCommitDiff = async (repoFullName, commitSha, userId) => {
  const { owner, repo } = parseRepoFullName(repoFullName);

  const token = await loadUserAccessToken(userId);
  if (!token) {
    logger.warn(`fetchCommitDiff: no GitHub token for user_id=${userId}`);
    throw new Error('GitHub access token missing or invalid');
  }

  const octokit = new Octokit({ auth: token });

  // IMPORTANT: Use default JSON (no mediaType: diff). The "diff" accept type returns a raw
  // blob and Octokit does not populate files[].patch — filtering on f.patch then yields an
  // empty string and the reviewer reports "No issues found" despite real changes.
  const { data } = await withGithubRetry('repos.getCommit', () =>
    octokit.repos.getCommit({
      owner,
      repo,
      ref: commitSha,
    })
  );

  let files = data.files || [];

  // Fallback A: commits sometimes omit files[].patch; compare parent→head restores patches.
  const needCompare =
    files.length > 0 &&
    files.every((f) => !f.patch) &&
    Array.isArray(data.parents) &&
    data.parents.length > 0;

  if (needCompare) {
    const cmp = await withGithubRetry('repos.compareCommitsWithBasehead', () =>
      octokit.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${data.parents[0].sha}...${commitSha}`,
      })
    );
    files = cmp.data.files || [];
  }

  const fileStats = files.map((f) => ({
    filePath: f.filename,
    additions: f.additions,
    deletions: f.deletions,
  }));

  const textFiles = files.filter((f) => f.patch && !isBinaryPath(f.filename));
  let diff = textFiles
    .map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
    .join('\n\n');

  const nonBinaryChanged = files.filter((f) => !isBinaryPath(f.filename));
  const statsShowTextChange =
    nonBinaryChanged.length > 0 &&
    nonBinaryChanged.some((f) => ((f.additions || 0) + (f.deletions || 0)) > 0);

  // Fallback B: patches still missing (large files, GH quirks). Full unified diff as plain text.
  if (!diff.trim() && statsShowTextChange) {
    logger.warn(`No per-file patches for ${commitSha}; fetching raw commit diff`);
    try {
      const raw = await withGithubRetry('rawCommitDiff', () =>
        octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
          owner,
          repo,
          ref: commitSha,
          headers: { accept: 'application/vnd.github.diff' },
        })
      );
      const body = raw.data;
      if (Buffer.isBuffer(body) && body.length) {
        diff = body.toString('utf8');
      } else if (typeof body === 'string' && body.trim()) {
        diff = body;
      }
    } catch (e) {
      logger.error(`Raw diff fetch failed: ${e.message}`);
    }
  }

  logger.info(
    `GitHub diff ${commitSha.slice(0, 7)}: ${diff.trim().length} chars, ${fileStats.length} files in commit`
  );

  if (!diff || !diff.trim()) {
    throw new Error('Empty diff from GitHub');
  }

  return { diff, fileStats };
};

/**
 * Snapshot of text source files at a commit via Git Trees API + blobs (recursive).
 * No git clone — uses the user's OAuth token against GitHub. Respects ignores in pathFilter.
 */
const fetchRepoSourceFilesAtCommit = async (repoFullName, commitSha, userId) => {
  const { owner, repo } = parseRepoFullName(repoFullName);

  const token = await loadUserAccessToken(userId);
  if (!token) {
    logger.warn(`fetchRepoSourceFilesAtCommit: no GitHub token for user_id=${userId}`);
    throw new Error('GitHub access token missing or invalid');
  }

  const octokit = new Octokit({ auth: token });

  const { data: commitData } = await withGithubRetry('repos.getCommit(tree)', () =>
    octokit.repos.getCommit({ owner, repo, ref: commitSha })
  );

  const treeSha = commitData.commit?.tree?.sha;
  if (!treeSha) throw new Error('Commit tree unavailable from GitHub');

  const { data: tree } = await withGithubRetry('git.getTree', () =>
    octokit.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: true,
    })
  );

  if (tree.truncated) {
    logger.warn(
      `[github] Recursive tree truncated for ${repoFullName}@${commitSha.slice(0, 7)} — scanning first ${MAX_REPO_FILES_TO_SCAN} eligible blobs only`
    );
  }

  const blobs = (tree.tree || []).filter((e) => e.type === 'blob' && shouldScanPath(e.path, e.size));

  const candidates = blobs.slice(0, MAX_REPO_FILES_TO_SCAN);

  const filesOut = [];
  let skippedTooLarge = 0;
  let fetchErrors = 0;

  const fetchOne = async (item) => {
    const sz = item.size != null ? Number(item.size) : null;
    if (sz != null && sz > MAX_FILE_BYTES) return { status: 'skip_size' };
    try {
      const { data: blob } = await withGithubRetry(`git.getBlob ${item.path}`, () =>
        octokit.git.getBlob({ owner, repo, file_sha: item.sha })
      );
      const buf = Buffer.from(blob.content, 'base64');
      if (buf.length > MAX_FILE_BYTES) return { status: 'skip_size' };
      const text = buf.toString('utf8');
      if (text.includes('\u0000')) return { status: 'skip_binary' };
      return {
        status: 'ok',
        file: { path: item.path.replace(/\\/g, '/'), content: text },
      };
    } catch (e) {
      logger.debug(`[github] Blob skip ${item.path}: ${e.message}`);
      return { status: 'err' };
    }
  };

  for (let i = 0; i < candidates.length; i += BLOB_FETCH_CONCURRENCY) {
    const batch = candidates.slice(i, i + BLOB_FETCH_CONCURRENCY);
    const chunk = await Promise.all(batch.map((item) => fetchOne(item)));
    for (const r of chunk) {
      if (r.status === 'ok' && r.file) filesOut.push(r.file);
      else if (r.status === 'skip_size') skippedTooLarge += 1;
      else if (r.status === 'err') fetchErrors += 1;
    }
  }

  logger.info(
    `[github] Snapshot ${repoFullName}@${commitSha.slice(0, 7)}: ${filesOut.length} files (${candidates.length} candidates, oversized ${skippedTooLarge}, blob errors ${fetchErrors}, tree_truncated=${Boolean(tree.truncated)})`
  );

  return {
    files: filesOut,
    meta: {
      treeTruncated: Boolean(tree.truncated),
      blobsEligible: blobs.length,
      blobsAttempted: candidates.length,
      filesLoaded: filesOut.length,
      skippedTooLarge,
      fetchErrors,
    },
  };
};

/**
 * Post line-level review comments back to the GitHub PR
 */
const postPRComments = async (repoFullName, prNumber, commitSha, issues, userId) => {
  if (!prNumber) return; // Only for PRs

  let parsed;
  try {
    parsed = parseRepoFullName(repoFullName);
  } catch (e) {
    logger.warn(`postPRComments: ${e.message} — skipping PR comments`);
    return;
  }

  const token = await loadUserAccessToken(userId);
  if (!token) {
    logger.warn(`postPRComments: no GitHub token for user_id=${userId}, skipping PR post`);
    return;
  }

  const octokit = new Octokit({ auth: token });
  const { owner, repo } = parsed;

  // Post a top-level review comment with the summary
  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const reviewBody = criticalIssues.length > 0
    ? `## AI Code Review\n\n⚠️ Found ${criticalIssues.length} critical issue(s). Please review before merging.`
    : `## AI Code Review\n\n✅ No critical issues found. Review complete.`;

  try {
    const inlineComments = issues
      .filter((i) => i.lineNumber && ['critical', 'warning'].includes(i.severity))
      .slice(0, 10) // GitHub limits inline comments per review
      .map((issue) => ({
        path: issue.filePath,
        line: issue.lineNumber,
        body: [
          `**[${issue.severity.toUpperCase()}] ${issue.title}**`,
          issue.lineNumber ? `📍 Line ${issue.lineNumber}` : null,
          issue.codeSnippet ? `\`\`\`\n${String(issue.codeSnippet).slice(0, 2500)}\n\`\`\`` : null,
          issue.matchedRule ? `**Rule:** ${issue.matchedRule}` : null,
          issue.description ? `\n${issue.description}` : null,
          issue.suggestion ? `\n💡 **Suggestion:** ${issue.suggestion}` : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
      }));

    try {
      await withGithubRetry('pulls.createReview(inline)', () =>
        octokit.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          commit_id: commitSha,
          body: reviewBody,
          event: criticalIssues.length > 0 ? 'REQUEST_CHANGES' : 'COMMENT',
          comments: inlineComments,
        })
      );
      logger.info(`Posted review comments to PR #${prNumber}`);
    } catch (inlineErr) {
      if (isGithubNonRetryable(inlineErr)) {
        logger.warn(`Failed to post inline PR (${githubHttpStatus(inlineErr)}), skipping fallback chain: ${inlineErr.message}`);
        return;
      }
      logger.warn(`Failed to post inline PR comments, falling back to general review: ${inlineErr.message}`);

      const fallbackBody = `${reviewBody}\n\n### Issues Summary\n` +
        inlineComments.map((c) => `- **${c.path}:${c.line}**: ${c.body.replace(/\n/g, ' ')}`).join('\n');

      try {
        await withGithubRetry('pulls.createReview(fallback)', () =>
          octokit.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            commit_id: commitSha,
            body: fallbackBody,
            event: criticalIssues.length > 0 ? 'REQUEST_CHANGES' : 'COMMENT',
          })
        );
        logger.info(`Posted fallback general review to PR #${prNumber}`);
      } catch (fbErr) {
        if (isGithubNonRetryable(fbErr)) {
          logger.warn(`Fallback PR review blocked (${githubHttpStatus(fbErr)}): ${fbErr.message}`);
          return;
        }
        throw fbErr;
      }
    }
  } catch (err) {
    logger.error(`Failed to post PR review: ${err.message}`);
    if (isGithubNonRetryable(err)) {
      logger.warn(`PR review non-retryable (${githubHttpStatus(err)}); not posting issue comment`);
      return;
    }
    try {
      const lines = issues.slice(0, 15).map(
        (i) => `- **${i.severity}** \`${i.filePath}\`: ${i.title}`
      );
      await withGithubRetry('issues.createComment', () =>
        octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `${reviewBody}\n\n<details><summary>Issues (${issues.length})</summary>\n${lines.join('\n')}\n</details>`,
        })
      );
      logger.info(`Posted PR fallback issue comment on #${prNumber}`);
    } catch (e2) {
      if (isGithubNonRetryable(e2)) {
        logger.warn(`PR comment fallback blocked (${githubHttpStatus(e2)}): ${e2.message}`);
      } else {
        logger.error(`PR comment fallback failed: ${e2.message}`);
      }
    }
  }
};

const isBinaryPath = (filePath) => {
  if (!filePath) return false;
  const binaryExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.pdf',
    '.zip',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
  ];
  return binaryExtensions.some((ext) => filePath.toLowerCase().endsWith(ext));
};

/**
 * @param {string} repoFullName - owner/repo
 * @param {string} userId
 * @returns {Promise<string>}
 */
const fetchRepoDefaultBranch = async (repoFullName, userId) => {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const token = await loadUserAccessToken(userId);
  if (!token) throw new Error('GitHub access token missing or invalid');
  const octokit = new Octokit({ auth: token });
  const { data } = await withGithubRetry('repos.get', () => octokit.repos.get({ owner, repo }));
  return data.default_branch || 'main';
};

module.exports = {
  fetchCommitDiff,
  fetchRepoSourceFilesAtCommit,
  postPRComments,
  loadUserAccessToken,
  fetchRepoDefaultBranch,
  parseRepoFullName,
};
