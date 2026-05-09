/**
 * Reviews run in-process (no Redis) unless you opt into Bull:
 *   QUEUE_DRIVER=redis
 * and REDIS_URL points at a live Redis instance.
 */
function useInlineJobQueue() {
  return process.env.QUEUE_DRIVER !== 'redis';
}

module.exports = { useInlineJobQueue };
