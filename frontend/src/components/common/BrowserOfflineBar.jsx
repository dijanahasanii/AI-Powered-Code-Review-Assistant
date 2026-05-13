import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Non-blocking notice when the browser reports offline.
 * Does not replace service workers — only clarifies why API/realtime calls may fail.
 */
export function BrowserOfflineBar({ className = '' }) {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex shrink-0 items-start gap-2.5 border-b border-sky-500/35 bg-sky-950/95 px-4 py-2.5 text-sky-100 sm:px-6 ${className}`.trim()}
    >
      <WifiOff size={17} className="mt-0.5 shrink-0 text-sky-300" aria-hidden="true" />
      <p className="text-[13px] leading-snug">
        <span className="font-semibold text-sky-50">You appear offline.</span>{' '}
        REST requests, live review updates, and GitHub-backed actions will fail until the connection returns. Reconnect,
        then retry or refresh the page.
      </p>
    </div>
  );
}
