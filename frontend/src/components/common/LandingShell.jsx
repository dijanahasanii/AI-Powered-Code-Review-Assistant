/** Shared hero + footer for GitHub onboarding / resume session */
export default function LandingShell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-desk-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            AI
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Code Review</h1>
          <p className="mt-1 text-sm text-desk-muted">AI-powered analysis for your GitHub repos</p>
        </div>

        {children}

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            ['🔍', 'Bug detection'],
            ['🔒', 'Security audit'],
            ['⚡', 'Performance tips'],
            ['📊', 'Quality scores'],
          ].map(([emoji, label]) => (
            <div
              key={label}
              className="card flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
            >
              <span>{emoji}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
