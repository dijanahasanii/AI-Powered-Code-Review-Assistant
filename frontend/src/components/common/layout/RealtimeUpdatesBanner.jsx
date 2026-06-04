import { useState, useEffect, useRef } from 'react';
import { Unplug } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';

/** When online but Socket.IO is down: same banner pattern as BrowserOfflineBar (lead + detail), non-blocking status. */
export function RealtimeUpdatesBanner() {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!user || connected) {
      setVisible(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => setVisible(true), 650);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, connected]);

  if (!user || !visible || connected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-start gap-2.5 border-b border-amber-500/30 bg-amber-500/[0.09] px-4 py-2.5 text-amber-950 dark:text-amber-100 sm:px-6"
    >
      <Unplug size={17} className="mt-0.5 shrink-0 text-amber-800 dark:text-amber-400/95" aria-hidden="true" />
      <p className="text-[13px] leading-snug">
        <span className="font-semibold text-amber-950 dark:text-amber-50">Live updates paused.</span>{' '}
        The realtime channel is reconnecting — lists and review detail still load over the API and refresh on an interval
        until the socket is restored.
      </p>
    </div>
  );
}
