import clsx from 'clsx';

function Bone({ className }) {
  return (
    <div
      className={clsx('bg-gray-800 rounded animate-pulse', className)}
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
    <div className="card px-5 py-4 flex items-center gap-4">
      <Bone className="w-4 h-4 rounded shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-40" />
        <Bone className="h-3 w-24" />
      </div>
      <Bone className="w-7 h-7 rounded-lg" />
    </div>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
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
