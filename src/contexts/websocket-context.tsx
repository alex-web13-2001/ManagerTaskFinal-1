import React, { createContext, useContext, useEffect } from 'react';
import { useWebSocket, WebSocketHookReturn } from '../hooks/useWebSocket';
import { useApp } from './app-context';
import { Task, Project } from './app-context';
import { toast } from 'sonner';

interface WebSocketContextType extends WebSocketHookReturn {}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const websocket = useWebSocket();
  const { 
    fetchTasks, 
    fetchProjects,
    currentUser 
  } = useApp();

  // Handle task events - refetch tasks to ensure consistency
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleTaskCreated = (data: { task: Task; projectId?: string }) => {
      console.log('📥 WebSocket: task:created', data);
      toast.success(`New task: ${data.task.title}`);
      // Refetch tasks to get the updated list
      fetchTasks();
    };

    const handleTaskUpdated = (data: { task: Task; projectId?: string }) => {
      console.log('📥 WebSocket: task:updated', data);
      // Silently refetch tasks to update the list
      fetchTasks();
    };

    const handleTaskDeleted = (data: { taskId: string; projectId?: string }) => {
      console.log('📥 WebSocket: task:deleted', data);
      toast.info('Task deleted');
      // Refetch tasks to get the updated list
      fetchTasks();
    };

    const handleTaskMoved = (data: { taskId: string; fromStatus: string; toStatus: string; projectId?: string }) => {
      console.log('📥 WebSocket: task:moved', data);
      // Silently refetch tasks to update positions
      fetchTasks();
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
  }, [websocket.isConnected, websocket.on, websocket.off, fetchTasks]);

  // Handle invitation events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleInviteReceived = (data: { invitation: any; userId: string }) => {
      console.log('📥 WebSocket: invite:received', data);
      
      if (data.userId === currentUser?.id) {
        toast.info(`New invitation: ${data.invitation.projectName}`, {
          description: `You've been invited as ${data.invitation.role}`,
        });
        
        // Optionally refresh invitations
        // Could trigger a refetch of pending invitations here
      }
    };

    const handleInviteAccepted = (data: { invitationId: string; projectId: string; userId: string }) => {
      console.log('📥 WebSocket: invite:accepted', data);
      
      // Refresh projects when someone accepts an invitation
      fetchProjects();
    };

    // Subscribe to invitation events
    websocket.on('invite:received', handleInviteReceived);
    websocket.on('invite:accepted', handleInviteAccepted);

    // Cleanup
    return () => {
      websocket.off('invite:received', handleInviteReceived);
      websocket.off('invite:accepted', handleInviteAccepted);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, currentUser, fetchProjects]);

  // Handle project events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleProjectUpdated = (data: { project: Project; projectId: string }) => {
      console.log('📥 WebSocket: project:updated', data);
      
      // Refetch projects to get updated data
      fetchProjects();
    };

    const handleProjectMemberAdded = (data: { projectId: string; member: any }) => {
      console.log('📥 WebSocket: project:member_added', data);
      
      // Refresh projects to get updated member list
      fetchProjects();
      
      toast.info(`New member joined: ${data.member.user?.name || data.member.email}`);
    };

    const handleProjectMemberRemoved = (data: { projectId: string; memberId: string }) => {
      console.log('📥 WebSocket: project:member_removed', data);
      
      // Refresh projects to get updated member list
      fetchProjects();
    };

    // Subscribe to project events
    websocket.on('project:updated', handleProjectUpdated);
    websocket.on('project:member_added', handleProjectMemberAdded);
    websocket.on('project:member_removed', handleProjectMemberRemoved);

    // Cleanup
    return () => {
      websocket.off('project:updated', handleProjectUpdated);
      websocket.off('project:member_added', handleProjectMemberAdded);
      websocket.off('project:member_removed', handleProjectMemberRemoved);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, fetchProjects]);

  // Handle user status events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleUserOnline = (data: { userId: string; userName: string; projectId?: string }) => {
      console.log('📥 WebSocket: user:online', data);
      // Could update UI to show online status
    };

    const handleUserOffline = (data: { userId: string; projectId?: string }) => {
      console.log('📥 WebSocket: user:offline', data);
      // Could update UI to show offline status
    };

    const handleUserDragging = (data: { userId: string; taskId: string; isDragging: boolean; projectId?: string }) => {
      console.log('📥 WebSocket: user:dragging', data);
      // Could show visual indicator that another user is dragging a task
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
  }, [websocket.isConnected, websocket.on, websocket.off]);

  // Auto-join project rooms when WebSocket connects or when user navigates to projects
  // This will be handled per-page/component basis for better control

  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
