import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useWebSocket, WebSocketHookReturn } from '../hooks/useWebSocket';

type EventCallback = (payload: any) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (event: string, callback: EventCallback) => () => void;
  unsubscribe: (event: string, callback: EventCallback) => void;
  emit: (event: string, data: any) => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  // Backward compatibility with socket.io API
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const websocket = useWebSocket();
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());

  // Subscribe to an event
  const subscribe = useCallback((event: string, callback: EventCallback): (() => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = listenersRef.current.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          listenersRef.current.delete(event);
        }
      }
    };
  }, []);

  // Unsubscribe from an event
  const unsubscribe = useCallback((event: string, callback: EventCallback) => {
    const listeners = listenersRef.current.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        listenersRef.current.delete(event);
      }
    }
  }, []);

  // Dispatch events to all subscribers
  const dispatch = useCallback((event: string, payload: any) => {
    const listeners = listenersRef.current.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }, []);

  // Listen to WebSocket events and dispatch to subscribers
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleTaskCreated = (data: any) => {
      console.log('📥 WebSocket: task:created', data);
      dispatch('task:created', data);
    };

    const handleTaskUpdated = (data: any) => {
      console.log('📥 WebSocket: task:updated', data);
      dispatch('task:updated', data);
    };

    const handleTaskDeleted = (data: any) => {
      console.log('📥 WebSocket: task:deleted', data);
      dispatch('task:deleted', data);
    };

    const handleTaskMoved = (data: any) => {
      console.log('📥 WebSocket: task:moved', data);
      dispatch('task:moved', data);
    };

    // Subscribe to task events
    websocket.on('task:created', handleTaskCreated);
    websocket.on('task:updated', handleTaskUpdated);
    websocket.on('task:deleted', handleTaskDeleted);
    websocket.on('task:moved', handleTaskMoved);

    // Cleanup
    return () => {
      websocket.off('task:created', handleTaskCreated);
      websocket.off('task:updated', handleTaskUpdated);
      websocket.off('task:deleted', handleTaskDeleted);
      websocket.off('task:moved', handleTaskMoved);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, dispatch]);

  // Handle invitation events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleInviteReceived = (data: any) => {
      console.log('📥 WebSocket: invite:received', data);
      dispatch('invite:received', data);
    };

    const handleInviteAccepted = (data: any) => {
      console.log('📥 WebSocket: invite:accepted', data);
      dispatch('invite:accepted', data);
    };

    // Subscribe to invitation events
    websocket.on('invite:received', handleInviteReceived);
    websocket.on('invite:accepted', handleInviteAccepted);

    // Cleanup
    return () => {
      websocket.off('invite:received', handleInviteReceived);
      websocket.off('invite:accepted', handleInviteAccepted);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, dispatch]);

  // Handle project events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleProjectUpdated = (data: any) => {
      console.log('📥 WebSocket: project:updated', data);
      dispatch('project:updated', data);
    };

    const handleProjectDeleted = (data: any) => {
      console.log('📥 WebSocket: project:deleted', data);
      dispatch('project:deleted', data);
    };

    const handleProjectMemberAdded = (data: any) => {
      console.log('📥 WebSocket: project:member_added', data);
      dispatch('project:member_added', data);
    };

    const handleProjectMemberRemoved = (data: any) => {
      console.log('📥 WebSocket: project:member_removed', data);
      dispatch('project:member_removed', data);
    };

    // Subscribe to project events
    websocket.on('project:updated', handleProjectUpdated);
    websocket.on('project:deleted', handleProjectDeleted);
    websocket.on('project:member_added', handleProjectMemberAdded);
    websocket.on('project:member_removed', handleProjectMemberRemoved);

    // Cleanup
    return () => {
      websocket.off('project:updated', handleProjectUpdated);
      websocket.off('project:deleted', handleProjectDeleted);
      websocket.off('project:member_added', handleProjectMemberAdded);
      websocket.off('project:member_removed', handleProjectMemberRemoved);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, dispatch]);

  // Handle user status events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleUserOnline = (data: any) => {
      console.log('📥 WebSocket: user:online', data);
      dispatch('user:online', data);
    };

    const handleUserOffline = (data: any) => {
      console.log('📥 WebSocket: user:offline', data);
      dispatch('user:offline', data);
    };

    const handleUserDragging = (data: any) => {
      console.log('📥 WebSocket: user:dragging', data);
      dispatch('user:dragging', data);
    };

    // Subscribe to user status events
    websocket.on('user:online', handleUserOnline);
    websocket.on('user:offline', handleUserOffline);
    websocket.on('user:dragging', handleUserDragging);

    // Cleanup
    return () => {
      websocket.off('user:online', handleUserOnline);
      websocket.off('user:offline', handleUserOffline);
      websocket.off('user:dragging', handleUserDragging);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, dispatch]);

  // Handle comment events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleCommentAdded = (data: any) => {
      console.log('📥 WebSocket: comment:added', data);
      dispatch('comment:added', data);
    };

    // Subscribe to comment events
    websocket.on('comment:added', handleCommentAdded);

    // Cleanup
    return () => {
      websocket.off('comment:added', handleCommentAdded);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, dispatch]);

  // Handle user settings events (custom columns, categories)
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleUserSettingsUpdated = (data: any) => {
      console.log('📥 WebSocket: user:settings_updated', data);
      dispatch('user:settings_updated', data);
    };

    // Subscribe to user settings events
    websocket.on('user:settings_updated', handleUserSettingsUpdated);

    // Cleanup
    return () => {
      websocket.off('user:settings_updated', handleUserSettingsUpdated);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, dispatch]);

  const value: WebSocketContextType = {
    isConnected: websocket.isConnected,
    subscribe,
    unsubscribe,
    emit: websocket.emit,
    joinProject: websocket.joinProject,
    leaveProject: websocket.leaveProject,
    // Backward compatibility with socket.io API
    on: websocket.on,
    off: websocket.off,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Backward compatibility alias
export const useWebSocketContext = useWebSocket;
