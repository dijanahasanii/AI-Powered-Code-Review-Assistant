/** Shared hero + footer for GitHub onboarding / resume session */
export default function LandingShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-600 items-center justify-center text-white text-2xl font-bold mb-4">
            AI
          </div>
          <h1 className="text-2xl font-bold text-white">Code Review</h1>
          <p className="text-gray-400 text-sm mt-1">AI-powered analysis for your GitHub repos</p>
        </div>

        {children}

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            ['🔍', 'Bug detection'],
            ['🔒', 'Security audit'],
            ['⚡', 'Performance tips'],
            ['📊', 'Quality scores'],
          ].map(([emoji, label]) => (
            <div key={label} className="card px-3 py-2 flex items-center gap-2 text-sm text-gray-400">
              <span>{emoji}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
