import { useMemo } from 'react';
import { FileCode } from 'lucide-react';
import CollapsibleSection from '../../../components/common/CollapsibleSection';

export function FilesChangedPanel({ fileStats, emptyHint }) {
  const rollups = useMemo(() => {
    if (!fileStats?.length) return null;
    const totalAdd = fileStats.reduce((s, f) => s + (Number(f.additions) || 0), 0);
    const totalDel = fileStats.reduce((s, f) => s + (Number(f.deletions) || 0), 0);
    const withFindings = fileStats.filter((f) => Number(f.issues_count) > 0).length;
    return { totalAdd, totalDel, withFindings };
  }, [fileStats]);

  if (!fileStats?.length || !rollups) {
    if (!emptyHint) return null;
    return (
      <section
        className="card mb-6 overflow-hidden p-5 sm:p-6"
        aria-label="Changed files"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FileCode size={16} className="shrink-0 text-desk-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Changed files</h2>
        </div>
        <p className="text-sm leading-relaxed text-desk-muted">{emptyHint}</p>
      </section>
    );
  }

  return (
    <CollapsibleSection
      idPrefix="files-changed"
      icon={FileCode}
      title="Changed files"
      badge={fileStats.length}
      defaultExpanded={false}
      summary={
        <>
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{rollups.totalAdd}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums text-red-600 dark:text-[#ff7b72]">−{rollups.totalDel}</span>
          {rollups.withFindings > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums text-amber-900 dark:text-amber-300">
                {rollups.withFindings} with findings
              </span>
            </>
          ) : null}
        </>
      }
      panelClassName="max-h-72 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 sm:max-h-80"
    >
      <p className="mb-2 text-[11px] text-desk-muted">
        Per-file lines added/removed in the GitHub diff — scroll if the commit is large.
      </p>
      <div className="grid grid-cols-1 gap-px rounded-lg border border-desk-border bg-desk-border sm:grid-cols-2">
        {fileStats.map((f, idx) => (
          <div
            key={f.file_path || `changed-${idx}`}
            className="flex min-w-0 flex-col gap-1 bg-desk-panel p-3 sm:flex-row sm:items-center sm:gap-3"
          >
            <FileCode size={13} className="shrink-0 text-desk-subtle sm:mt-0" aria-hidden="true" />
            <span
              className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-800 dark:text-gray-200"
              title={f.file_path}
            >
              {f.file_path}
            </span>
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 font-mono text-[11px]">
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{f.additions}</span>
              <span className="tabular-nums text-red-600 dark:text-[#ff7b72]">−{f.deletions}</span>
              {f.issues_count > 0 ? (
                <span className="font-medium text-amber-900 tabular-nums dark:text-amber-300">
                  {f.issues_count} finding{f.issues_count === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
