# Fingerprint algorithm change (severity removed)

After deploying the fingerprint fix, existing `repository_issues.fingerprint` values may still use the old hash (included severity).

**Automatic reconciliation:** The next completed review for each repository runs `reconcileRepositoryIssueFingerprints` before sync and updates rows when safe (no unique constraint collision).

**Manual backfill (optional):** Re-trigger a review on the latest commit per repository, or run reviews normally.

No SQL migration is required. If two legacy rows collapse to the same new fingerprint, one row is skipped with a log warning — resolve duplicates manually in Supabase if needed.
