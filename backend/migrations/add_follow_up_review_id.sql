-- Links an analysis report to the re-scan queued after remediation push.
ALTER TABLE analysis_reports
  ADD COLUMN IF NOT EXISTS follow_up_review_id UUID REFERENCES code_reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_reports_follow_up_review
  ON analysis_reports(follow_up_review_id);
