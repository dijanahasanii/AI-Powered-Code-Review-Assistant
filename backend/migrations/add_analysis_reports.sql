-- Persistent AI analysis reports and remediation tracking.
--
-- Apply in Supabase Dashboard → SQL Editor → New query → paste & Run.
-- (Direct psql may fail on Windows if db.*.supabase.co does not resolve — use the dashboard.)
-- After this: restart backend, refresh /reports, optionally run: npm run db:backfill:reports

CREATE TABLE IF NOT EXISTS analysis_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id           UUID UNIQUE NOT NULL REFERENCES code_reviews(id) ON DELETE CASCADE,
  repository_id       UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  repository_name     VARCHAR(255) NOT NULL,
  analyzed_branch     VARCHAR(255),
  commit_sha          VARCHAR(40),
  report_path         TEXT NOT NULL,
  issue_count         INTEGER DEFAULT 0,
  severity_summary    JSONB DEFAULT '{}'::jsonb,
  analysis_type       VARCHAR(100),
  remediation_status  VARCHAR(50) DEFAULT 'pending',
  remediation_log     TEXT,
  push_commit_sha     VARCHAR(40),
  pushed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_repository_id ON analysis_reports(repository_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_created_at ON analysis_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_remediation_status ON analysis_reports(remediation_status);

ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;
