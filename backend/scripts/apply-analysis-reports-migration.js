/**
 * Applies backend/migrations/add_analysis_reports.sql using DATABASE_URL.
 * Usage: node scripts/apply-analysis-reports-migration.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required in backend/.env');
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('Install pg first: npm install pg --save-dev');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'migrations', 'add_analysis_reports.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration applied: analysis_reports table is ready.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
