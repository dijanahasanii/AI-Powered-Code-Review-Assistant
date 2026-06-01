import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../context/SocketContext';
import { applyReviewUpdateToCaches } from '../../lib/socketQuerySync';

/** Socket-driven cache updates for dashboard, reviews, and reports lists. */
export function ReviewSocketCacheSync() {
  const queryClient = useQueryClient();
  const { onReviewUpdate } = useSocket();

  useEffect(() => {
    return onReviewUpdate((update) => {
      applyReviewUpdateToCaches(queryClient, update);
    });
  }, [onReviewUpdate, queryClient]);

  return null;
}
