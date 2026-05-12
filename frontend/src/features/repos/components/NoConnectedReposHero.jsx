import { Github, GitBranch, Sparkles } from 'lucide-react';

export function NoConnectedReposHero({ onConnect }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-desk-border bg-desk-panel shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.03] dark:shadow-black/30 dark:ring-white/[0.06]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.35]"
        aria-hidden="true"
      >
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(148_163_184/0.06)_1px,transparent_1px),linear-gradient(rgb(148_163_184/0.06)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(90deg,rgb(148_163_184/0.09)_1px,transparent_1px),linear-gradient(rgb(148_163_184/0.09)_1px,transparent_1px)]"
        aria-hidden="true"
      />

      <div className="relative px-6 py-14 sm:px-10 sm:py-16">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 scale-110 rounded-3xl bg-gradient-to-br from-brand-500/35 via-violet-500/25 to-emerald-500/20 blur-xl" aria-hidden="true" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-desk-elevated to-desk-panel shadow-inner dark:border-white/10">
              <Github size={30} className="text-gray-800 dark:text-gray-100" aria-hidden="true" />
            </div>
            <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-lg border border-desk-border bg-desk-panel shadow-md">
              <Sparkles size={14} className="text-brand-600 dark:text-brand-500" aria-hidden="true" />
            </span>
          </div>

          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-desk-border bg-desk-elevated/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-desk-muted backdrop-blur-sm">
            <GitBranch size={12} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
            Repositories
          </p>

          <h2 className="text-balance text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">
            No repositories connected yet.
          </h2>
          <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-desk-muted sm:text-base">
            Connect a GitHub repository to begin AI review analysis.
          </p>

          <button
            type="button"
            className="btn-primary mt-8 inline-flex items-center gap-2 px-5 py-2.5 text-sm shadow-md shadow-brand-600/25 transition hover:shadow-lg hover:shadow-brand-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-desk-panel"
            onClick={onConnect}
          >
            <Github size={18} aria-hidden="true" />
            Connect a repository
          </button>
        </div>
      </div>
    </div>
  );
}
