import { Bone } from './Skeletons';

/**
 * Full-viewport loading shell for auth bootstrap (no raw “Loading…” copy).
 */
export function AuthLoadingLayout() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-desk-canvas px-6"
      role="status"
      aria-label="Loading workspace"
    >
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Bone className="h-14 w-14 rounded-2xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-lg border-2 border-desk-border border-t-brand-500 animate-spin opacity-80" />
            </div>
          </div>
          <div className="w-full space-y-2 text-center">
            <Bone className="mx-auto h-3 w-40" />
            <Bone className="mx-auto h-2.5 w-56" />
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-desk-border bg-desk-panel p-4 shadow-sm">
          <Bone className="h-2.5 w-full" />
          <Bone className="h-2.5 w-[88%]" />
          <Bone className="h-2.5 w-[72%]" />
        </div>
      </div>
    </div>
  );
}
