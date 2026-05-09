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
} from 'lucide-react';
import { reposApi, reviewsApi } from '../api/client';
import { Spinner, EmptyState, PageHeader } from '../components/common/UI';
import { RepoRowSkeleton } from '../components/common/Skeletons';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

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
            'Webhook was not installed (BACKEND_URL missing or not public). Add your ngrok HTTPS URL to backend .env, restart, disconnect this repo and connect again. Open WEBHOOK_QUICKSTART.md in the project root for step-by-step.',
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
      const msg = err.response?.data?.error || 'Failed to disconnect repository.';
      toast.error('Disconnect failed', msg);
      setConfirmRepo(null);
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {anyRepoMissingWebhook && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-amber-500/35 bg-amber-500/10 text-sm text-amber-100">
          <p className="font-medium text-amber-50">Push-to-review is off for at least one repo</p>
          <p className="text-xs text-amber-100/90 mt-1">
            GitHub needs a public URL to reach your backend. Run ngrok, set{' '}
            <code className="text-gray-400">BACKEND_URL</code> and{' '}
            <code className="text-gray-400">GITHUB_WEBHOOK_SECRET</code> in{' '}
            <code className="text-gray-400">backend/.env</code>, restart the API, then disconnect and reconnect each
            impacted repo. Follow <strong>WEBHOOK_QUICKSTART.md</strong> inside the workspace.
          </p>
        </div>
      )}

      {reviewHint && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg border text-sm ${
            reviewHint.tone === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : reviewHint.tone === 'info'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          <p>{reviewHint.text}</p>
          <Link to="/reviews" className="mt-2 inline-block text-xs underline font-medium">
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
        <div className="card mb-6 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Pick a repo from GitHub</h2>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search repositories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search GitHub repositories"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {loadingGithub ? (
            <div className="flex items-center justify-center py-8 gap-3 text-gray-500 text-sm">
              <Spinner size="sm" />
              Loading repositories…
            </div>
          ) : githubError ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center px-4">
              <p className="text-sm text-red-400">Unable to fetch GitHub repositories.</p>
              <button type="button" onClick={() => refetchGithub()} className="btn-secondary text-xs py-1.5 px-3 inline-flex gap-2">
                <RefreshCw size={12} aria-hidden="true" />
                Retry GitHub lookup
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-800" role="list">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8 px-4">
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
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-800/30 transition-colors"
                    >
                      {repo.isPrivate ? (
                        <Lock size={13} className="text-gray-500 shrink-0" aria-label="Private" />
                      ) : (
                        <Globe size={13} className="text-gray-500 shrink-0" aria-label="Public" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{repo.fullName}</p>
                        {repo.language && <p className="text-xs text-gray-500">{repo.language}</p>}
                      </div>
                      {alreadyLinked ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 shrink-0">
                          <CheckCircle2 size={12} aria-hidden="true" /> Connected
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 px-3 shrink-0 min-w-[88px] justify-center inline-flex"
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
        <div className="card p-8 text-center">
          <p className="text-sm text-red-300 mb-3">Could not load connected repositories.</p>
          <button type="button" className="btn-secondary text-xs py-2 px-4" onClick={() => refetchRepos()}>
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <RepoRowSkeleton key={idx} />
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
        <div className="space-y-2" role="list">
          {connected.map((repo) => {
            const completedReviews = (repo.code_reviews ?? [])
              .filter((r) => r.status === 'completed')
              .sort((a, b) => {
                const tb = new Date(b.created_at ?? 0).getTime();
                const ta = new Date(a.created_at ?? 0).getTime();
                return tb - ta;
              });
            const latestScore = completedReviews[0]?.overall_score;

            return (
              <div
                key={repo.id}
                role="listitem"
                className="card px-4 sm:px-5 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex flex-1 min-w-0 gap-3 sm:gap-4 sm:items-center">
                  {repo.is_private ? (
                    <Lock size={15} className="text-gray-500 shrink-0 mt-1 sm:mt-0" aria-label="Private repository" />
                  ) : (
                    <Globe size={15} className="text-gray-500 shrink-0 mt-1 sm:mt-0" aria-label="Public repository" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-100 break-all">{repo.full_name}</p>
                      {repo.webhook_active && (
                        <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/25 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          webhook active
                        </span>
                      )}
                      {!repo.webhook_active && (
                        <span className="text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          no webhook
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {[
                        repo.language,
                        `${repo.code_reviews?.length ?? 0} review${repo.code_reviews?.length !== 1 ? 's' : ''}`,
                        completedReviews.length
                          ? latestScore != null
                            ? `Latest score · ${latestScore}/100`
                            : `Latest · not scored (diff too tiny or empty)`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-1 justify-end shrink-0">
                  <button
                    type="button"
                    title="Review latest commit on default branch"
                    onClick={() => triggerLatestMutation.mutate(repo.id)}
                    disabled={busyReviewRepoId === repo.id}
                    className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5"
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
                    className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10 disabled:opacity-40"
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
