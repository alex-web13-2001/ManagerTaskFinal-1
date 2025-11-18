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
    fetchTeamMembers,
    fetchCustomColumns,
    fetchCategories,
    currentUser,
    tasks,
    projects,
    setTasks
  } = useApp();

  // This is a workaround to sync WebSocket connection status with app context
  // Since we need to update isRealtimeConnected in AppContext from here
  const [, setForceUpdate] = React.useState(0);
  
  // Sync WebSocket connection status to window object for AppContext to read
  useEffect(() => {
    (window as any).__websocketConnected = websocket.isConnected;
    setForceUpdate(prev => prev + 1);
    
    // Dispatch custom event to notify AppContext
    window.dispatchEvent(new CustomEvent('websocket-status-changed', { 
      detail: { isConnected: websocket.isConnected } 
    }));
  }, [websocket.isConnected]);

  // Handle task events - refetch tasks to ensure consistency
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleTaskCreated = (data: { task: Task; projectId?: string }) => {
      console.log('📥 WebSocket: task:created', data);
      toast.success(`Новая задача: ${data.task.title}`);
      
      // Server sends complete task object - add directly to state
      // No need for fetchTasks() since we have all the data
      setTasks((prevTasks) => {
        // Check if task already exists (from optimistic update in createTask)
        const exists = prevTasks.some(t => t.id === data.task.id);
        
        if (exists) {
          console.log('📝 WebSocket: Task already in state, skipping duplicate');
          return prevTasks;
        }
        
        // Add new task from WebSocket
        console.log('✅ WebSocket: Adding new task to state');
        return [...prevTasks, data.task];
      });
    };

    const handleTaskUpdated = (data: { task: Task; projectId?: string }) => {
      console.log('📥 WebSocket: task:updated', data);
      
      // Обновляем задачу в state напрямую
      setTasks((prevTasks) => {
        return prevTasks.map(t => t.id === data.task.id ? data.task : t);
      });
    };

    const handleTaskDeleted = (data: { taskId: string; projectId?: string }) => {
      console.log('📥 WebSocket: task:deleted', data);
      toast.info('Задача удалена');
      
      // Удаляем задачу из state напрямую
      setTasks((prevTasks) => prevTasks.filter(t => t.id !== data.taskId));
    };

    const handleTaskMoved = (data: { taskId: string; fromStatus: string; toStatus: string; projectId?: string }) => {
      console.log('📥 WebSocket: task:moved', data);
      
      // Обновляем статус задачи
      setTasks((prevTasks) => {
        return prevTasks.map(t => 
          t.id === data.taskId 
            ? { ...t, status: data.toStatus, updatedAt: new Date().toISOString() }
            : t
        );
      });
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
  }, [websocket.isConnected, websocket.on, websocket.off, setTasks]);

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
      
      // Refresh projects and team members when someone accepts an invitation
      fetchProjects();
      fetchTeamMembers();
    };

    // Subscribe to invitation events
    websocket.on('invite:received', handleInviteReceived);
    websocket.on('invite:accepted', handleInviteAccepted);

    // Cleanup
    return () => {
      websocket.off('invite:received', handleInviteReceived);
      websocket.off('invite:accepted', handleInviteAccepted);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, currentUser?.id, fetchProjects, fetchTeamMembers]);

  // Handle project events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleProjectUpdated = (data: { project: Project; projectId: string }) => {
      console.log('📥 WebSocket: project:updated', data);
      
      // Server sends complete project object - update directly in state
      // No need for fetchProjects() since we have all the data
      // Note: We still need fetchProjects() here because project updates can affect
      // permissions and member lists which require recalculation on the server
      fetchProjects();
    };

    const handleProjectMemberAdded = (data: { projectId: string; member: any }) => {
      console.log('📥 WebSocket: project:member_added', data);
      
      // Member additions affect project membership and permissions
      // Need to refetch projects to get correct role/permission data
      fetchProjects();
      fetchTeamMembers();
      
      toast.info(`New member joined: ${data.member.user?.name || data.member.email}`);
    };

    const handleProjectMemberRemoved = (data: { projectId: string; memberId: string }) => {
      console.log('📥 WebSocket: project:member_removed', data);
      
      // Member removals affect project membership and permissions
      // Need to refetch projects to get correct role/permission data
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
  }, [websocket.isConnected, websocket.on, websocket.off, fetchProjects, fetchTeamMembers]);

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

  // Handle comment events
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleCommentAdded = (data: { taskId: string; comment: any; timestamp?: string }) => {
      console.log('📥 WebSocket: comment:added', data);
      
      // Ignore events for comments authored by current user (already added locally)
      if (currentUser && data.comment?.createdBy === currentUser.id) {
        console.log('📥 WebSocket: Skipping comment:added for current user (already added locally)');
        return;
      }
      
      // Update the task in state to include the new comment
      setTasks((prevTasks) => {
        return prevTasks.map((task) => {
          if (task.id === data.taskId) {
            // Check if comment already exists (to avoid duplicates)
            const commentExists = task.comments?.some(c => c.id === data.comment.id);
            if (commentExists) {
              return task;
            }
            
            // Add the new comment to the task
            return {
              ...task,
              comments: [...(task.comments || []), data.comment]
            };
          }
          return task;
        });
      });
    };

    // Subscribe to comment events
    websocket.on('comment:added', handleCommentAdded);

    // Cleanup
    return () => {
      websocket.off('comment:added', handleCommentAdded);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, currentUser?.id, setTasks]);

  // Handle user settings events (custom columns, categories)
  useEffect(() => {
    if (!websocket.isConnected) return;

    const handleUserSettingsUpdated = (data: { userId: string; settings: any }) => {
      console.log('📥 WebSocket: user:settings_updated', data);
      
      // Only update if it's for the current user
      if (currentUser && data.userId === currentUser.id) {
        // Refetch custom columns and categories to sync across tabs
        if (data.settings.customColumns) {
          console.log('🔄 Updating custom columns from WebSocket');
          fetchCustomColumns();
        }
        if (data.settings.categories) {
          console.log('🔄 Updating categories from WebSocket');
          fetchCategories();
        }
        
        toast.info('Настройки обновлены в другой вкладке');
      }
    };

    // Subscribe to user settings events
    websocket.on('user:settings_updated', handleUserSettingsUpdated);

    // Cleanup
    return () => {
      websocket.off('user:settings_updated', handleUserSettingsUpdated);
    };
  }, [websocket.isConnected, websocket.on, websocket.off, currentUser?.id, fetchCustomColumns, fetchCategories]);

  // Auto-join project rooms when WebSocket connects
  // This ensures users receive real-time updates for tasks in their projects
  useEffect(() => {
    if (!websocket.isConnected) return;
    
    // Join all project rooms the user has access to
    if (projects && projects.length > 0) {
      projects.forEach((project: Project) => {
        websocket.joinProject(project.id);
        console.log(`📥 Auto-joined project room: project:${project.id}`);
      });
    }

    // Cleanup: leave all project rooms when disconnecting
    return () => {
      if (projects && projects.length > 0) {
        projects.forEach((project: Project) => {
          websocket.leaveProject(project.id);
        });
      }
    };
  }, [websocket.isConnected, websocket.joinProject, websocket.leaveProject, projects]);

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
