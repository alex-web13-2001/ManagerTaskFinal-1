import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../utils/api-client';

export interface WebSocketHookReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

/**
 * Custom hook for WebSocket connection
 * Automatically handles authentication, connection state, and reconnection
 */
export function useWebSocket(): WebSocketHookReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Initialize socket connection
  useEffect(() => {
    const token = getAuthToken();
    
    if (!token) {
      console.log('🔌 WebSocket: No auth token, skipping connection');
      return;
    }

    // Use VITE_API_BASE_URL to match api-client.tsx
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    
    // Construct WebSocket URL from HTTP(S) URL
    // - If HTTPS, use WSS (secure WebSocket)
    // - If HTTP, use WS
    const serverUrl = apiBaseUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
    
    console.log('🔌 WebSocket: Connecting to', serverUrl, '(from API base:', apiBaseUrl + ')');
    
    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket: Connected', socket.id);
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket: Disconnected', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect manually
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 WebSocket: Reconnecting (attempt ${reconnectAttemptsRef.current})...`);
            socket.connect();
          }, 2000 * reconnectAttemptsRef.current);
        } else {
          setError('Connection failed after multiple attempts');
        }
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ WebSocket: Connection error', err.message);
      setIsConnected(false);
      setError(err.message);
    });

    socket.on('error', (err) => {
      console.error('❌ WebSocket: Error', err);
      setError(err.toString());
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 WebSocket: Cleaning up connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Emit event to server
  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('⚠️ WebSocket: Cannot emit, not connected');
    }
  }, []);

  // Subscribe to event
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  // Unsubscribe from event
  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event, handler);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  // Join a project room
  const joinProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:project', projectId);
      console.log(`📥 WebSocket: Joined project room: ${projectId}`);
    }
  }, []);

  // Leave a project room
  const leaveProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:project', projectId);
      console.log(`📤 WebSocket: Left project room: ${projectId}`);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off,
    joinProject,
    leaveProject,
  };
}
