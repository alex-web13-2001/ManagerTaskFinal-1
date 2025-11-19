/**
 * AppContext Facade - Backward compatibility layer
 * 
 * This file provides a backward-compatible useApp hook that combines
 * all the new domain contexts (Auth, UI, Projects, Tasks, WebSocket)
 * into a single API surface that matches the original AppContext.
 * 
 * This allows existing components to continue using useApp() without changes
 * while benefiting from the improved architecture underneath.
 */

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from './auth-context';
import { useUI } from './ui-context';
import { useProjects } from './projects-context';
import { useTasks } from './tasks-context';
import { useWebSocket } from './websocket-context';
import { Task, Project, TeamMember, User, UserRole, CustomColumn, Category, TaskAttachment, Comment } from '../types';
import { type Permission } from '../lib/rbac';

interface AppContextType {
  tasks: Task[];
  projects: Project[];
  archivedProjects: Project[];
  currentUser: User | null;
  teamMembers: TeamMember[];
  customColumns: CustomColumn[];
  categories: Category[];
  isLoading: boolean;
  isInitialLoad: boolean;
  isRealtimeConnected: boolean;
  fetchTasks: () => Promise<void>;
  loadTask: (taskId: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchArchivedProjects: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  fetchTeamMembers: () => Promise<void>;
  fetchCustomColumns: () => Promise<void>;
  saveCustomColumns: (columns: CustomColumn[]) => Promise<void>;
  fetchCategories: () => Promise<void>;
  createCategory: (categoryData: Partial<Category>) => Promise<Category>;
  updateCategory: (categoryId: string, updates: Partial<Category>) => Promise<Category>;
  deleteCategory: (categoryId: string) => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>, options?: { silent?: boolean }) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  uploadTaskAttachment: (taskId: string, file: File) => Promise<TaskAttachment>;
  uploadMultipleTaskAttachments: (taskId: string, files: File[]) => Promise<TaskAttachment[]>;
  deleteTaskAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  addTaskComment: (taskId: string, text: string) => Promise<Comment>;
  uploadProjectAttachment: (projectId: string, file: File) => Promise<any>;
  deleteProjectAttachment: (projectId: string, attachmentId: string) => Promise<void>;
  createProject: (projectData: Partial<Project>) => Promise<Project>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<Project>;
  archiveProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  leaveProject: (projectId: string) => Promise<void>;
  transferProjectOwnership: (projectId: string, newOwnerId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  // Drag state management
  setIsDragging: (isDragging: boolean) => void;
  // Direct state setters for WebSocket updates
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  // Permission helpers
  getUserRoleInProject: (projectId: string) => UserRole;
  canViewAllProjectTasks: (projectId: string) => boolean;
  canEditTask: (task: Task) => boolean;
  canDeleteTask: (task: Task) => boolean;
  canCreateTask: (projectId?: string) => boolean;
  canEditProject: (projectId: string) => boolean;
  canDeleteProject: (projectId: string) => boolean;
  hasPermission: (permission: Permission, projectId?: string) => boolean;
}

/**
 * Facade hook that combines all domain contexts
 */
export function useApp(): AppContextType {
  const auth = useAuth();
  const ui = useUI();
  const projects = useProjects();
  const tasks = useTasks();
  const websocket = useWebSocket();
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const prevWebSocketConnectedRef = useRef<boolean>(false);

  // Track WebSocket connection status
  useEffect(() => {
    setIsRealtimeConnected(websocket.isConnected);
  }, [websocket.isConnected]);

  // Load data on mount
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    const loadData = async () => {
      if (!isMounted) return;
      
      loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('⚠️ Data loading timeout exceeded');
        }
      }, 30000);
      
      try {
        console.log('📊 Starting data load...');
        
        // Load tasks and projects
        await Promise.all([
          tasks.fetchTasks(),
          projects.fetchProjects(),
        ]);
        console.log('✅ All data loaded successfully');
      } catch (error: any) {
        console.error('❌ Error loading initial data:', error);
      } finally {
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        if (isMounted) {
          setIsInitialLoad(false);
        }
      }
    };
    
    if (auth.isAuthenticated) {
      loadData();
    }
    
    return () => {
      isMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [auth.isAuthenticated]); // Only re-run when authentication status changes

  // Smart polling - only active when WebSocket is disconnected
  useEffect(() => {
    if (!auth.currentUser) {
      console.log('⏸️ Polling не запущен - пользователь не авторизован');
      return;
    }

    let intervalId: NodeJS.Timeout | undefined;

    const startPolling = () => {
      console.log('⚠️ WebSocket отключен. Запуск резервного поллинга...');
      intervalId = setInterval(async () => {
        try {
          // Don't update if user is dragging
          if (!ui.isDraggingRef.current) {
            await refreshData();
          } else {
            console.log('[Smart Polling] Skipping update during drag operation');
          }
        } catch (error) {
          console.error('Smart Polling error:', error);
        }
      }, 10000);
    };

    if (isRealtimeConnected) {
      console.log('⚡ WebSocket активен. Поллинг отключен.');
    } else {
      startPolling();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('🔴 Smart Polling остановлен');
      }
    };
  }, [auth.currentUser, isRealtimeConnected, ui.isDraggingRef]);

  // Sync on WebSocket reconnect
  useEffect(() => {
    const wasDisconnected = !prevWebSocketConnectedRef.current;
    const isNowConnected = isRealtimeConnected;
    
    prevWebSocketConnectedRef.current = isRealtimeConnected;
    
    if (wasDisconnected && isNowConnected && auth.currentUser) {
      console.log('🔄 WebSocket восстановлен. Синхронизация данных...');
      refreshData();
    }
  }, [isRealtimeConnected, auth.currentUser]);

  // refreshData function
  const refreshData = useCallback(async () => {
    console.log('🔄 Refreshing all data...');
    try {
      await Promise.all([
        tasks.fetchTasks(),
        projects.fetchProjects(),
        auth.fetchCustomColumns(),
        auth.fetchCategories(),
      ]);
      console.log('✅ Data refresh complete');
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    }
  }, [tasks, projects, auth]);

  // Combine loading states
  const isLoading = auth.isLoading || tasks.isLoading;

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<AppContextType>(() => ({
    // State from different contexts
    tasks: tasks.tasks,
    projects: projects.projects,
    archivedProjects: projects.archivedProjects,
    currentUser: auth.currentUser,
    teamMembers: projects.teamMembers,
    customColumns: auth.customColumns,
    categories: auth.categories,
    isLoading,
    isInitialLoad,
    isRealtimeConnected,
    
    // Task methods
    fetchTasks: tasks.fetchTasks,
    loadTask: tasks.loadTask,
    createTask: tasks.createTask,
    updateTask: tasks.updateTask,
    deleteTask: tasks.deleteTask,
    uploadTaskAttachment: tasks.uploadTaskAttachment,
    uploadMultipleTaskAttachments: tasks.uploadMultipleTaskAttachments,
    deleteTaskAttachment: tasks.deleteTaskAttachment,
    addTaskComment: tasks.addTaskComment,
    setTasks: tasks.setTasks,
    
    // Project methods
    fetchProjects: projects.fetchProjects,
    fetchArchivedProjects: projects.fetchArchivedProjects,
    fetchTeamMembers: projects.fetchTeamMembers,
    createProject: projects.createProject,
    updateProject: projects.updateProject,
    archiveProject: projects.archiveProject,
    restoreProject: projects.restoreProject,
    deleteProject: projects.deleteProject,
    leaveProject: projects.leaveProject,
    transferProjectOwnership: projects.transferProjectOwnership,
    uploadProjectAttachment: projects.uploadProjectAttachment,
    deleteProjectAttachment: projects.deleteProjectAttachment,
    
    // Auth methods
    fetchCurrentUser: auth.checkAuth,
    updateCurrentUser: auth.updateUser,
    uploadAvatar: auth.uploadAvatar,
    deleteAvatar: auth.deleteAvatar,
    
    // User settings methods
    fetchCustomColumns: auth.fetchCustomColumns,
    saveCustomColumns: auth.saveCustomColumns,
    fetchCategories: auth.fetchCategories,
    createCategory: auth.createCategory,
    updateCategory: auth.updateCategory,
    deleteCategory: auth.deleteCategory,
    
    // UI methods
    setIsDragging: ui.setIsDragging,
    
    // Permission helpers - from both projects and tasks
    getUserRoleInProject: projects.getUserRoleInProject,
    canEditProject: projects.canEditProject,
    canDeleteProject: projects.canDeleteProject,
    hasPermission: projects.hasPermission,
    canViewAllProjectTasks: tasks.canViewAllProjectTasks,
    canEditTask: tasks.canEditTask,
    canDeleteTask: tasks.canDeleteTask,
    canCreateTask: tasks.canCreateTask,
    
    // Utility
    refreshData,
  }), [
    tasks.tasks,
    projects.projects,
    projects.archivedProjects,
    auth.currentUser,
    projects.teamMembers,
    auth.customColumns,
    auth.categories,
    isLoading,
    isInitialLoad,
    isRealtimeConnected,
    tasks.fetchTasks,
    tasks.loadTask,
    tasks.createTask,
    tasks.updateTask,
    tasks.deleteTask,
    tasks.uploadTaskAttachment,
    tasks.uploadMultipleTaskAttachments,
    tasks.deleteTaskAttachment,
    tasks.addTaskComment,
    tasks.setTasks,
    projects.fetchProjects,
    projects.fetchArchivedProjects,
    projects.fetchTeamMembers,
    projects.createProject,
    projects.updateProject,
    projects.archiveProject,
    projects.restoreProject,
    projects.deleteProject,
    projects.leaveProject,
    projects.transferProjectOwnership,
    projects.uploadProjectAttachment,
    projects.deleteProjectAttachment,
    auth.checkAuth,
    auth.updateUser,
    auth.uploadAvatar,
    auth.deleteAvatar,
    auth.fetchCustomColumns,
    auth.saveCustomColumns,
    auth.fetchCategories,
    auth.createCategory,
    auth.updateCategory,
    auth.deleteCategory,
    ui.setIsDragging,
    projects.getUserRoleInProject,
    projects.canEditProject,
    projects.canDeleteProject,
    projects.hasPermission,
    tasks.canViewAllProjectTasks,
    tasks.canEditTask,
    tasks.canDeleteTask,
    tasks.canCreateTask,
    refreshData,
  ]);

  return value;
}

/**
 * Pass-through provider - actual providers are composed in App.tsx
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
