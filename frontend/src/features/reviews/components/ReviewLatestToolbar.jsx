import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Sparkles } from 'lucide-react';
import { reposApi, reviewsApi } from '../../../api/client';
import { describeApiFailure } from '../../../lib/apiErrors';
import { queryKeys } from '../../../lib/queryKeys';
import { useToast } from '../../../components/common/Toast';
import { Spinner } from '../../../components/common/UI';

/**
 * Manual "Review latest" control — same API as Repositories → ConnectedRepoCard.
 */
export function ReviewLatestToolbar() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [repositoryId, setRepositoryId] = useState('');
  const [branch, setBranch] = useState('');
  const [loadBranches, setLoadBranches] = useState(false);

  const reposQuery = useQuery({
    queryKey: queryKeys.repos,
    queryFn: () => reposApi.list().then((r) => r.data.data ?? []),
    staleTime: 60_000,
  });

  const repos = reposQuery.data ?? [];

  useEffect(() => {
    if (!repositoryId && repos.length > 0) {
      setRepositoryId(repos[0].id);
    }
  }, [repos, repositoryId]);

  useEffect(() => {
    setBranch('');
  }, [repositoryId]);

  const { data: branchData, isLoading: branchesLoading } = useQuery({
    queryKey: queryKeys.repoBranches(repositoryId),
    queryFn: () => reposApi.listBranches(repositoryId).then((r) => r.data.data),
    enabled: Boolean(repositoryId) && loadBranches,
    staleTime: 120_000,
  });

  const defaultBranch = branchData?.defaultBranch;
  const otherBranches = (branchData?.branches ?? []).filter((name) => name !== defaultBranch);

  const triggerMutation = useMutation({
    mutationFn: () => {
      if (!repositoryId) return Promise.reject(new Error('Select a repository'));
      return reviewsApi.triggerLatest(repositoryId, branch || undefined);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });

      const repo = repos.find((r) => r.id === repositoryId);
      const branchNote = branch ? `branch ${branch}` : 'the default branch';
      toast.success(
        'Review started',
        `Queued ${repo?.full_name ?? 'repository'} on ${branchNote} — refresh this list when status is completed.`
      );

      const meta = res?.data?.meta || {};
      if (meta.duplicatePending) {
        toast.info('Already queued', 'A review for this commit is already pending or running.');
      } else if (meta.reanalysis) {
        toast.info('Re-analysis', 'Latest commit was scanned again — open the newest row below.');
      }
    },
    onError: (err) => {
      const { title, detail } = describeApiFailure(err, { resourceLabel: 'review latest' });
      toast.error(title, detail);
    },
  });

  const selectedRepo = repos.find((r) => r.id === repositoryId);
  const busy = triggerMutation.isPending;

  if (reposQuery.isPending) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-desk-border bg-desk-panel/60 px-4 py-3 text-sm text-desk-muted">
        <Spinner size="sm" />
        Loading repositories…
      </div>
    );
  }

  if (!repos.length) {
    return (
      <div className="mb-6 rounded-xl border border-desk-border bg-desk-panel/60 px-4 py-3 sm:px-5">
        <p className="text-sm text-desk-muted">
          Connect a repository to run <strong className="font-medium text-gray-800 dark:text-gray-200">Review latest</strong>{' '}
          on the newest commit (for example after fixes were pushed).
        </p>
        <Link
          to="/repositories"
          className="mt-2 inline-flex text-sm font-medium text-brand-400 hover:text-brand-300"
        >
          Go to Repositories →
        </Link>
      </div>
    );
  }

  const defaultLabel =
    branchesLoading && loadBranches
      ? 'Loading branches…'
      : defaultBranch
        ? `Default (${defaultBranch})`
        : 'Default branch';

  return (
    <div className="mb-6 rounded-xl border border-desk-border bg-desk-panel/60 px-4 py-4 sm:px-5">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Review latest commit</p>
      <p className="mt-1 text-xs leading-relaxed text-desk-muted">
        Scan the newest commit on a branch — use this after a fix push to see an updated score and findings.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[12rem] flex-1 text-[11px] font-medium text-desk-muted">
          Repository
          <select
            value={repositoryId}
            onChange={(e) => setRepositoryId(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-desk-border bg-desk-canvas px-2 py-1.5 font-mono text-[11px] text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50 dark:text-gray-100"
            aria-label="Repository for review latest"
          >
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[10rem] flex-1 text-[11px] font-medium text-desk-muted">
          <span className="mb-1 flex items-center gap-1">
            <GitBranch size={12} aria-hidden="true" />
            Branch
          </span>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            onFocus={() => setLoadBranches(true)}
            disabled={busy || !repositoryId}
            className="mt-0 w-full rounded-md border border-desk-border bg-desk-canvas px-2 py-1.5 font-mono text-[11px] text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-50 dark:text-gray-100"
            aria-label={selectedRepo ? `Branch for ${selectedRepo.full_name}` : 'Branch'}
          >
            <option value="">{defaultLabel}</option>
            {otherBranches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          title="Review latest commit on selected branch"
          aria-label={
            selectedRepo
              ? `Review latest commit for ${selectedRepo.full_name}`
              : 'Review latest commit'
          }
          aria-busy={busy}
          disabled={busy || !repositoryId}
          onClick={() => triggerMutation.mutate()}
          className="btn-primary inline-flex min-h-[2.25rem] w-full items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium sm:w-auto sm:min-w-[10rem]"
        >
          {busy ? <Spinner size="sm" /> : <Sparkles size={14} aria-hidden="true" />}
          Review latest
        </button>
      </div>
    </div>
  );
}
