import clsx from 'clsx';

export function Bone({ className, style }) {
  return (
    <div
      style={style}
      className={clsx(
        'animate-pulse rounded-md bg-desk-elevated/95 dark:bg-desk-elevated/80',
        className
      )}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card flex flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <Bone className="h-3 w-20" />
        <Bone className="h-8 w-8 shrink-0 rounded-lg" />
      </div>
      <Bone className="mb-1 h-7 w-12" />
      <Bone className="h-3 w-28" />
    </div>
  );
}

export function DashboardActivitySkeleton() {
  return (
    <div className="flex flex-col bg-desk-panel p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <Bone className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-16 rounded-full" />
          </div>
          <Bone className="h-3 w-3/4 max-w-[220px]" />
        </div>
      </div>
      <Bone className="mt-6 h-3 w-24" />
    </div>
  );
}

export function ReviewCardSkeleton() {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start gap-4">
        <Bone className="h-12 w-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-4 w-14 rounded-full" />
          </div>
          <Bone className="h-3 w-4/5 max-w-[200px]" />
          <Bone className="h-3 w-[40%]" />
        </div>
      </div>
      <div className="mt-6 flex justify-between border-t border-desk-border pt-4">
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ReviewRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Bone className="h-11 w-11 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-24" />
        <Bone className="h-3 w-40" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="hidden h-3 w-20 sm:block" />
      </div>
    </div>
  );
}

export function RepoRowSkeleton() {
  return (
    <div className="card flex items-center gap-4 px-5 py-4">
      <Bone className="h-4 w-4 shrink-0 rounded" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-40" />
        <Bone className="h-3 w-24" />
      </div>
      <Bone className="h-7 w-7 rounded-lg" />
    </div>
  );
}

export function RepoCardSkeleton() {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <Bone className="h-10 w-10 rounded-md" />
        <Bone className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Bone className="h-4 w-[70%]" />
        <Bone className="h-3 w-[45%]" />
      </div>
      <div className="mt-6 flex gap-2">
        <Bone className="h-8 flex-1 rounded-lg" />
        <Bone className="h-8 w-10 rounded-lg" />
      </div>
    </div>
  );
}

export function GitHubRepoPickerRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-desk-border px-4 py-3.5 sm:px-5">
      <Bone className="h-4 w-4 shrink-0 rounded" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className="h-3.5 w-[min(100%,14rem)]" />
        <Bone className="h-2.5 w-16" />
      </div>
      <Bone className="h-7 w-[5.5rem] shrink-0 rounded-md" />
    </div>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Bone className="h-4 w-32" />
      <div className="card overflow-hidden p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <Bone className="h-6 w-full max-w-md rounded-lg sm:h-7" />
          <Bone className="h-5 w-48 rounded-lg" />
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Bone className="h-[60px] w-[60px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Bone className="h-5 w-36" />
              <Bone className="h-5 w-20 rounded-full" />
            </div>
            <Bone className="h-3.5 w-full max-w-lg" />
            <Bone className="h-3 w-44" />
          </div>
        </div>
        <div className="mt-6 space-y-2 border-t border-desk-border pt-5">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-[92%]" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Bone className="h-7 w-24 rounded-full" />
          <Bone className="h-7 w-28 rounded-full" />
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-desk-border px-4 py-3 sm:px-5">
          <Bone className="h-4 w-40" />
          <Bone className="mt-2 h-3 w-full max-w-xl" />
        </div>
        <div className="divide-y divide-desk-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Bone className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Bone className="h-5 w-20 rounded-full" />
                    <Bone className="h-4 w-[min(100%,12rem)]" />
                  </div>
                  <Bone className="h-3 w-32" />
                  <Bone className="h-3 w-full" />
                  <Bone className="h-3 w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageHeaderSkeleton({ compact = false }) {
  return (
    <div className={compact ? 'mb-6 space-y-2' : 'mb-10 space-y-3'}>
      <Bone className={compact ? 'h-7 w-48 max-w-[90%]' : 'h-8 w-56 max-w-[90%] sm:h-9'} />
      <Bone className="h-4 w-full max-w-2xl" />
      <Bone className="h-3.5 w-full max-w-xl" />
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-5 sm:px-6 sm:pt-6 lg:px-8">
      <PageHeaderSkeleton compact />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={`m-${i}`} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={`s-${i}`} />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="card flex min-h-[16rem] flex-col p-5">
          <Bone className="mb-4 h-4 w-32" />
          <Bone className="mb-2 h-3 w-full max-w-xs" />
          <div className="flex min-h-[176px] flex-1 items-end gap-2 rounded-lg bg-desk-elevated/40 px-3 pb-3 pt-6 dark:bg-desk-elevated/25">
            {[40, 64, 32, 52].map((px, j) => (
              <Bone key={j} className="flex-1 rounded-t-sm" style={{ height: `${px}px` }} />
            ))}
          </div>
        </div>
        <div className="card grid min-h-[16rem] flex-1 grid-cols-1 gap-px overflow-hidden bg-desk-border p-px sm:grid-cols-2 sm:[grid-template-rows:repeat(2,minmax(0,1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <DashboardActivitySkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RepositoriesPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeaderSkeleton />
      <div className="mb-6 flex flex-wrap gap-2">
        <Bone className="h-9 w-36 rounded-lg" />
        <Bone className="h-9 w-44 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <RepoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ReviewsPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeaderSkeleton />
      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-md border border-desk-border bg-desk-panel p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-8 w-16 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeaderSkeleton />
      <div className="card space-y-4 p-5 sm:p-6">
        <Bone className="h-4 w-40" />
        <Bone className="h-10 w-full rounded-lg" />
        <Bone className="h-10 w-full rounded-lg" />
        <Bone className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}
