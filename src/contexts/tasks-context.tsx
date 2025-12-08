import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { tasksAPI, getAuthToken } from '../utils/api-client';
import { Task, TaskAttachment, Comment } from '../types';
import { toast } from 'sonner';
import { useAuth } from './auth-context';
import { useProjects } from './projects-context';
import { useWebSocket } from './websocket-context';

/**
 * Deep comparison helper to check if arrays have different content
 * Returns true if arrays are different (need update), false if same
 */
const areArraysDifferent = <T extends { id: string; updatedAt?: string }>(
  current: T[],
  incoming: T[]
): boolean => {
  if (current.length !== incoming.length) return true;
  
  const currentMap = new Map(current.map(item => [item.id, item]));
  const incomingMap = new Map(incoming.map(item => [item.id, item]));
  
  if (current.some(item => !incomingMap.has(item.id))) return true;
  if (incoming.some(item => !currentMap.has(item.id))) return true;
  
  for (const incomingItem of incoming) {
    const currentItem = currentMap.get(incomingItem.id);
    if (currentItem && incomingItem.updatedAt && currentItem.updatedAt !== incomingItem.updatedAt) {
      return true;
    }
  }
  
  return false;
};

interface TasksContextType {
  tasks: Task[];
  isLoading: boolean;
  fetchTasks: () => Promise<void>;
  loadTask: (taskId: string) => Promise<void>;
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>, options?: { silent?: boolean }) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  uploadTaskAttachment: (taskId: string, file: File) => Promise<TaskAttachment>;
  uploadMultipleTaskAttachments: (taskId: string, files: File[]) => Promise<TaskAttachment[]>;
  deleteTaskAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  addTaskComment: (taskId: string, text: string) => Promise<Comment>;
  canViewAllProjectTasks: (projectId: string) => boolean;
  canEditTask: (task: Task) => boolean;
  canDeleteTask: (task: Task) => boolean;
  canCreateTask: (projectId?: string) => boolean;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { currentUser, isAuthenticated } = useAuth();
  const { getUserRoleInProject } = useProjects();
  const { isConnected: isWebSocketConnected, subscribe } = useWebSocket();
  
  // Ref to track recently created tasks to prevent polling overwrites
  const recentlyCreatedTasksRef = useRef<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const fetchedTasks = await tasksAPI.getAll();
      
      // Deduplicate tasks by ID to prevent display issues
      const uniqueTasksMap = new Map();
      fetchedTasks.forEach((task: Task) => {
        if (!uniqueTasksMap.has(task.id)) {
          uniqueTasksMap.set(task.id, task);
        }
      });
      const uniqueTasks = Array.from(uniqueTasksMap.values());
      
      if (uniqueTasks.length !== fetchedTasks.length) {
        console.warn(`⚠️ Дубликаты задач удалены: ${fetchedTasks.length} -> ${uniqueTasks.length}`);
      }
      
      // Limit tasks to prevent memory issues
      const limitedTasks = uniqueTasks.slice(0, 1000);
      if (uniqueTasks.length > 1000) {
        console.warn(`⚠️ Показано ${limitedTasks.length} из ${uniqueTasks.length} задач для оптимизации производительности`);
      }
      
      // Only update state if data actually changed - prevents unnecessary re-renders during drag-and-drop
      setTasks(prevTasks => {
        // If we have recently created tasks, preserve them
        const recentlyCreated = prevTasks.filter(t => recentlyCreatedTasksRef.current.has(t.id));
        
        // Merge: keep recently created tasks + add/update tasks from server
        const mergedTasks = [...recentlyCreated];
        const recentIds = new Set(recentlyCreated.map(t => t.id));
        
        for (const task of limitedTasks) {
          if (!recentIds.has(task.id)) {
            mergedTasks.push(task);
          }
        }
        
        if (!areArraysDifferent(prevTasks, mergedTasks)) {
          return prevTasks;
        }
        
        console.log('✅ Задачи обновлены:', { 
          было: prevTasks.length, 
          стало: mergedTasks.length,
          недавно_созданных: recentlyCreated.length,
          личные: mergedTasks.filter(t => !t.projectId).length,
          проектные: mergedTasks.filter(t => t.projectId).length,
        });
        return mergedTasks;
      });
    } catch (error: any) {
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки задач:', error);
        toast.error('Ошибка загрузки задач');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Автозагрузка задач при аутентификации
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      console.log('🔄 TasksContext: Автозагрузка задач при монтировании');
      fetchTasks();
    }
  }, [isAuthenticated, currentUser?.id, fetchTasks]);

  const loadTask = useCallback(async (taskId: string) => {
    try {
      const fetchedTask = await tasksAPI.getTask(taskId);
      
      setTasks((prevTasks) => {
        const existingIndex = prevTasks.findIndex(t => t.id === taskId);
        
        if (existingIndex >= 0) {
          const updatedTasks = [...prevTasks];
          updatedTasks[existingIndex] = fetchedTask;
          console.log(`✅ Task ${taskId} reloaded with comments:`, fetchedTask.comments?.length || 0);
          return updatedTasks;
        } else {
          console.log(`✅ Task ${taskId} added to state with comments:`, fetchedTask.comments?.length || 0);
          return [...prevTasks, fetchedTask];
        }
      });
    } catch (error: any) {
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error(`❌ Ошибка загрузки задачи ${taskId}:`, error);
      }
    }
  }, []);

  const createTask = useCallback(async (taskData: Partial<Task>): Promise<Task> => {
    try {
      const newTask = await tasksAPI.create(taskData);
      
      setTasks((prev) => {
        const exists = prev.some(t => t.id === newTask.id);
        if (exists) {
          console.warn('Task already exists in state, skipping duplicate:', newTask.id);
          return prev;
        }
        
        // Track this task as recently created to prevent polling overwrites
        recentlyCreatedTasksRef.current.add(newTask.id);
        
        // Remove from tracking after 10 seconds (2 polling cycles)
        setTimeout(() => {
          recentlyCreatedTasksRef.current.delete(newTask.id);
        }, 10000);
        
        return [...prev, newTask];
      });
      
      toast.success('Задача создана');
      return newTask;
    } catch (error: any) {
      console.error('Create task error:', error);
      
      if (error.message && error.message.includes('авторизован')) {
        toast.error('Сессия истекла. Пожалуйста, войдите снова.', { duration: 5000 });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(error.message || 'Ошибка создания задачи');
      }
      throw error;
    }
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>, options?: { silent?: boolean }): Promise<Task> => {
    let originalTask: Task | undefined;
    
    // Optimistic update
    setTasks((prev) => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      
      originalTask = task;
      const updatedTaskOptimistic = { ...task, ...updates, updatedAt: new Date().toISOString() };
      return prev.map((t) => (t.id === taskId ? updatedTaskOptimistic : t));
    });
    
    try {
      const updatedTask = await tasksAPI.update(taskId, updates);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
      
      if (!options?.silent) {
        toast.success('Задача обновлена');
      }
      return updatedTask;
    } catch (error: any) {
      console.error('Update task error:', error);
      
      // Rollback optimistic update
      if (originalTask) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? originalTask : t)));
      }
      
      if (error.message && (error.message.includes('permission') || error.message.includes('do not have'))) {
        toast.error('У вас недостаточно прав для выполнения этого действия', { duration: 5000 });
      } else if (error.message && error.message.includes('авторизован')) {
        toast.error('Сессия истекла. Пожалуйста, войдите снова.', { duration: 5000 });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(error.message || 'Ошибка обновления задачи');
      }
      throw error;
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    let deletedTask: Task | undefined;
    
    // Optimistic delete
    setTasks((prev) => {
      deletedTask = prev.find(t => t.id === taskId);
      return prev.filter((t) => t.id !== taskId);
    });
    
    try {
      await tasksAPI.delete(taskId);
      toast.success('Задача удалена');
    } catch (error: any) {
      console.error('Delete task error:', error);
      
      // Rollback
      if (deletedTask) {
        setTasks((prev) => [...prev, deletedTask]);
      }
      
      if (error.message && (error.message.includes('permission') || error.message.includes('do not have'))) {
        toast.error('У вас недостаточно прав для выполнения этого действия', { duration: 5000 });
      } else {
        toast.error(error.message || 'Ошибка удаления задачи');
      }
      throw error;
    }
  }, []);

  const uploadTaskAttachment = useCallback(async (taskId: string, file: File): Promise<TaskAttachment> => {
    try {
      console.log(`📎 uploadTaskAttachment: Starting upload for task ${taskId}, file: ${file.name}`);
      const attachment = await tasksAPI.uploadAttachment(taskId, file);
      console.log(`✅ uploadTaskAttachment: Upload successful, attachment ID: ${attachment.id}`);
      
      setTasks((prev) => prev.map((t) => {
        if (t.id === taskId) {
          console.log(`📝 uploadTaskAttachment: Updating task ${taskId} in state`);
          return {
            ...t,
            attachments: [...(t.attachments || []), attachment],
          };
        }
        return t;
      }));
      
      return attachment;
    } catch (error: any) {
      console.error(`❌ uploadTaskAttachment: Error uploading file ${file.name} for task ${taskId}:`, error);
      throw error;
    }
  }, []);

  const uploadMultipleTaskAttachments = useCallback(async (taskId: string, files: File[]): Promise<TaskAttachment[]> => {
    try {
      console.log(`📎 uploadMultipleTaskAttachments: Starting upload for task ${taskId}, ${files.length} files`);
      const attachments = await tasksAPI.uploadMultipleAttachments(taskId, files);
      console.log(`✅ uploadMultipleTaskAttachments: Upload successful, ${attachments.length} attachments`);
      
      setTasks((prev) => prev.map((t) => {
        if (t.id === taskId) {
          console.log(`📝 uploadMultipleTaskAttachments: Updating task ${taskId} in state`);
          return {
            ...t,
            attachments: [...(t.attachments || []), ...attachments],
          };
        }
        return t;
      }));
      
      return attachments;
    } catch (error: any) {
      console.error(`❌ uploadMultipleTaskAttachments: Error uploading files for task ${taskId}:`, error);
      throw error;
    }
  }, []);

  const deleteTaskAttachment = useCallback(async (taskId: string, attachmentId: string): Promise<void> => {
    try {
      await tasksAPI.deleteAttachment(taskId, attachmentId);
      
      setTasks((prev) => prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            attachments: (t.attachments || []).filter((a) => a.id !== attachmentId),
          };
        }
        return t;
      }));
      
      toast.success('Файл удален');
    } catch (error: any) {
      console.error('Delete attachment error:', error);
      toast.error(error.message || 'Ошибка удаления файла');
      throw error;
    }
  }, []);

  const addTaskComment = useCallback(async (taskId: string, text: string): Promise<Comment> => {
    try {
      const { comment } = await tasksAPI.addComment(taskId, text);
      
      setTasks((prev) => prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            comments: [...(t.comments || []), comment],
          };
        }
        return t;
      }));
      
      return comment;
    } catch (error: any) {
      console.error('Add comment error:', error);
      toast.error(error.message || 'Ошибка добавления комментария');
      throw error;
    }
  }, []);

  // Permission helpers
  const canViewAllProjectTasks = useCallback((projectId: string): boolean => {
    const role = getUserRoleInProject(projectId);
    return role === 'owner' || role === 'collaborator' || role === 'viewer';
  }, [getUserRoleInProject]);

  const canEditTask = useCallback((task: Task): boolean => {
    if (!currentUser) return false;
    
    // Personal tasks can always be edited by owner
    if (!task.projectId) {
      return task.userId === currentUser.id;
    }
    
    const role = getUserRoleInProject(task.projectId);
    
    // Owner can edit ANY task in their project, regardless of who created it
    // Collaborator can also edit any task
    if (role === 'owner' || role === 'collaborator') {
      return true;
    }
    
    if (role === 'member') {
      // Member can edit task if they are assigned to it OR created it
      return task.assigneeId === currentUser.id || task.userId === currentUser.id;
    }
    
    return false; // Viewer cannot edit
  }, [currentUser, getUserRoleInProject]);

  const canDeleteTask = useCallback((task: Task): boolean => {
    if (!currentUser) return false;
    
    // Personal tasks can be deleted by the owner
    if (!task.projectId) {
      return task.userId === currentUser.id;
    }
    
    const role = getUserRoleInProject(task.projectId);
    
    // Owner and Collaborator can delete any task in the project
    if (role === 'owner' || role === 'collaborator') {
      return true;
    }
    
    // Member CANNOT delete tasks (fixed per security requirements)
    if (role === 'member') {
      return false;
    }
    
    // Viewer cannot delete
    return false;
  }, [currentUser, getUserRoleInProject]);

  const canCreateTask = useCallback((projectId?: string): boolean => {
    if (!currentUser) return false;
    
    // Personal tasks can always be created
    if (!projectId) return true;
    
    const role = getUserRoleInProject(projectId);
    return role === 'owner' || role === 'collaborator' || role === 'member';
  }, [currentUser, getUserRoleInProject]);

  // Subscribe to WebSocket task events
  useEffect(() => {
    if (!isWebSocketConnected) return;

    const handleTaskCreated = (data: { task: Task; projectId?: string }) => {
      console.log('📥 TasksContext: task:created', data);
      toast.success(`Новая задача: ${data.task.title}`);
      
      setTasks((prevTasks) => {
        const exists = prevTasks.some(t => t.id === data.task.id);
        
        if (exists) {
          console.log('📝 TasksContext: Task already in state, skipping duplicate');
          return prevTasks;
        }
        
        console.log('✅ TasksContext: Adding new task to state');
        return [...prevTasks, data.task];
      });
    };

    const handleTaskUpdated = (data: { task: Task; projectId?: string }) => {
      console.log('📥 TasksContext: task:updated', data);
      
      setTasks((prevTasks) => {
        return prevTasks.map(t => t.id === data.task.id ? data.task : t);
      });
    };

    const handleTaskDeleted = (data: { taskId: string; projectId?: string }) => {
      console.log('📥 TasksContext: task:deleted', data);
      toast.info('Задача удалена');
      
      setTasks((prevTasks) => prevTasks.filter(t => t.id !== data.taskId));
    };

    const handleTaskMoved = (data: { taskId: string; fromStatus: string; toStatus: string; projectId?: string }) => {
      console.log('📥 TasksContext: task:moved', data);
      
      setTasks((prevTasks) => {
        return prevTasks.map(t => 
          t.id === data.taskId 
            ? { ...t, status: data.toStatus, updatedAt: new Date().toISOString() }
            : t
        );
      });
    };

    const handleCommentAdded = (data: { taskId: string; comment: any; timestamp?: string }) => {
      console.log('📥 TasksContext: comment:added', data);
      
      // Ignore events for comments authored by current user (already added locally)
      if (currentUser && data.comment?.createdBy === currentUser.id) {
        console.log('📥 TasksContext: Skipping comment:added for current user (already added locally)');
        return;
      }
      
      setTasks((prevTasks) => {
        return prevTasks.map((task) => {
          if (task.id === data.taskId) {
            // Check if comment already exists (to avoid duplicates)
            const commentExists = task.comments?.some(c => c.id === data.comment.id);
            if (commentExists) {
              return task;
            }
            
            return {
              ...task,
              comments: [...(task.comments || []), data.comment]
            };
          }
          return task;
        });
      });
    };

    const unsubscribers = [
      subscribe('task:created', handleTaskCreated),
      subscribe('task:updated', handleTaskUpdated),
      subscribe('task:deleted', handleTaskDeleted),
      subscribe('task:moved', handleTaskMoved),
      subscribe('comment:added', handleCommentAdded),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isWebSocketConnected, subscribe, currentUser]);

  const value: TasksContextType = {
    tasks,
    isLoading,
    fetchTasks,
    loadTask,
    createTask,
    updateTask,
    deleteTask,
    uploadTaskAttachment,
    uploadMultipleTaskAttachments,
    deleteTaskAttachment,
    addTaskComment,
    canViewAllProjectTasks,
    canEditTask,
    canDeleteTask,
    canCreateTask,
    setTasks,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
}
