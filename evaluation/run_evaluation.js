#!/usr/bin/env node
/**
 * Thesis evaluation harness — invokes production `analyzeCode` in diff-only mode only.
 * Does not start the server, webhooks, or queue. Not imported by the application.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Plain logs in Git Bash / some Windows terminals (avoids broken ANSI fragments like `]:`). */
process.env.NO_COLOR = '1';
process.env.FORCE_COLOR = '0';

const repoRoot = path.join(__dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://evaluation.stub.local';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'evaluation-stub-service-role';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'evaluation-placeholder-jwt-secret-32chars';
}
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

fs.mkdirSync(path.join(backendRoot, 'logs'), { recursive: true });
process.chdir(backendRoot);

const { analyzeCode } = require(path.join(backendRoot, 'src', 'services', 'openaiService'));
const { CASES } = require(path.join(repoRoot, 'evaluation', 'fixtures', 'cases.js'));

function escapeMdCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Winston’s Console transport uses `console._stdout.write`, not `console.log` — patch streams for a clean batch run. */
async function withEvaluationQuietIO(fn) {
  const stdout = process.stdout;
  const stderr = process.stderr;
  const writeOut = stdout.write.bind(stdout);
  const writeErr = stderr.write.bind(stderr);
  const swallow = () => true;

  const prev = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  stdout.write = swallow;
  stderr.write = swallow;
  console.log = swallow;
  console.info = swallow;
  console.warn = swallow;
  console.error = swallow;
  if (typeof console.debug === 'function') console.debug = swallow;

  try {
    return await fn();
  } finally {
    stdout.write = writeOut;
    stderr.write = writeErr;
    Object.assign(console, prev);
  }
}

async function main() {
  const rows = [];
  await withEvaluationQuietIO(async () => {
    for (const c of CASES) {
      const t0 = Date.now();
      let result;
      try {
        result = await analyzeCode(c.diff, {});
      } catch (e) {
        rows.push({
          id: c.id,
          count: 'ERR',
          ms: Date.now() - t0,
          notes: `${c.notes} | ${e.message}`,
        });
        continue;
      }
      const ms = Date.now() - t0;
      rows.push({
        id: c.id,
        count: Array.isArray(result.issues) ? result.issues.length : 'n/a',
        ms,
        notes: c.notes,
      });
    }
  });

  const header = `# Evaluation results (generated)

Run again from repo root: \`npm run evaluate\`

- **Generated at (UTC):** ${new Date().toISOString()}
- **Node:** ${process.version}
- **Harness:** \`evaluation/run_evaluation.js\` — calls \`backend/src/services/openaiService.js\` \`analyzeCode(diff, {})\` (diff-only / snapshot-unavailable path; no GitHub, no DB).

## Summary table

| case id | detected issues count | processing time (ms) | notes |
|---------|------------------------|----------------------|-------|
`;

  const body = rows
    .map((r) => `| ${escapeMdCell(r.id)} | ${escapeMdCell(r.count)} | ${r.ms} | ${escapeMdCell(r.notes)} |`)
    .join('\n');

  const outPath = path.join(repoRoot, 'evaluation', 'results.md');
  fs.writeFileSync(outPath, `${header}${body}\n`, 'utf8');
  console.log(`Wrote ${outPath} (${rows.length} rows)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
