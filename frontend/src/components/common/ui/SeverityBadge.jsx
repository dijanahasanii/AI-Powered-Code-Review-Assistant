import { SEVERITY_TIER_DOT, SEVERITY_TIER_LABEL } from '../../../features/reviews/analysisConstants';

export const SeverityBadge = ({ severity, plainLanguage, showTierDot = true }) => {
  const map = {
    critical: 'badge-critical',
    warning: 'badge-warning',
    info: 'badge-info',
    suggestion: 'badge-suggestion',
  };
  const tierLabel = SEVERITY_TIER_LABEL[severity];
  const label =
    plainLanguage && tierLabel ? tierLabel : severity;
  const dotClass = SEVERITY_TIER_DOT[severity] ?? SEVERITY_TIER_DOT.info;
  const a11yLabel = tierLabel ? `${tierLabel} severity` : `${String(severity)} severity`;

  return (
    <span className={`inline-flex items-center gap-1.5 ${map[severity] || 'badge-info'}`} aria-label={a11yLabel}>
      {showTierDot && (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
          aria-hidden="true"
          title={tierLabel ? `${tierLabel} severity` : undefined}
        />
      )}
      <span>{label}</span>
    </span>
  );
};
