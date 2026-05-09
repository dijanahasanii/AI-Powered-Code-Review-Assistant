-- Optional columns for richer zero-budget review rows (snippet + triggering rule).

ALTER TABLE review_issues ADD COLUMN IF NOT EXISTS code_snippet TEXT;
ALTER TABLE review_issues ADD COLUMN IF NOT EXISTS matched_rule TEXT;
