import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { BarChart3 } from 'lucide-react';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card border-desk-subtle px-3 py-2 text-xs shadow-xl">
      <p className="text-desk-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {payload[0].value} findings
      </p>
    </div>
  );
};

function findingsMixSummary(chartRows) {
  const rows = chartRows ?? [];
  const total = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  if (!total) return <>No findings in aggregated stats yet.</>;
  const parts = rows
    .filter((r) => Number(r.value) > 0)
    .map((r) => `${r.name} ${Number(r.value).toLocaleString()}`);
  return (
    <>
      {total.toLocaleString()} total
      {parts.length ? (
        <>
          <span aria-hidden="true"> · </span>
          <span>{parts.join(' · ')}</span>
        </>
      ) : null}
    </>
  );
}

export function DashboardFindingsChart({ chartData, totalIssues }) {
  return (
    <CollapsibleSection
      idPrefix="dash-findings-mix"
      className="!mb-0 flex min-h-[16rem] flex-1 flex-col lg:min-h-0"
      icon={BarChart3}
      title="Findings mix"
      badge={totalIssues}
      expandable={false}
      summary={findingsMixSummary(chartData)}
      panelClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
    >
      <p className="mb-4 shrink-0 text-[11px] text-desk-muted">
        Issue counts by severity across your workspace (aggregated stats).
      </p>
      <div className="min-h-[176px] w-full min-w-0 flex-1 lg:min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={22} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <XAxis dataKey="name" tick={{ fill: '#57606a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#57606a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(87, 96, 106, 0.12)' }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CollapsibleSection>
  );
}
