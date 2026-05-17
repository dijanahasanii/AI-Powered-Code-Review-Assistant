import { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import CollapsibleSection from '../../../components/common/CollapsibleSection';
import { SeverityBadge } from '../../../components/common/UI';
import {
  ANALYSIS_BUCKETS,
  SEVERITY_ORDER,
  SEVERITY_ROLLUP_LABEL,
  bucketCategoryForSeverityJump,
} from '../analysisConstants';
import { CategoryAccordion } from './CategoryAccordion';

export function AnalysisFindingsPanel({
  sortedIssues,
  byBucket,
  reviewStatus,
  variant = 'review',
  beforeFix = false,
}) {
  const rollups = useMemo(() => {
    if (!sortedIssues.length) return null;
    const bySev = { critical: 0, warning: 0, info: 0, suggestion: 0 };
    for (const issue of sortedIssues) {
      if (bySev[issue.severity] != null) bySev[issue.severity]++;
    }
    const severityLine = SEVERITY_ORDER.filter((s) => bySev[s] > 0)
      .map((s) => `${bySev[s]} ${SEVERITY_ROLLUP_LABEL[s]}`)
      .join(' · ');
    const themeGroups = ANALYSIS_BUCKETS.reduce((n, b) => n + ((byBucket[b.id] ?? []).length > 0 ? 1 : 0), 0);
    return { severityLine, themeGroups, bySev };
  }, [sortedIssues, byBucket]);

  const bucketList = useMemo(
    () =>
      ANALYSIS_BUCKETS.map((bucket) =>
        byBucket[bucket.id]?.length ? (
          <CategoryAccordion
            key={bucket.id}
            bucket={bucket}
            issues={byBucket[bucket.id]}
            initiallyOpen={false}
          />
        ) : null
      ),
    [byBucket]
  );

  if (!sortedIssues.length || !rollups) {
    if (reviewStatus === 'failed') {
      return (
        <section
          className="card mb-6 overflow-hidden border-desk-border bg-desk-panel p-5 sm:p-6"
          aria-label="What we found"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ClipboardList size={16} className="shrink-0 text-desk-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">What we found</h2>
          </div>
          <p className="text-sm leading-relaxed text-desk-muted">
            No findings were saved — the run failed before analysis finished. Use the failure panel above to retry or
            read the error details.
          </p>
        </section>
      );
    }
    return null;
  }

  if (variant === 'report') {
    return (
      <section className="scroll-mt-6" aria-labelledby="report-findings-heading">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="report-findings-heading"
              className="text-sm font-semibold uppercase tracking-wider text-desk-muted"
            >
              {beforeFix ? 'Findings (before fix)' : 'Findings'}
            </h2>
            <p className="mt-1 text-sm text-desk-muted">
              {beforeFix
                ? 'These issues were found before fixes were pushed — they are not updated on this page.'
                : 'Expand a category to inspect individual issues, snippets, and file locations.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Jump to category by severity">
            {SEVERITY_ORDER.map((sev) =>
              rollups.bySev[sev] > 0 ? (
                <a
                  key={sev}
                  href={`#analysis-${bucketCategoryForSeverityJump(sev, byBucket)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-desk-border bg-desk-canvas/80 px-2.5 py-1 text-[11px] transition-colors hover:border-brand-500/35 hover:bg-brand-500/10"
                >
                  <SeverityBadge severity={sev} plainLanguage />
                  <span className="tabular-nums text-desk-muted">{rollups.bySev[sev]}</span>
                </a>
              ) : null
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">{bucketList}</div>
      </section>
    );
  }

  return (
    <CollapsibleSection
      idPrefix="analysis-findings"
      icon={ClipboardList}
      title="What we found"
      badge={sortedIssues.length}
      expandable={false}
      summary={
        <>
          {rollups.themeGroups} theme group{rollups.themeGroups !== 1 ? 's' : ''}
          {rollups.severityLine ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>{rollups.severityLine}</span>
            </>
          ) : null}
        </>
      }
      panelClassName="max-h-[min(28rem,calc(100vh-12rem))] overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:pb-5"
    >
      <p className="mb-3 text-[11px] text-desk-muted">
        Each topic opens on its own. Inside you will see rule names and code snippets — the section above stays in plain
        English.
      </p>
      <div className="flex flex-col gap-4">{bucketList}</div>
    </CollapsibleSection>
  );
}
