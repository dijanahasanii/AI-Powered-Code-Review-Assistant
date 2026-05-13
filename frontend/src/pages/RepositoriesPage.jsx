import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { reposApi, reviewsApi } from '../api/client';
import { describeApiFailure } from '../lib/apiErrors';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/common/UI';
import { RepoCardSkeleton } from '../components/common/Skeletons';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';
import { ReposWebhookBanner } from '../features/repos/components/ReposWebhookBanner';
import { ReviewHintBanner } from '../features/repos/components/ReviewHintBanner';
import { GitHubRepoPicker } from '../features/repos/components/GitHubRepoPicker';
import { ConnectedReposGrid } from '../features/repos/components/ConnectedReposGrid';
import { NoConnectedReposHero } from '../features/repos/components/NoConnectedReposHero';
import { queryKeys } from '../lib/queryKeys';

export default function RepositoriesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [reviewHint, setReviewHint] = useState(null);
  const [confirmRepo, setConfirmRepo] = useState(null);
  const [connectingId, setConnectingId] = useState(null);

  const {
    data: connected = [],
    isLoading,
    isError: reposError,
    refetch: refetchRepos,
  } = useQuery({
    queryKey: queryKeys.repos,
    queryFn: () => reposApi.list().then((r) => r.data.data ?? []),
    staleTime: 45_000,
  });

  const {
    data: githubRepos = [],
    isLoading: loadingGithub,
    error: githubError,
    refetch: refetchGithub,
  } = useQuery({
    queryKey: queryKeys.reposGithub,
    queryFn: () => reposApi.listGithub().then((r) => r.data.data ?? []),
    enabled: showPicker,
    staleTime: 60_000,
  });

  const connectedIds = useMemo(() => new Set(connected.map((r) => r.github_repo_id)), [connected]);

  const connectMutation = useMutation({
    mutationFn: (repo) =>
      reposApi
        .connect({
          githubRepoId: repo.githubRepoId,
          fullName: repo.fullName,
          name: repo.name,
          description: repo.description,
          language: repo.language,
          isPrivate: repo.isPrivate,
        })
        .then((r) => r.data.data),
    onMutate: (repo) => setConnectingId(repo.githubRepoId),
    onSuccess: (data, repo) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos });
      toast.success(
        'Repository connected',
        `${repo.fullName} is linked. Webhooks fire on push when your callback URL and secret are valid.`
      );
      setShowPicker(false);
      setReviewHint(null);
      if (!data?.webhook_active) {
        setReviewHint({
          tone: 'info',
          text:
            'Webhook did not register on connect — set BACKEND_URL + GITHUB_WEBHOOK_SECRET in backend/.env and click “Install webhook” or “Install webhooks (all)” on Repositories.',
        });
      }
    },
    onError: (err, repoVariables) => {
      const repoLabel = repoVariables?.fullName ?? 'repository';
      const { title, detail } = describeApiFailure(err, { resourceLabel: `connecting ${repoLabel}` });
      toast.error(title, detail);
    },
    onSettled: () => setConnectingId(null),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id) => reposApi.disconnect(id),
    onSuccess: async (_, id) => {
      const name = connected.find((r) => r.id === id)?.full_name ?? 'Repository';

      await queryClient.cancelQueries({ queryKey: queryKeys.repos });
      queryClient.setQueryData(queryKeys.repos, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((r) => r.id !== id);
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll, refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stats, refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['review'], refetchType: 'none' }),
      ]);

      toast.success('Disconnected', `${name} has been removed from review automation.`);
      setConfirmRepo(null);
      setReviewHint(null);
    },
    onError: (err) => {
      const { title, detail } = describeApiFailure(err, { resourceLabel: 'disconnecting the repository' });
      toast.error(title, detail);
    },
  });

  const syncWebhookMutation = useMutation({
    mutationFn: (repositoryId) => reposApi.syncWebhook(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos });
      toast.success('Webhook verified', 'GitHub can deliver push events to your API for this repo.');
      setReviewHint(null);
    },
    onError: (err) => {
      const { title, detail } = describeApiFailure(err, { resourceLabel: 'webhook installation' });
      toast.error(title, detail);
    },
  });

  const syncAllWebhooksMutation = useMutation({
    mutationFn: async () => {
      const repos = await reposApi.list().then((r) => r.data.data ?? []);
      const targets = repos.filter((x) => !x.webhook_active);
      let ok = 0;
      let lastMsg = '';
      for (const r of targets) {
        try {
          await reposApi.syncWebhook(r.id);
          ok += 1;
        } catch (e) {
          lastMsg = e.response?.data?.error || e.message || 'Request failed';
        }
      }
      return { ok, total: targets.length, lastMsg };
    },
    onSuccess: ({ ok, total, lastMsg }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos });
      if (total === 0) {
        toast.success('Already configured', 'Each connected repo reports an active webhook.');
      } else if (ok === total) {
        toast.success('Webhooks updated', `${ok} repository webhook${ok !== 1 ? 's' : ''} registered.`);
        setReviewHint(null);
      } else {
        toast.warning(
          'Some webhooks failed',
          `${ok}/${total} installed.${lastMsg ? ` Last error: ${lastMsg}` : ''}`
        );
      }
    },
  });

  const triggerLatestMutation = useMutation({
    mutationFn: (repositoryId) => {
      if (repositoryId == null) return Promise.reject(new Error('Missing repository'));
      return reviewsApi.triggerLatest(repositoryId);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });

      toast.success('Review started', 'Queued on the default branch — open Reviews to watch it run.');
      const meta = res?.data?.meta || {};
      if (meta.duplicatePending) {
        setReviewHint({
          tone: 'info',
          text:
            'A review is already running or queued — open Reviews to finish watching it before starting another duplicate.',
        });
      } else if (meta.reanalysis) {
        setReviewHint({
          tone: 'success',
          text: 'Fresh analysis queued — open Reviews and click through to the detail view for findings.',
        });
      } else {
        setReviewHint({
          tone: 'success',
          text: 'Queued on the repository’s default branch. Watch the Reviews list until status shows completed.',
        });
      }
    },
    onError: (err) => {
      const { title, detail } = describeApiFailure(err, { resourceLabel: 'the review queue' });
      toast.error(title, detail);
      setReviewHint({ tone: 'error', text: detail });
    },
  });

  const filtered = useMemo(
    () => githubRepos.filter((r) => r.fullName.toLowerCase().includes(search.toLowerCase())),
    [githubRepos, search]
  );

  const busyReviewRepoId = triggerLatestMutation.isPending ? triggerLatestMutation.variables : null;
  const busySyncWebhookId = syncWebhookMutation.isPending ? syncWebhookMutation.variables : null;

  const reposLoadFailure = reposError ? describeApiFailure(reposError, { resourceLabel: 'connected repositories' }) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <ReposWebhookBanner
        connected={connected}
        syncAllPending={syncAllWebhooksMutation.isPending}
        onInstallAllWebhooks={() => syncAllWebhooksMutation.mutate()}
      />

      <ReviewHintBanner hint={reviewHint} />

      <PageHeader
        title="Repositories"
        description="Pushes queue automatically whenever the webhook is healthy. Trigger “Review latest” for immediate feedback on your default branch without waiting for CI."
        hint={
          user?.username
            ? `Repos and webhooks belong to GitHub OAuth for @${user.username}. Org repos need admin rights to install hooks.`
            : 'Webhooks install only on repos where your GitHub user can administer hooks.'
        }
        action={
          <button
            type="button"
            disabled={disconnectMutation.isPending}
            aria-busy={connectMutation.isPending}
            className="btn-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-canvas disabled:opacity-50 dark:focus-visible:ring-offset-desk-panel"
            onClick={() => setShowPicker((v) => !v)}
          >
            <Plus size={16} aria-hidden="true" />
            {showPicker ? 'Close picker' : 'Connect repo'}
          </button>
        }
      />

      {showPicker && (
        <GitHubRepoPicker
          search={search}
          onSearchChange={setSearch}
          loadingGithub={loadingGithub}
          githubError={githubError}
          onRefetchGithub={refetchGithub}
          filteredRepos={filtered}
          connectedIds={connectedIds}
          connectingId={connectingId}
          connectMutationPending={connectMutation.isPending}
          onConnectRepo={(repo) => connectMutation.mutate(repo)}
        />
      )}

      {reposError ? (
        <div
          className="card overflow-hidden p-10 text-center"
          role="alert"
          aria-live="polite"
        >
          <p className="mb-1 text-sm font-semibold text-red-900 dark:text-red-200">{reposLoadFailure.title}</p>
          <p className="mb-3 text-sm text-red-800 dark:text-red-300">{reposLoadFailure.detail}</p>
          <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={() => refetchRepos()}>
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <RepoCardSkeleton key={idx} />
          ))}
        </div>
      ) : connected.length === 0 ? (
        <NoConnectedReposHero onConnect={() => setShowPicker(true)} />
      ) : (
        <ConnectedReposGrid
          repos={connected}
          busyReviewRepoId={busyReviewRepoId}
          busySyncWebhookId={busySyncWebhookId}
          syncAllWebhooksPending={syncAllWebhooksMutation.isPending}
          disconnectPending={disconnectMutation.isPending}
          onReviewLatest={(id) => triggerLatestMutation.mutate(id)}
          onSyncWebhook={(id) => syncWebhookMutation.mutate(id)}
          onDisconnect={(repo) => setConfirmRepo(repo)}
        />
      )}

      <ConfirmDialog
        open={!!confirmRepo}
        danger
        title="Disconnect repository?"
        message={`This removes "${confirmRepo?.full_name}", deletes its webhook, and stops automated reviews.`}
        confirmLabel="Disconnect"
        onConfirm={() => {
          if (confirmRepo?.id == null) return;
          disconnectMutation.mutate(confirmRepo.id);
        }}
        onCancel={() => setConfirmRepo(null)}
      />
    </div>
  );
}
