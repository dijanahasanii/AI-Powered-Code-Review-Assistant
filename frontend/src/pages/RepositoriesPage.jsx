import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Globe,
  Sparkles,
  Search,
  RefreshCw,
  Activity,
  AlertOctagon,
} from 'lucide-react';
import clsx from 'clsx';
import { reposApi, reviewsApi } from '../api/client';
import { Spinner, EmptyState, PageHeader } from '../components/common/UI';
import { RepoCardSkeleton } from '../components/common/Skeletons';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

function repoHealthStatus(repo) {
  const completedReviews = (repo.code_reviews ?? [])
    .filter((r) => r.status === 'completed')
    .sort((a, b) => {
      const tb = new Date(b.created_at ?? 0).getTime();
      const ta = new Date(a.created_at ?? 0).getTime();
      return tb - ta;
    });
  const latestScore = completedReviews[0]?.overall_score;

  if (!repo.webhook_active) {
    return {
      key: 'webhook',
      label: 'Webhook off',
      detail: 'Push automation unavailable',
      className:
        'border-amber-600/30 bg-amber-500/[0.12] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100',
      dot: 'bg-amber-500 dark:bg-amber-400',
    };
  }
  if (latestScore != null && latestScore < 70) {
    return {
      key: 'findings',
      label: 'Findings',
      detail: `Latest score ${latestScore}/100`,
      className:
        'border-orange-600/30 bg-orange-500/[0.12] text-orange-950 dark:border-orange-500/35 dark:bg-orange-500/10 dark:text-orange-100',
      dot: 'bg-orange-600 dark:bg-orange-400',
    };
  }
  if (latestScore != null && latestScore >= 90) {
    return {
      key: 'healthy',
      label: 'Healthy',
      detail: 'Recent scan looks strong',
      className:
        'border-emerald-600/30 bg-emerald-500/[0.14] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100',
      dot: 'bg-emerald-600 dark:bg-emerald-400',
    };
  }
  return {
    key: 'synced',
    label: 'Synced',
    detail: 'Webhook active — monitoring pushes',
    className: 'border-desk-border bg-desk-elevated/60 text-gray-800 dark:text-gray-200',
    dot: 'bg-[#58a6ff]',
  };
}

export default function RepositoriesPage() {
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
    queryKey: ['repos'],
    queryFn: () => reposApi.list().then((r) => r.data.data ?? []),
  });

  const {
    data: githubRepos = [],
    isLoading: loadingGithub,
    error: githubError,
    refetch: refetchGithub,
  } = useQuery({
    queryKey: ['repos-github'],
    queryFn: () => reposApi.listGithub().then((r) => r.data.data ?? []),
    enabled: showPicker,
    staleTime: 60_000,
  });

  const connectedIds = new Set(connected.map((r) => r.github_repo_id));

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
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      toast.success('Repository connected', `${repo.fullName} is now active.`);
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
      const msg = err.response?.data?.error || 'Failed to connect repository.';
      toast.error('Connection failed', `${repoLabel}: ${msg}`);
    },
    onSettled: () => setConnectingId(null),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id) => reposApi.disconnect(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      const name = connected.find((r) => r.id === id)?.full_name ?? 'Repository';
      toast.success('Disconnected', `${name} has been removed from review automation.`);
      setConfirmRepo(null);
      setReviewHint(null);
    },
    onError: (err) => {
      const data = err.response?.data;
      const msg =
        (data && typeof data.error === 'string' && data.error) ||
        (Array.isArray(data?.errors) && data.errors[0]?.msg) ||
        err.message ||
        'Failed to disconnect repository.';
      toast.error('Disconnect failed', msg);
    },
  });

  const syncWebhookMutation = useMutation({
    mutationFn: (repositoryId) => reposApi.syncWebhook(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      toast.success('Webhook installed', 'GitHub push events can reach your API for this repo.');
      setReviewHint(null);
    },
    onError: (err) => {
      toast.error(
        'Webhook install failed',
        err.response?.data?.error || err.message || 'Check BACKEND_URL, ngrok, and GITHUB_WEBHOOK_SECRET.'
      );
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
      queryClient.invalidateQueries({ queryKey: ['repos'] });
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
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });

      toast.success('Review queued', 'Open Reviews to monitor progress.');
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
      const msg = err.response?.data?.error || err.message || 'Request failed';
      toast.error('Could not queue review', msg);
      setReviewHint({ tone: 'error', text: msg });
    },
  });

  const filtered = githubRepos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const anyRepoMissingWebhook = connected.some((r) => !r.webhook_active);
  const busyReviewRepoId = triggerLatestMutation.isPending ? triggerLatestMutation.variables : null;
  const busySyncWebhookId = syncWebhookMutation.isPending ? syncWebhookMutation.variables : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {anyRepoMissingWebhook && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-amber-50">Push-to-review is off for at least one repo</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
              Webhooks register when GitHub gets a reachable <strong>BACKEND_URL</strong>, or use the installer below
              (no disconnect needed). Your tunnel must forward to <strong>the same PORT</strong> as the API (often 3001). See{' '}
              <strong>WEBHOOK_QUICKSTART.md</strong> at the repo root.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 whitespace-nowrap border border-amber-400/35 bg-amber-600 hover:bg-amber-500 text-sm shadow-md"
            disabled={syncAllWebhooksMutation.isPending || connected.every((r) => r.webhook_active)}
            onClick={() => syncAllWebhooksMutation.mutate()}
          >
            {syncAllWebhooksMutation.isPending ? (
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
      )}

      {reviewHint && (
        <div
          className={clsx(
            'mb-4 rounded-md border px-4 py-3 text-sm',
            reviewHint.tone === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : reviewHint.tone === 'info'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          )}
        >
          <p>{reviewHint.text}</p>
          <Link to="/reviews" className="mt-2 inline-block text-xs font-medium underline">
            Jump to Reviews
          </Link>
        </div>
      )}

      <PageHeader
        title="Repositories"
        description="Pushes queue automatically whenever the webhook is healthy. Trigger “Review latest” for immediate feedback on your default branch without waiting for CI."
        action={
          <button type="button" className="btn-primary" onClick={() => setShowPicker((v) => !v)}>
            <Plus size={16} aria-hidden="true" />
            {showPicker ? 'Close picker' : 'Connect repo'}
          </button>
        }
      />

      {showPicker && (
        <div className="card mb-8 overflow-hidden">
          <div className="border-b border-desk-border px-4 py-4 sm:px-5">
            <h2 className="mb-3 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
              Pick a repo from GitHub
            </h2>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-desk-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search repositories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search GitHub repositories"
                className="w-full rounded-md border border-desk-border bg-desk-canvas py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-desk-muted focus:border-brand-600/60 focus:outline-none focus:ring-1 focus:ring-brand-600/40 dark:text-gray-200"
              />
            </div>
          </div>

          {loadingGithub ? (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-desk-muted">
              <Spinner size="sm" />
              Loading repositories…
            </div>
          ) : githubError ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-red-400">Unable to fetch GitHub repositories.</p>
              <button
                type="button"
                onClick={() => refetchGithub()}
                className="btn-secondary inline-flex gap-2 px-3 py-1.5 text-xs"
              >
                <RefreshCw size={12} aria-hidden="true" />
                Retry GitHub lookup
              </button>
            </div>
          ) : (
            <div className="max-h-80 divide-y divide-desk-border overflow-y-auto" role="list">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-desk-muted">
                  {search ? 'No repos match your search.' : 'No repositories returned for this OAuth token.'}
                </p>
              ) : (
                filtered.map((repo) => {
                  const alreadyLinked = connectedIds.has(repo.githubRepoId);
                  const busy = connectingId === repo.githubRepoId;

                  return (
                    <div
                      key={repo.githubRepoId}
                      role="listitem"
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-desk-elevated/50 sm:px-5"
                    >
                      {repo.isPrivate ? (
                        <Lock size={13} className="shrink-0 text-desk-muted" aria-label="Private" />
                      ) : (
                        <Globe size={13} className="shrink-0 text-desk-muted" aria-label="Public" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{repo.fullName}</p>
                        {repo.language && <p className="text-xs text-desk-muted">{repo.language}</p>}
                      </div>
                      {alreadyLinked ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-400/95">
                          <CheckCircle2 size={12} aria-hidden="true" /> Connected
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary inline-flex min-w-[88px] shrink-0 justify-center px-3 py-1 text-xs"
                          onClick={() => connectMutation.mutate(repo)}
                          disabled={busy || connectMutation.isPending}
                          aria-label={`Connect ${repo.fullName}`}
                        >
                          {busy ? <Spinner size="sm" /> : 'Connect'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {reposError ? (
        <div className="card p-10 text-center">
          <p className="mb-3 text-sm text-red-300">Could not load connected repositories.</p>
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
        <EmptyState
          icon={GitBranch}
          title="No repositories connected"
          description="Connect a GitHub repository to start collecting automated AI reviews on pushes."
          action={
            <button type="button" className="btn-primary" onClick={() => setShowPicker(true)}>
              <Plus size={16} aria-hidden="true" />
              Connect your first repo
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {connected.map((repo) => {
            const completedReviews = (repo.code_reviews ?? [])
              .filter((r) => r.status === 'completed')
              .sort((a, b) => {
                const tb = new Date(b.created_at ?? 0).getTime();
                const ta = new Date(a.created_at ?? 0).getTime();
                return tb - ta;
              });
            const latestScore = completedReviews[0]?.overall_score;
            const status = repoHealthStatus(repo);

            return (
              <div
                key={repo.id}
                role="listitem"
                className="card card-interactive flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3 border-b border-desk-border pb-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {repo.is_private ? (
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
                        <Lock size={16} className="text-desk-muted" aria-label="Private repository" />
                      </div>
                    ) : (
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-desk-border bg-desk-canvas">
                        <Globe size={16} className="text-desk-muted" aria-label="Public repository" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="break-words font-mono text-[13px] font-semibold leading-snug text-gray-900 dark:text-gray-50">
                        {repo.full_name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-[12px]">
                  <div className="flex items-start gap-2 text-desk-muted">
                    <Activity size={14} className="mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Status detail</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{status.detail}</dd>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-desk-muted">
                    {repo.language && <span className="rounded border border-desk-border bg-desk-canvas px-1.5 py-0">{repo.language}</span>}
                    <span className="tabular-nums">{repo.code_reviews?.length ?? 0} review runs</span>
                    {completedReviews.length > 0 &&
                      (latestScore != null ? (
                        <span className="tabular-nums text-gray-600 dark:text-gray-400">
                          Latest {latestScore}/100
                        </span>
                      ) : (
                        <span className="tabular-nums text-gray-600 dark:text-gray-500">Latest · not scored</span>
                      ))}
                  </div>
                </dl>

                {status.key === 'webhook' && (
                  <>
                    <p className="mt-4 flex gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-snug text-amber-950 dark:text-amber-50/95">
                      <AlertOctagon size={14} className="mt-0.5 shrink-0 opacity-90" aria-hidden="true" />
                      Use Install webhook once{' '}
                      <code className="font-mono text-amber-900 dark:text-amber-200/95">BACKEND_URL</code> is public and
                      ngrok is
                      running — or disconnect/reconnect after env changes.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary mt-3 w-full justify-center gap-2 border border-amber-500/30 px-3 py-2 text-xs font-semibold hover:border-amber-400/50"
                      disabled={busySyncWebhookId === repo.id || syncAllWebhooksMutation.isPending}
                      onClick={() => syncWebhookMutation.mutate(repo.id)}
                    >
                      {busySyncWebhookId === repo.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <RefreshCw size={14} aria-hidden="true" />
                      )}
                      Install webhook
                    </button>
                  </>
                )}

                <div className="mt-auto flex gap-2 border-t border-desk-border pt-4">
                  <button
                    type="button"
                    title="Review latest commit on default branch"
                    onClick={() => triggerLatestMutation.mutate(repo.id)}
                    disabled={busyReviewRepoId === repo.id}
                    className="btn-secondary inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium"
                  >
                    {busyReviewRepoId === repo.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <Sparkles size={13} aria-hidden="true" />
                    )}
                    Review latest
                  </button>
                  <button
                    type="button"
                    aria-label={`Disconnect ${repo.full_name}`}
                    onClick={() => setConfirmRepo(repo)}
                    disabled={disconnectMutation.isPending}
                    className="rounded-md border border-transparent p-2 text-desk-muted transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
