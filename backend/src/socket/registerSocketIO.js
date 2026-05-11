'use strict';

const { supabase } = require('../config/database');
const { getUserFromSocketToken } = require('../utils/socketUserFromToken');
const { logger } = require('../utils/logger');

/**
 * Socket.IO: JWT on handshake, server-side user room, authorized repo rooms only.
 */
function registerSocketIO(io) {
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth && socket.handshake.auth.token;
      const user = await getUserFromSocketToken(raw);

      if (!user) {
        return next(new Error('Authentication required'));
      }

      socket.data.user = user;
      socket.data.userId = user.id;
      return next();
    } catch (e) {
      logger.warn(`[socket] handshake auth failed: ${e?.message || e}`);
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.data.userId;
    socket.join(`user:${uid}`);
    logger.info(`WebSocket client connected: ${socket.id} user=${uid}`);

    socket.on('join:repo', async (repoId) => {
      if (!repoId || typeof repoId !== 'string') return;

      try {
        const { data: repo, error } = await supabase
          .from('repositories')
          .select('id, user_id')
          .eq('id', repoId)
          .single();

        if (error || !repo) {
          logger.debug(`[socket] join:repo denied — repo not found ${String(repoId).slice(0, 8)}`);
          return;
        }
        if (repo.user_id !== uid) {
          logger.warn(`[socket] join:repo denied — user ${uid} attempted repo ${repoId}`);
          return;
        }

        socket.join(`repo:${repoId}`);
        logger.debug(`Socket ${socket.id} joined room repo:${repoId}`);
      } catch (err) {
        logger.warn(`[socket] join:repo error: ${err?.message || err}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { registerSocketIO };
