#!/usr/bin/env node
/**
 * Pre-flight checks for a clean clone (no secrets — only presence/format hints).
 * Run from repo root: npm run verify:setup
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const backendEnvPath = path.join(root, 'backend', '.env');
const frontendEnvPath = path.join(root, 'frontend', '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function looksPlaceholder(v) {
  if (v === undefined || v === '') return true;
  const s = String(v);
  return /your_|placeholder|CHANGE|example\.com|YOUR-/i.test(s);
}

const errors = [];
const warnings = [];

const major = parseInt(process.version.slice(1).split('.')[0], 10);
if (Number.isNaN(major) || major < 18) {
  errors.push(`Node.js 18+ required; found ${process.version}`);
} else if (major < 20) {
  warnings.push(`CI and Docker use Node 20; you have ${process.version} — use .nvmrc / nvm for parity`);
}

const backendEnv = parseEnvFile(backendEnvPath);

if (!backendEnv) {
  errors.push('Missing backend/.env — copy backend/.env.example to backend/.env (required for Supabase + JWT)');
} else {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET']) {
    const v = backendEnv[k];
    if (v === undefined || v === '' || looksPlaceholder(v)) {
      errors.push(`backend/.env: set a real value for ${k} (server exits at boot if Supabase vars are missing)`);
    }
  }
  const jwt = backendEnv.JWT_SECRET || '';
  if (jwt.length > 0 && jwt.length < 16) {
    errors.push('backend/.env: JWT_SECRET must be at least 16 characters (32+ recommended for production)');
  }
  const supa = backendEnv.SUPABASE_URL || '';
  if (supa.includes('/rest/v1')) {
    warnings.push('backend/.env: SUPABASE_URL should be the project base only (https://xxx.supabase.co), not …/rest/v1');
  }

  for (const k of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_WEBHOOK_SECRET', 'BACKEND_URL', 'FRONTEND_URL']) {
    const v = backendEnv[k];
    if (v === undefined || v === '' || looksPlaceholder(v)) {
      warnings.push(`backend/.env: ${k} — OAuth, CORS, or webhooks may fail until set (see README §14)`);
    }
  }
}

const feEnv = parseEnvFile(frontendEnvPath);
if (!feEnv) {
  warnings.push(
    'Missing frontend/.env — copy frontend/.env.example (login uses GET /api/auth/github; VITE_GITHUB_CLIENT_ID is optional)'
  );
} else if (looksPlaceholder(feEnv.VITE_GITHUB_CLIENT_ID)) {
  warnings.push(
    'frontend/.env: VITE_GITHUB_CLIENT_ID optional — login uses server OAuth; keep backend GITHUB_CLIENT_ID aligned with your GitHub App'
  );
}

for (const w of warnings) {
  console.warn(`[warn] ${w}`);
}
if (errors.length) {
  for (const e of errors) {
    console.error(`[error] ${e}`);
  }
  process.exit(1);
}

console.log('[ok] verify-setup: Node OK; backend has minimum vars for API boot. Fix warnings for OAuth and webhooks.');
process.exit(0);
