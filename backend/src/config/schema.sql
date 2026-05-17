-- Baseline schema for a brand-new (empty) database.
-- Do NOT paste this whole file into Supabase if the project already has tables/triggers;
-- you will get "already exists" errors. For existing DBs, use incremental files in
-- backend/migrations/ (e.g. add_review_issue_snippet_rule.sql) and never re-run triggers blindly.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id     BIGINT UNIQUE NOT NULL,
  username      VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  avatar_url    TEXT,
  access_token  TEXT,  -- AES-256-GCM ciphertext (v1:/v2:) via TOKEN_ENCRYPTION_KEY_CURRENT; legacy plaintext until re-login          
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repositories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  github_repo_id  BIGINT UNIQUE NOT NULL,
  full_name       VARCHAR(255) NOT NULL,   
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  language        VARCHAR(100),
  is_private      BOOLEAN DEFAULT false,
  webhook_id      BIGINT,                  
  webhook_active  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS code_reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id   UUID REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha      VARCHAR(40) NOT NULL,
  branch          VARCHAR(255),
  pr_number       INTEGER,
  author          VARCHAR(255),
  status          VARCHAR(50) DEFAULT 'pending',  
  triggered_by    VARCHAR(50) DEFAULT 'webhook',  
  summary         TEXT,                           
  overall_score   SMALLINT,                       
  error_message   TEXT,                           
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  UNIQUE(repository_id, commit_sha)
);

CREATE TABLE IF NOT EXISTS review_issues (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id        UUID REFERENCES code_reviews(id) ON DELETE CASCADE,
  file_path        TEXT NOT NULL,
  line_number      INTEGER,
  severity         VARCHAR(20) NOT NULL,   
  category         VARCHAR(50),           
  title            VARCHAR(500) NOT NULL,
  description      TEXT NOT NULL,
  suggestion       TEXT,
  code_snippet     TEXT,
  matched_rule     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_file_stats (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id     UUID REFERENCES code_reviews(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  additions     INTEGER DEFAULT 0,
  deletions     INTEGER DEFAULT 0,
  issues_count  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_repo_id ON code_reviews(repository_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_status ON code_reviews(status);
CREATE INDEX IF NOT EXISTS idx_review_issues_review_id ON review_issues(review_id);
CREATE INDEX IF NOT EXISTS idx_review_issues_severity ON review_issues(severity);

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
  follow_up_review_id UUID REFERENCES code_reviews(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_repository_id ON analysis_reports(repository_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_created_at ON analysis_reports(created_at DESC);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_repositories_updated_at ON repositories;
CREATE TRIGGER update_repositories_updated_at BEFORE UPDATE ON repositories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
