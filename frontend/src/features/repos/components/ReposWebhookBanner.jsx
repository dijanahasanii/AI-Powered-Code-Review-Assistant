import { RefreshCw } from 'lucide-react';
import { Spinner } from '../../../components/common/UI';

export function ReposWebhookBanner({
  connected,
  syncAllPending,
  onInstallAllWebhooks,
}) {
  const anyRepoMissingWebhook = connected.some((r) => !r.webhook_active);
  if (!anyRepoMissingWebhook) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-600/30 bg-amber-500/[0.12] px-4 py-4 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-amber-950 dark:text-amber-50">Push-to-review is off for at least one repo</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90">
          Webhooks register when GitHub gets a reachable <strong>BACKEND_URL</strong>, or use the installer below (no disconnect
          needed). Your tunnel must forward to <strong>the same PORT</strong> as the API (often 3001). See{' '}
          <strong>README §15</strong>.
        </p>
      </div>
      <button
        type="button"
        className="btn-primary shrink-0 whitespace-nowrap border border-amber-400/35 bg-amber-600 hover:bg-amber-500 text-sm shadow-md"
        disabled={syncAllPending || connected.every((r) => r.webhook_active)}
        onClick={onInstallAllWebhooks}
      >
        {syncAllPending ? (
          <>
            <Spinner size="sm" />
            Fixing…
          </>
        ) : (
          <>
            <RefreshCw size={15} aria-hidden="true" />
            Install webhooks (all)
          </>
        )}
      </button>
    </div>
  );
}
