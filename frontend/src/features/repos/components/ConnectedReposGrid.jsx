import { ConnectedRepoCard } from './ConnectedRepoCard';

export function ConnectedReposGrid({
  repos,
  busyReviewRepoId,
  busySyncWebhookId,
  syncAllWebhooksPending,
  disconnectPending,
  onReviewLatest,
  onSyncWebhook,
  onDisconnect,
}) {
  return (
    <div className="max-h-none overflow-visible lg:max-h-[min(40rem,calc(100vh-12rem))] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {repos.map((repo) => (
          <ConnectedRepoCard
            key={repo.id}
            repo={repo}
            busyReviewRepoId={busyReviewRepoId}
            busySyncWebhookId={busySyncWebhookId}
            syncAllWebhooksPending={syncAllWebhooksPending}
            disconnectPending={disconnectPending}
            onReviewLatest={onReviewLatest}
            onSyncWebhook={onSyncWebhook}
            onDisconnect={onDisconnect}
          />
        ))}
      </div>
    </div>
  );
}
