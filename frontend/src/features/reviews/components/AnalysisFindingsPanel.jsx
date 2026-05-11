import { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import CollapsibleSection from '../../../components/common/CollapsibleSection';
import {
  ANALYSIS_BUCKETS,
  SEVERITY_ORDER,
  SEVERITY_ROLLUP_LABEL,
} from '../analysisConstants';
import { CategoryAccordion } from './CategoryAccordion';

export function AnalysisFindingsPanel({ sortedIssues, byBucket, firstNonEmptyBucketId }) {
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
    return { severityLine, themeGroups };
  }, [sortedIssues, byBucket]);

  if (!sortedIssues.length || !rollups) return null;

  return (
    <CollapsibleSection
      idPrefix="analysis-findings"
      icon={ClipboardList}
      title="Analysis findings"
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
      panelClassName="max-h-[min(28rem,calc(100vh-12rem))] overflow-y-auto overscroll-contain px-2 pb-3 pt-3 sm:px-4 sm:pb-4"
    >
      <p className="mb-3 px-2 text-[11px] text-desk-muted sm:px-0">
        Themes below open individually. Long themes scroll inside their card — this panel scrolls for many themes.
      </p>
      <div className="flex flex-col gap-4">
        {ANALYSIS_BUCKETS.map((bucket) =>
          byBucket[bucket.id]?.length ? (
            <CategoryAccordion
              key={bucket.id}
              bucket={bucket}
              issues={byBucket[bucket.id]}
              initiallyOpen={bucket.id === firstNonEmptyBucketId}
            />
          ) : null
        )}
      </div>
    </CollapsibleSection>
  );
}
