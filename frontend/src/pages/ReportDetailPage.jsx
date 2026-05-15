import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { reportsApi, reviewsApi } from '../api/client';
import { describeApiFailure } from '../lib/apiErrors';
import { Spinner } from '../components/common/UI';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { queryKeys } from '../lib/queryKeys';
import { useToast } from '../components/common/Toast';
import { ReportDetailHeader } from '../features/reports/components/ReportDetailHeader';
import { ReportSummaryCard } from '../features/reports/components/ReportSummaryCard';
import { ReportMarkdownAudit } from '../features/reports/components/ReportMarkdownAudit';
import { ReportRemediationLog } from '../features/reports/components/ReportRemediationLog';
import { AnalysisFindingsPanel } from '../features/reviews/components/AnalysisFindingsPanel';
import { SEVERITY_ORDER, bucketCategory } from '../features/reviews/analysisConstants';

const ACTIVE_REMEDIATION_STATUSES = new Set(['confirmed', 'running', 'validating', 'pending']);

export default function ReportDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [remediationWatch, setRemediationWatch] = useState(false);

  const reportQuery = useQuery({
    queryKey: queryKeys.reportDetail(id),
    queryFn: () =>
      reportsApi
        .getOne(id, { params: { _t: Date.now() } })
        .then((r) => r.data.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const status = query.state.data?.remediation_status;
      if (remediationWatch) return 2000;
      if (status && ACTIVE_REMEDIATION_STATUSES.has(status) && status !== 'pending') return 3000;
      return false;
    },
  });

  useEffect(() => {
    const status = reportQuery.data?.remediation_status;
    if (!remediationWatch) return;
    if (status === 'pushed' || status === 'failed') {
      setRemediationWatch(false);
    }
  }, [remediationWatch, reportQuery.data?.remediation_status]);

  const report = reportQuery.data;
  const reviewId = report?.review_id;

  const reviewQuery = useQuery({
    queryKey: queryKeys.reviewDetail(reviewId),
    queryFn: () => reviewsApi.getOne(reviewId).then((r) => r.data.data),
    enabled: Boolean(reviewId),
  });

  const markdownQuery = useQuery({
    queryKey: queryKeys.reportMarkdown(id),
    queryFn: () => reportsApi.getMarkdown(id).then((r) => r.data.data.markdown),
    enabled: Boolean(id) && Boolean(report),
  });

  const confirmMutation = useMutation({
    mutationFn: () => reportsApi.confirmRemediation(id),
    onSuccess: async () => {
      toast.success('Remediation queued', 'Fixes will run after validation on the analyzed branch.');
      setConfirmOpen(false);
      setRemediationWatch(true);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reportDetail(id) });
      await queryClient.refetchQueries({ queryKey: queryKeys.reportDetail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
    },
    onError: (err) => {
      const { title, detail } = describeApiFailure(err, { resourceLabel: 'remediation' });
      toast.error(title, detail);
    },
  });

  const issues = useMemo(() => reviewQuery.data?.review_issues ?? [], [reviewQuery.data]);

  const sortedIssues = useMemo(
    () =>
      [...issues].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
    [issues]
  );

  const byBucket = useMemo(() => {
    const buckets = { security: [], performance: [], 'code-quality': [] };
    sortedIssues.forEach((issue) => {
      buckets[bucketCategory(issue.category)].push(issue);
    });
    return buckets;
  }, [sortedIssues]);

  const loadError =
    reportQuery.isError && describeApiFailure(reportQuery.error, { resourceLabel: 'this report' });

  const canApplyFixes =
    report &&
    report.issue_count > 0 &&
    !['pushed', 'running', 'validating'].includes(report.remediation_status);

  const summary = reviewQuery.data?.summary;
  const overallScore = reviewQuery.data?.overall_score;

  const confirmMessage = report
    ? [
        `You are about to apply AI-generated fixes to ${report.repository_name}.`,
        `Target branch: ${report.analyzed_branch || 'main'}`,
        `Issues in report: ${report.issue_count}`,
        '',
        'Files will be modified, validated (lint/build/test when available), committed, and pushed to the same branch. This cannot be undone automatically.',
      ].join('\n')
    : '';

  if (reportQuery.isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm font-semibold text-red-300">{loadError.title}</p>
        <p className="mt-2 text-sm text-desk-muted">{loadError.detail}</p>
        <Link to="/reports" className="btn-secondary mt-6 inline-flex px-4 py-2 text-sm">
          Back to reports
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        to="/reports"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-desk-muted transition-colors hover:text-brand-400"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All reports
      </Link>

      <ReportDetailHeader
        report={report}
        overallScore={overallScore}
        severitySummary={report.severity_summary}
        canApplyFixes={canApplyFixes}
        onApplyFixes={() => setConfirmOpen(true)}
      />

      {report.remediation_status === 'failed' && (
        <div
          className="mb-8 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 sm:px-5"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-200">Remediation did not push to GitHub</p>
          <p className="mt-1 text-sm text-red-200/80">
            Expand the remediation log below for details, then try Apply fixes again after fixing the underlying issue.
          </p>
          {report.remediation_log && (
            <a
              href="#remediation-log"
              className="mt-3 inline-flex text-sm font-medium text-red-200 underline-offset-2 hover:underline"
            >
              View remediation log
            </a>
          )}
        </div>
      )}

      <main className="space-y-10">
        <ReportSummaryCard summary={summary} />

        {reviewQuery.isLoading && !sortedIssues.length ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : sortedIssues.length > 0 ? (
          <AnalysisFindingsPanel
            sortedIssues={sortedIssues}
            byBucket={byBucket}
            reviewStatus="completed"
            variant="report"
          />
        ) : report.issue_count > 0 ? (
          <p className="text-center text-sm text-desk-muted">
            Findings are listed in the persisted report file below.
          </p>
        ) : null}
      </main>

      <footer className="mt-14 border-t border-desk-border pt-10">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-desk-muted">
          Technical records
        </p>
        <div className="space-y-6">
          <ReportMarkdownAudit
            markdown={markdownQuery.data}
            isLoading={markdownQuery.isPending}
            isError={markdownQuery.isError}
            reportPath={report.report_path}
          />
          <ReportRemediationLog log={report.remediation_log} status={report.remediation_status} />
        </div>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm remediation"
        message={confirmMessage}
        confirmLabel={confirmMutation.isPending ? 'Queuing...' : 'Confirm & Push'}
        danger
        onCancel={() => !confirmMutation.isPending && setConfirmOpen(false)}
        onConfirm={() => confirmMutation.mutate()}
      />
    </div>
  );
}
