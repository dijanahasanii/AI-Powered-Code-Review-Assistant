import clsx from 'clsx';

function Bone({ className }) {
  return (
    <div
      className={clsx('animate-pulse rounded bg-gray-200 dark:bg-gray-800', className)}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <Bone className="h-3 w-20" />
        <Bone className="w-8 h-8 rounded-lg" />
      </div>
      <Bone className="h-7 w-12 mb-1" />
      <Bone className="h-3 w-16" />
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
      <Bone className="w-11 h-11 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-24" />
        <Bone className="h-3 w-40" />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-3 w-20 hidden sm:block" />
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
        <Bone className="h-8 flex-1 rounded-md" />
        <Bone className="h-8 w-10 rounded-md" />
      </div>
    </div>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Bone className="h-4 w-28" />
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <Bone className="w-14 h-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-48" />
            <Bone className="h-3 w-64" />
            <Bone className="h-3 w-32" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
          <Bone className="h-3 w-16" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4">
          <div className="flex items-start gap-3">
            <Bone className="w-4 h-4 rounded shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Bone className="h-3.5 w-48" />
                <Bone className="h-5 w-16 rounded-full" />
              </div>
              <Bone className="h-3 w-32" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
