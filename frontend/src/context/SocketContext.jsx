import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { io } from 'socket.io-client';
import { getPublicSocketBaseUrl } from '../config/publicUrls';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const listenersRef = useRef(new Set());
  const pendingRepoRoomsRef = useRef(new Set());
  const [connected, setConnected] = useState(false);

  const fanOutReviewUpdate = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') return;
    listenersRef.current.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.warn('[Socket] review:update listener crashed', e);
      }
    });
  }, []);

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      listenersRef.current.clear();
      pendingRepoRoomsRef.current.clear();
      setConnected(false);
      return undefined;
    }

    const socket = io(getPublicSocketBaseUrl(), {
      auth: { token: localStorage.getItem('token') },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // User room is joined server-side after JWT handshake; only repo rooms are client-requested.
      pendingRepoRoomsRef.current.forEach((repoId) => {
        socket.emit('join:repo', repoId);
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] connection error:', err?.message || err);
    });

    socket.on('review:update', fanOutReviewUpdate);

    return () => {
      socket.off('review:update', fanOutReviewUpdate);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, fanOutReviewUpdate]);

  const joinRepo = useCallback((repoId) => {
    if (!repoId) return;
    pendingRepoRoomsRef.current.add(repoId);
    socketRef.current?.emit('join:repo', repoId);
  }, []);

  const onReviewUpdate = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  const value = useMemo(
    () => ({ connected, joinRepo, onReviewUpdate }),
    [connected, joinRepo, onReviewUpdate]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
