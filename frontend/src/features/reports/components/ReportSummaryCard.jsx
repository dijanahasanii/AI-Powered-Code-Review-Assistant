import { FileBarChart } from 'lucide-react';

export function ReportSummaryCard({ summary }) {
  if (!summary?.trim()) return null;

  return (
    <section className="mb-10" aria-labelledby="report-summary-heading">
      <div className="flex items-center gap-2">
        <FileBarChart size={16} className="text-brand-400" aria-hidden="true" />
        <h2 id="report-summary-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Summary
        </h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-desk-muted whitespace-pre-wrap">{summary}</p>
    </section>
  );
}
