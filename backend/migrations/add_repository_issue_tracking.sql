-- Persistent per-repository issue tracking (open / resolved / reopened).
-- Safe to run on existing Supabase projects (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS repository_issues (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id           UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  fingerprint             VARCHAR(64) NOT NULL,
  file_path               TEXT NOT NULL,
  line_number             INTEGER,
  severity                VARCHAR(20) NOT NULL,
  category                VARCHAR(50),
  title                   VARCHAR(500) NOT NULL,
  description             TEXT NOT NULL,
  suggestion              TEXT,
  code_snippet            TEXT,
  matched_rule            TEXT,
  status                  VARCHAR(20) NOT NULL DEFAULT 'open',
  first_seen_review_id    UUID REFERENCES code_reviews(id) ON DELETE SET NULL,
  last_seen_review_id     UUID REFERENCES code_reviews(id) ON DELETE SET NULL,
  last_resolved_review_id UUID REFERENCES code_reviews(id) ON DELETE SET NULL,
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT repository_issues_status_check
    CHECK (status IN ('open', 'resolved', 'reopened')),
  CONSTRAINT repository_issues_repo_fingerprint_unique
    UNIQUE (repository_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_repository_issues_repo_status
  ON repository_issues (repository_id, status);

CREATE INDEX IF NOT EXISTS idx_repository_issues_fingerprint
  ON repository_issues (fingerprint);

ALTER TABLE review_issues ADD COLUMN IF NOT EXISTS repository_issue_id UUID
  REFERENCES repository_issues(id) ON DELETE SET NULL;

ALTER TABLE review_issues ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);

ALTER TABLE review_issues ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_review_issues_repository_issue_id
  ON review_issues (repository_issue_id);

CREATE INDEX IF NOT EXISTS idx_review_issues_lifecycle_status
  ON review_issues (lifecycle_status);

ALTER TABLE repository_issues ENABLE ROW LEVEL SECURITY;
