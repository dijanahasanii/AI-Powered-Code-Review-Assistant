import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../context/SocketContext';
import { queryKeys } from '../../lib/queryKeys';

/** Invalidate React Query caches when Socket.IO emits review:update. */
export function ReviewSocketCacheSync() {
  const queryClient = useQueryClient();
  const { onReviewUpdate } = useSocket();

  useEffect(() => {
    return onReviewUpdate((update) => {
      const status = update?.status;
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      if (status === 'completed' || status === 'failed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      }
    });
  }, [onReviewUpdate, queryClient]);

  return null;
}
