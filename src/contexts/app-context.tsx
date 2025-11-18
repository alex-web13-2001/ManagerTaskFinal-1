import React from 'react';
import { tasksAPI, projectsAPI, authAPI, teamAPI, userSettingsAPI, categoriesAPI, getAuthToken } from '../utils/api-client';
// Removed: import { projectId } from '../utils/supabase/info';
import { toast } from 'sonner';
import { hasRolePermission, type Permission, type UserRole as RBACUserRole } from '../lib/rbac';

/**
 * Helper function to get user ID from JWT token
 */
const getUserIdFromToken = (): string | null => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.sub || null;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

/**
 * Deep comparison helper to check if arrays have different content
 * Returns true if arrays are different (need update), false if same
 */
const areArraysDifferent = <T extends { id: string; updatedAt?: string }>(
  current: T[],
  incoming: T[]
): boolean => {
  // Quick length check
  if (current.length !== incoming.length) return true;
  
  // Create maps for efficient comparison
  const currentMap = new Map(current.map(item => [item.id, item]));
  const incomingMap = new Map(incoming.map(item => [item.id, item]));
  
  // Check if any IDs are different
  if (current.some(item => !incomingMap.has(item.id))) return true;
  if (incoming.some(item => !currentMap.has(item.id))) return true;
  
  // Compare updatedAt timestamps for changed items
  for (const incomingItem of incoming) {
    const currentItem = currentMap.get(incomingItem.id);
    if (currentItem && incomingItem.updatedAt && currentItem.updatedAt !== incomingItem.updatedAt) {
      return true;
    }
  }
  
  return false;
};

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Comment {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  deadline?: string;
  projectId?: string;
  categoryId?: string;
  assigneeId?: string;
  userId?: string; // Создатель задачи
  tags?: string[];
  attachments?: TaskAttachment[];
  comments?: Comment[];
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
  // Поля для повторяющихся задач
  isRecurring?: boolean;
  recurringStartDate?: string;
  recurringIntervalDays?: number;
  parentRecurringTaskId?: string; // ID родительской повторяющейся задачи
  // Поле для стабильного упорядочивания без переиндексации
  orderKey?: string; // Лексикографический ключ для сортировки (Base36)
  version?: number; // Монотонный счетчик для оптимистичной конкурентности
}

export interface ProjectLink {
  id: string;
  name: string;
  url: string;
}

export interface ProjectAttachment {
  id: string;
  name: string;
  size: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  category?: string; // Строка для отображения
  availableCategories?: string[]; // Массив ID категорий, доступных для задач в проекте
  status?: string;
  userId?: string; // Владелец проекта
  members?: any[];
  links?: ProjectLink[];
  attachments?: ProjectAttachment[];
  archived?: boolean; // Флаг архивирования
  archivedAt?: string; // Дата архивирования
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string;
}

export type UserRole = 'owner' | 'admin' | 'collaborator' | 'member' | 'viewer' | null;

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface CustomColumn {
  id: string;
  title: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

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

const AppContext = React.createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = React.useState<Project[]>([]);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [customColumns, setCustomColumns] = React.useState<CustomColumn[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false);
  
  // Use ref to track drag state without causing re-renders
  const isDraggingRef = React.useRef(false);
  
  // Ref to track recently created tasks to prevent polling overwrites
  const recentlyCreatedTasksRef = React.useRef<Set<string>>(new Set());
  
  // Function to set drag state
  const setIsDragging = React.useCallback((isDragging: boolean) => {
    isDraggingRef.current = isDragging;
    console.log('[AppContext] Drag state:', isDragging);
  }, []);

  const fetchTasks = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
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
          // Data hasn't changed, return previous state to prevent re-render
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
      // Only log if it's not an auth error (auth errors are expected when not logged in)
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки задач:', error);
        toast.error('Ошибка загрузки задач');
      }
    }
  }, []);

  const loadTask = React.useCallback(async (taskId: string) => {
    try {
      // Fetch the task with all details including comments
      const fetchedTask = await tasksAPI.getTask(taskId);
      
      // Update or add the task in the tasks state
      setTasks((prevTasks) => {
        const existingIndex = prevTasks.findIndex(t => t.id === taskId);
        
        if (existingIndex >= 0) {
          // Replace existing task with fresh data from server
          const updatedTasks = [...prevTasks];
          updatedTasks[existingIndex] = fetchedTask;
          console.log(`✅ Task ${taskId} reloaded with comments:`, fetchedTask.comments?.length || 0);
          return updatedTasks;
        } else {
          // Add task if it doesn't exist (edge case)
          console.log(`✅ Task ${taskId} added to state with comments:`, fetchedTask.comments?.length || 0);
          return [...prevTasks, fetchedTask];
        }
      });
    } catch (error: any) {
      // Only log if it's not an auth error
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error(`❌ Ошибка загрузки задачи ${taskId}:`, error);
        // Don't show toast error - this is a background operation
      }
    }
  }, []);

  const fetchProjects = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
        return;
      }
      
      const fetchedProjects = await projectsAPI.getAll();
      
      // Filter out archived projects (they should be loaded separately)
      const activeProjects = fetchedProjects.filter(p => !p.archived);
      
      // Limit projects to prevent memory issues
      const limitedProjects = activeProjects.slice(0, 500);
      if (activeProjects.length > 500) {
        console.warn(`⚠️ Показано ${limitedProjects.length} из ${activeProjects.length} проектов для оптимизации производительности`);
      }
      
      // Extract team members from all projects
      const membersMap = new Map<string, TeamMember>();
      limitedProjects.forEach(project => {
        if (project.members && Array.isArray(project.members)) {
          project.members.forEach((member: any) => {
            // Handle both flat and nested user structures
            const memberId = member.userId || member.id;
            const memberName = member.user?.name || member.name || '';
            const memberEmail = member.user?.email || member.email || '';
            const memberAvatar = member.user?.avatarUrl || member.avatarUrl;
            
            // Only add members that have at least a name or email
            if (memberId && (memberName || memberEmail) && !membersMap.has(memberId)) {
              membersMap.set(memberId, {
                id: memberId,
                name: memberName,
                email: memberEmail,
                avatarUrl: memberAvatar,
              });
            }
          });
        }
      });
      
      // Update team members if changed
      const extractedMembers = Array.from(membersMap.values());
      setTeamMembers(prevMembers => {
        const prevIds = new Set(prevMembers.map(m => m.id));
        const newIds = new Set(extractedMembers.map(m => m.id));
        
        // Check if members have changed
        if (prevMembers.length !== extractedMembers.length ||
            !Array.from(newIds).every(id => prevIds.has(id))) {
          console.log('✅ Участники команды обновлены:', { было: prevMembers.length, стало: extractedMembers.length });
          return extractedMembers;
        }
        return prevMembers;
      });
      
      // Only update state if data actually changed - prevents unnecessary re-renders
      setProjects(prevProjects => {
        if (!areArraysDifferent(prevProjects, limitedProjects)) {
          // Data hasn't changed, return previous state to prevent re-render
          return prevProjects;
        }
        console.log('✅ Проекты обновлены:', { было: prevProjects.length, стало: limitedProjects.length });
        return limitedProjects;
      });
    } catch (error: any) {
      // Only log if it's not an auth error (auth errors are expected when not logged in)
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки проектов:', error);
        toast.error('Ошибка загрузки проектов');
      }
    }
  }, []);

  const fetchArchivedProjects = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
        return;
      }
      
      const archived = await projectsAPI.getArchived();
      console.log('✅ Архивные проекты загружены:', archived.length);
      setArchivedProjects(archived);
    } catch (error: any) {
      // Only log if it's not an auth error (auth errors are expected when not logged in)
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки архивных проектов:', error);
      }
    }
  }, []);

  const fetchCurrentUser = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
        return;
      }
      
      const user = await authAPI.getCurrentUser();
      if (user) {
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name || user.user_metadata?.name || 'Пользователь',
          avatarUrl: user.avatarUrl || user.user_metadata?.avatarUrl,
          createdAt: user.createdAt || user.created_at,
        };
        setCurrentUser(userData);
        console.log('✅ Данные пользователя загружены:', {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        });
      }
    } catch (error: any) {
      console.error('❌ Ошибка загрузки данных пользователя:', error);
    }
  }, []);

  const fetchTeamMembers = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
        return;
      }
      
      // Instead of calling teamAPI.getMembers() which requires a projectId,
      // we'll build the team members list from all project members
      // This happens automatically when projects are loaded
      console.log('✅ Участники команды будут загружены из проектов');
    } catch (error: any) {
      console.error('❌ Ошибка загрузки участников команды:', error);
      // Don't show error toast - team members are optional
    }
  }, []);

  const fetchCustomColumns = React.useCallback(async () => {
    try {
      // Check if user is authenticated first
      const token = await getAuthToken();
      if (!token) {
        // User is not logged in - this is expected, just return
        return;
      }
      
      const columns = await userSettingsAPI.getCustomColumns();
      console.log('✅ Кастомные столбцы загружены из API:', {
        count: columns.length,
        columns,
      });
      setCustomColumns(columns);
    } catch (error: any) {
      console.error('❌ Ошибка загрузки кастомных столбцов из API:', error);
      // Don't show error toast - custom columns are optional, will use localStorage fallback
      // Try to load from localStorage as fallback
      if (currentUser) {
        const stored = localStorage.getItem(`personal-custom-columns-${currentUser.id}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setCustomColumns(parsed);
            console.log('✅ Кастомные столбцы загружены из localStorage (fallback):', {
              count: parsed.length,
              columns: parsed,
            });
          } catch (e) {
            console.error('❌ Ошибка парсинга кастомных столбцов из localStorage:', e);
          }
        } else {
          console.log('ℹ️ Кастомные столбцы не найдены ни в API, ни в localStorage');
        }
      }
    }
  }, [currentUser]);

  const saveCustomColumns = React.useCallback(async (columns: CustomColumn[]) => {
    try {
      await userSettingsAPI.saveCustomColumns(columns);
      setCustomColumns(columns);
      console.log('✅ Кастомные столбцы сохранены в API:', {
        count: columns.length,
        columns,
      });
      
      // Also save to localStorage as backup
      if (currentUser) {
        localStorage.setItem(`personal-custom-columns-${currentUser.id}`, JSON.stringify(columns));
        console.log('✅ Кастомные столбцы также сохранены в localStorage (backup)');
      }
    } catch (error: any) {
      console.error('❌ Ошибка сохранения кастомных столбцов в API:', error);
      // Save to localStorage as fallback
      if (currentUser) {
        localStorage.setItem(`personal-custom-columns-${currentUser.id}`, JSON.stringify(columns));
        setCustomColumns(columns);
        console.log('✅ Кастомные столбцы сохранены в localStorage (fallback):', {
          count: columns.length,
          columns,
        });
      }
    }
  }, [currentUser]);

  const fetchCategories = React.useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }
      
      const categoriesData = await categoriesAPI.getCategories();
      setCategories(categoriesData);
      console.log('✅ Категории загружены:', categoriesData.length);
    } catch (error: any) {
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки категорий:', error);
      }
    }
  }, []);

  const createCategory = React.useCallback(async (categoryData: Partial<Category>): Promise<Category> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      const userId = getUserIdFromToken();
      if (!userId) {
        throw new Error('Не удалось получить userId из токена');
      }
      
      const newCategory = {
        ...categoryData,
        id: categoryData.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: currentUser?.id || userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const updatedCategories = [...categories, newCategory];
      await categoriesAPI.saveCategories(updatedCategories);

      setCategories(updatedCategories);
      console.log('✅ Категория создана:', newCategory);
      toast.success('Категория создана');
      return newCategory as Category;
    } catch (error: any) {
      console.error('❌ Ошибка создания категории:', error);
      toast.error(error.message || 'Ошибка создания категории');
      throw error;
    }
  }, [categories, currentUser]);

  const updateCategory = React.useCallback(async (categoryId: string, updates: Partial<Category>): Promise<Category> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      const updatedCategories = categories.map(c => 
        c.id === categoryId 
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      );
      
      await categoriesAPI.saveCategories(updatedCategories);

      const updatedCategory = updatedCategories.find(c => c.id === categoryId)!;
      setCategories(updatedCategories);
      console.log('✅ Категория обновлена:', updatedCategory);
      toast.success('Категория обновлена');
      return updatedCategory;
    } catch (error: any) {
      console.error('❌ Ошибка обновления категории:', error);
      toast.error(error.message || 'Ошибка обновления категории');
      throw error;
    }
  }, [categories]);

  const deleteCategory = React.useCallback(async (categoryId: string): Promise<void> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      const updatedCategories = categories.filter(c => c.id !== categoryId);
      await categoriesAPI.saveCategories(updatedCategories);

      setCategories(updatedCategories);
      console.log('✅ Категория удалена:', categoryId);
      toast.success('Категория удалена');
    } catch (error: any) {
      console.error('❌ Ошибка удаления категории:', error);
      toast.error(error.message || 'Ошибка удаления категории');
      throw error;
    }
  }, [categories]);

  const updateCurrentUser = React.useCallback(async (updates: Partial<User>) => {
    try {
      const updatedUser = await authAPI.updateProfile(updates);
      setCurrentUser((prev) => prev ? { ...prev, ...updates } : null);
      toast.success('Профиль обновлен');
      return updatedUser;
    } catch (error: any) {
      console.error('❌ Ошибка обновления профиля:', error);
      toast.error('Ошибка обновления профиля');
      throw error;
    }
  }, []);

  const uploadAvatar = React.useCallback(async (file: File) => {
    try {
      const avatarUrl = await authAPI.uploadAvatar(file);
      setCurrentUser((prev) => prev ? { ...prev, avatarUrl } : null);
      toast.success('Аватар загружен');
    } catch (error: any) {
      console.error('❌ Ошибка загрузки аватара:', error);
      toast.error(error.message || 'Ошибка загрузки аватара');
      throw error;
    }
  }, []);

  const deleteAvatar = React.useCallback(async () => {
    try {
      await authAPI.deleteAvatar();
      setCurrentUser((prev) => prev ? { ...prev, avatarUrl: undefined } : null);
      toast.success('Аватар удален');
    } catch (error: any) {
      console.error('❌ Ошибка удаления аватара:', error);
      toast.error('Ошибка удаления аватара');
      throw error;
    }
  }, []);

  // Load data on mount - ONLY ONCE!
  React.useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout | null = null;
    
    const loadData = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      
      // Set a timeout to prevent infinite loading
      loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('⚠️ Data loading timeout exceeded');
          setIsLoading(false);
        }
      }, 30000); // 30 seconds timeout
      
      try {
        console.log('📊 Starting data load...');
        
        // First load user and team
        await Promise.all([
          fetchCurrentUser(),
          fetchTeamMembers(),
        ]);
        console.log('✅ User and team loaded');
        
        // Then load tasks, projects and custom columns
        await Promise.all([
          fetchTasks(),
          fetchProjects(),
          fetchCustomColumns(),
        ]);
        console.log('✅ All data loaded successfully');
      } catch (error: any) {
        console.error('❌ Error loading initial data:', error);
        
        // If authentication error, show message
        if (error.message && error.message.includes('авторизован')) {
          toast.error('Ошибка аутентификации. Пожалуйста, войдите снова.');
        }
      } finally {
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        if (isMounted) {
          setIsLoading(false);
          setIsInitialLoad(false); // Mark initial load as complete
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, []); // Empty deps - run only once on mount

  // Load custom columns and categories when user is loaded
  React.useEffect(() => {
    if (currentUser) {
      console.log('👤 User loaded, fetching custom columns and categories...');
      fetchCustomColumns();
      fetchCategories();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]); // Only re-run when user ID changes

  // Real-time subscriptions for tasks and projects
  React.useEffect(() => {
    // Только если пользователь авторизован
    if (!currentUser) {
      console.log('⏸️ Polling не запущен - пользователь не авторизован');
      return;
    }
    
    console.log('🔴 Подключение polling для синхронизации...');
    
    // Use polling instead of realtime for KV store compatibility
    const intervalId = setInterval(async () => {
      try {
        // Skip fetchTasks if currently dragging to prevent conflicts
        const shouldFetchTasks = !isDraggingRef.current;
        
        if (shouldFetchTasks) {
          // Обновляем данные каждые 5 секунд используя существующие API функции
          await Promise.all([
            fetchTasks(),
            fetchProjects(),
            fetchCustomColumns(), // Также обновляем кастомные колонки
            fetchCategories(), // Также обновляем категории
          ]);
        } else {
          // If dragging, only update non-task data
          console.log('[Polling] Skipping fetchTasks during drag operation');
          await Promise.all([
            fetchProjects(),
            fetchCustomColumns(),
            fetchCategories(),
          ]);
        }

        // Если успешно получили данные, считаем что подключение активно
        setIsRealtimeConnected(true);
      } catch (error) {
        console.error('Polling error:', error);
        setIsRealtimeConnected(false);
      }
    }, 5000); // Обновление каждые 5 секунд (уменьшено с 3 для снижения нагрузки)

    console.log('✅ Polling включен (обновление каждые 5 секунд)');
    setIsRealtimeConnected(true);

    // Cleanup polling on unmount
    return () => {
      console.log('🔴 Отключение polling...');
      clearInterval(intervalId);
      setIsRealtimeConnected(false);
    };
  }, [currentUser, fetchTasks, fetchProjects, fetchCustomColumns, fetchCategories]); // Re-subscribe when user or fetch functions change

  // RefreshData function for manual refresh
  const refreshData = React.useCallback(async () => {
    console.log('🔄 Refreshing all data...');
    setIsLoading(true);
    try {
      await Promise.all([
        fetchTasks(), 
        fetchProjects(), 
        fetchCurrentUser(),
        fetchTeamMembers(),
        fetchCustomColumns(),
        fetchCategories(),
      ]);
      console.log('✅ Data refresh complete');
    } finally {
      setIsLoading(false);
    }
  }, [fetchTasks, fetchProjects, fetchCurrentUser, fetchTeamMembers, fetchCustomColumns, fetchCategories]);

  // Show welcome message for new users
  React.useEffect(() => {
    if (projects.length > 0 && tasks.length > 0 && !isLoading) {
      const isFirstLoad = sessionStorage.getItem('welcomeShown') !== 'true';
      
      if (isFirstLoad) {
        sessionStorage.setItem('welcomeShown', 'true');
        const timeoutId = setTimeout(() => {
          toast.success('Добро пожаловать! Мы создали для вас демонстрационные проекты и задачи 📋', {
            duration: 5000,
          });
        }, 1500);
        
        // Cleanup timeout on unmount
        return () => clearTimeout(timeoutId);
      }
    }
  }, [projects.length, tasks.length, isLoading]);

  const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    try {
      const newTask = await tasksAPI.create(taskData);
      
      // FIX Issue #3: Add task immediately to state for instant UI update and DnD support
      // The newTask from API includes all required fields (id, orderKey, version, etc.)
      // Using functional update to ensure we have the latest state
      setTasks((prev) => {
        // Check if task already exists (shouldn't happen, but defensive)
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
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('авторизован')) {
        toast.error('Сессия истекла. Пожалуйста, войдите снова.', { duration: 5000 });
        // Trigger logout
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(error.message || 'Ошибка создания задачи');
      }
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>, options?: { silent?: boolean }): Promise<Task> => {
    // Сохраняем оригинальную задачу для возможного отката
    let originalTask: Task | undefined;
    
    // Оптимистичное обновление UI - обновляем сразу для мгновенного отклика
    setTasks((prev) => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      
      originalTask = task;
      const updatedTaskOptimistic = { ...task, ...updates, updatedAt: new Date().toISOString() };
      return prev.map((t) => (t.id === taskId ? updatedTaskOptimistic : t));
    });
    
    try {
      const updatedTask = await tasksAPI.update(taskId, updates);
      // Обновляем с реальными данными сервера
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
      
      // Показываем toast только если это не silent update (например, при перемещении карточки)
      if (!options?.silent) {
        toast.success('Задача обновлена');
      }
      return updatedTask;
    } catch (error: any) {
      console.error('Update task error:', error);
      
      // Откатываем оптимистичное обновление в случае ошибки
      if (originalTask) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? originalTask : t)));
      }
      
      // Check if it's a permission error (403)
      if (error.message && (error.message.includes('permission') || error.message.includes('do not have'))) {
        toast.error('У вас недостаточно прав для выполнения этого действия', { duration: 5000 });
      } else if (error.message && error.message.includes('авторизован')) {
        // Check if it's an authentication error
        toast.error('Сессия истекла. Пожалуйста, войдите снова.', { duration: 5000 });
        // Trigger logout
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(error.message || 'Ошибка обновления задачи');
      }
      throw error;
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    // Сохраняем задачу на случай отката
    let deletedTask: Task | undefined;
    
    // Оптимистично удаляем из UI
    setTasks((prev) => {
      deletedTask = prev.find(t => t.id === taskId);
      return prev.filter((t) => t.id !== taskId);
    });
    
    try {
      await tasksAPI.delete(taskId);
      toast.success('Задача удалена');
    } catch (error: any) {
      console.error('Delete task error:', error);
      
      // Откатываем удаление в случае ошибки
      if (deletedTask) {
        setTasks((prev) => [...prev, deletedTask]);
      }
      
      // Check if it's a permission error (403)
      if (error.message && (error.message.includes('permission') || error.message.includes('do not have'))) {
        toast.error('У вас недостаточно прав для выполнения этого действия', { duration: 5000 });
      } else {
        toast.error(error.message || 'Ошибка удаления задачи');
      }
      throw error;
    }
  };

  const createProject = async (projectData: Partial<Project>): Promise<Project> => {
    try {
      const newProject = await projectsAPI.create(projectData);
      // Immediately refetch projects to ensure we have the correct role and membership data
      await fetchProjects();
      toast.success('Проект создан');
      return newProject;
    } catch (error: any) {
      console.error('Create project error:', error);
      toast.error(error.message || 'Ошибка создания проекта');
      throw error;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project> => {
    // Сохраняем оригинальный проект для возможного отката
    let originalProject: Project | undefined;
    
    // Оптимистичное обновление
    setProjects((prev) => {
      const project = prev.find(p => p.id === projectId);
      if (!project) return prev;
      
      originalProject = project;
      const updatedProjectOptimistic = { ...project, ...updates };
      return prev.map((p) => (p.id === projectId ? updatedProjectOptimistic : p));
    });
    
    try {
      const updatedProject = await projectsAPI.update(projectId, updates);
      // Обновляем реальными данными с сервера
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updatedProject : p)));
      toast.success('Проект обновлен');
      return updatedProject;
    } catch (error: any) {
      console.error('Update project error:', error);
      
      // Откатываем оптимистичное обновление
      if (originalProject) {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? originalProject : p)));
      }
      
      toast.error(error.message || 'Ошибка обновления проекта');
      throw error;
    }
  };

  const archiveProject = async (projectId: string): Promise<void> => {
    // Сохраняем для отката
    let originalProject: Project | undefined;
    
    // Оптимистично удаляем проект из активных
    setProjects((prev) => {
      originalProject = prev.find(p => p.id === projectId);
      return prev.filter((p) => p.id !== projectId);
    });
    
    try {
      const archivedProject = await projectsAPI.archive(projectId);
      // Добавляем в архивные проекты
      setArchivedProjects((prev) => [...prev, archivedProject]);
      toast.success('Проект отправлен в архив');
    } catch (error: any) {
      console.error('Archive project error:', error);
      
      // Откатываем изменения
      if (originalProject) {
        setProjects((prev) => [...prev, originalProject]);
      }
      
      toast.error(error.message || 'Ошибка архивирования проекта');
      throw error;
    }
  };

  const restoreProject = async (projectId: string): Promise<void> => {
    // Сохраняем для отката
    let originalProject: Project | undefined;
    
    // Оптимистично удаляем из архива
    setArchivedProjects((prev) => {
      originalProject = prev.find(p => p.id === projectId);
      return prev.filter((p) => p.id !== projectId);
    });
    
    try {
      const restoredProject = await projectsAPI.restore(projectId);
      // Добавляем в активные проекты
      setProjects((prev) => [...prev, restoredProject]);
      toast.success('Проект восстановлен из архива');
    } catch (error: any) {
      console.error('Restore project error:', error);
      
      // Откатываем изменения
      if (originalProject) {
        setArchivedProjects((prev) => [...prev, originalProject]);
      }
      
      toast.error(error.message || 'Ошибка восстановления проекта');
      throw error;
    }
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    // Сохраняем данные для отката
    let deletedProject: Project | undefined;
    
    // Оптимистично удаляем из архивных проектов
    setArchivedProjects((prev) => {
      deletedProject = prev.find(p => p.id === projectId);
      return prev.filter((p) => p.id !== projectId);
    });
    
    try {
      await projectsAPI.delete(projectId);
      toast.success('Проект удален навсегда');
    } catch (error: any) {
      console.error('Delete project error:', error);
      
      // Откатываем удаление
      if (deletedProject) {
        setArchivedProjects((prev) => [...prev, deletedProject]);
      }
      
      toast.error(error.message || 'Ошибка удаления проекта');
      throw error;
    }
  };

  /**
   * Leave a project
   * FIX Problem #6: Add leave project functionality
   */
  const leaveProject = async (projectId: string): Promise<void> => {
    try {
      await projectsAPI.leave(projectId);
      
      // Remove project from local state
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setArchivedProjects((prev) => prev.filter((p) => p.id !== projectId));
      
      toast.success('Вы вышли из проекта');
    } catch (error: any) {
      console.error('Leave project error:', error);
      toast.error(error.message || 'Ошибка выхода из проекта');
      throw error;
    }
  };

  /**
   * Transfer project ownership to another member
   * FIX Problem #6: Add transfer ownership functionality
   */
  const transferProjectOwnership = async (projectId: string, newOwnerId: string): Promise<void> => {
    try {
      const result = await projectsAPI.transferOwnership(projectId, newOwnerId);
      
      // Update project in local state
      if (result.project) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? result.project : p))
        );
      }
      
      toast.success('Владелец проекта изменён');
    } catch (error: any) {
      console.error('Transfer ownership error:', error);
      toast.error(error.message || 'Ошибка передачи владения');
      throw error;
    }
  };

  const uploadTaskAttachment = async (taskId: string, file: File): Promise<TaskAttachment> => {
    try {
      console.log(`📎 uploadTaskAttachment: Starting upload for task ${taskId}, file: ${file.name}`);
      const attachment = await tasksAPI.uploadAttachment(taskId, file);
      console.log(`✅ uploadTaskAttachment: Upload successful, attachment ID: ${attachment.id}`);
      
      // Update task in state
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
  };

  const uploadMultipleTaskAttachments = async (taskId: string, files: File[]): Promise<TaskAttachment[]> => {
    try {
      console.log(`📎 uploadMultipleTaskAttachments: Starting upload for task ${taskId}, ${files.length} files`);
      const attachments = await tasksAPI.uploadMultipleAttachments(taskId, files);
      console.log(`✅ uploadMultipleTaskAttachments: Upload successful, ${attachments.length} attachments`);
      
      // Update task in state with all new attachments
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
  };

  const deleteTaskAttachment = async (taskId: string, attachmentId: string): Promise<void> => {
    try {
      await tasksAPI.deleteAttachment(taskId, attachmentId);
      
      // Update task in state
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
  };

  const addTaskComment = async (taskId: string, text: string): Promise<Comment> => {
    try {
      const { comment } = await tasksAPI.addComment(taskId, text);
      
      // Update task in state, adding the new comment
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
  };

  const uploadProjectAttachment = async (projectId: string, file: File): Promise<any> => {
    try {
      console.log(`📎 uploadProjectAttachment: Uploading file ${file.name} for project ${projectId}`);
      const attachment = await tasksAPI.uploadProjectAttachment(projectId, file);
      console.log(`✅ uploadProjectAttachment: Upload successful, attachment:`, attachment);
      return attachment;
    } catch (error: any) {
      console.error(`❌ uploadProjectAttachment: Error uploading file ${file.name}:`, error);
      toast.error(error.message || 'Ошибка загрузки файла');
      throw error;
    }
  };

  const deleteProjectAttachment = async (projectId: string, attachmentId: string): Promise<void> => {
    try {
      console.log(`🗑️ deleteProjectAttachment: Deleting attachment ${attachmentId} from project ${projectId}`);
      await tasksAPI.deleteProjectAttachment(projectId, attachmentId);
      console.log(`✅ deleteProjectAttachment: Attachment deleted successfully`);
      toast.success('Файл удалён');
    } catch (error: any) {
      console.error(`❌ deleteProjectAttachment: Error deleting attachment:`, error);
      toast.error(error.message || 'Ошибка удаления файла');
      throw error;
    }
  };

  // ========== PERMISSION HELPERS ==========

  /**
   * Get user's role in a project
   */
  const getUserRoleInProject = React.useCallback((projectId: string): UserRole => {
    if (!currentUser) return null;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    
    // Check if user is project owner (prioritize ownership check)
    // Owner check should happen first and take precedence
    const isOwner = project.userId === currentUser.id && !(project as any).isShared;
    if (isOwner) {
      return 'owner';
    }
    
    // Check members list only if not owner
    if (project.members && Array.isArray(project.members)) {
      const member = project.members.find((m: any) => 
        m.userId === currentUser.id || m.email === currentUser.email
      );
      
      if (member) {
        return member.role || 'member'; // Default to 'member' if role not specified
      }
    }
    
    return null;
  }, [currentUser, projects]);

  /**
   * Check if user can view all tasks in project
   * Owner, Admin/Collaborator, Viewer - can view all tasks
   * Member - can only view assigned tasks
   */
  const canViewAllProjectTasks = React.useCallback((projectId: string): boolean => {
    const role = getUserRoleInProject(projectId);
    return role === 'owner' || role === 'collaborator' || role === 'viewer';
  }, [getUserRoleInProject]);

  /**
   * Check if user can edit task
   * Owner, Admin/Collaborator - can edit any task
   * Member - can only edit assigned tasks
   * Viewer - cannot edit
   */
  const canEditTask = React.useCallback((task: Task): boolean => {
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

  /**
   * Check if user can delete task
   * Owner, Collaborator - can delete any task in project
   * Member - CANNOT delete tasks (security requirement)
   * Viewer - cannot delete
   */
  const canDeleteTask = React.useCallback((task: Task): boolean => {
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

  /**
   * Check if user can create task in project
   * Owner, Admin/Collaborator, Member - can create tasks
   * Viewer - cannot create
   */
  const canCreateTask = React.useCallback((projectId?: string): boolean => {
    if (!currentUser) return false;
    
    // Personal tasks can always be created
    if (!projectId) return true;
    
    const role = getUserRoleInProject(projectId);
    return role === 'owner' || role === 'collaborator' || role === 'member';
  }, [currentUser, getUserRoleInProject]);

  /**
   * Check if user can edit project
   * Owner, Admin/Collaborator - can edit project
   * Member, Viewer - cannot edit project
   */
  const canEditProject = React.useCallback((projectId: string): boolean => {
    const role = getUserRoleInProject(projectId);
    return role === 'owner' || role === 'collaborator';
  }, [getUserRoleInProject]);

  /**
   * Check if user can delete project
   * Only Owner can delete project
   */
  const canDeleteProject = React.useCallback((projectId: string): boolean => {
    const role = getUserRoleInProject(projectId);
    return role === 'owner';
  }, [getUserRoleInProject]);

  /**
   * Check if user has a specific permission in a project
   * FIX Problem #2: Generic permission checker using RBAC system
   */
  const hasPermission = React.useCallback((permission: Permission, projectId?: string): boolean => {
    if (!currentUser) return false;
    
    // For permissions that don't require a project context
    if (!projectId) {
      // Global permissions - can be extended later
      return false;
    }
    
    // Get user's role in the project
    const role = getUserRoleInProject(projectId);
    if (!role) return false;
    
    // Check if role has the permission
    return hasRolePermission(role as RBACUserRole, permission);
  }, [currentUser, getUserRoleInProject]);

  const value: AppContextType = {
    tasks,
    projects,
    archivedProjects,
    currentUser,
    teamMembers,
    customColumns,
    categories,
    isLoading,
    isInitialLoad,
    isRealtimeConnected,
    fetchTasks,
    loadTask,
    fetchProjects,
    fetchArchivedProjects,
    fetchCurrentUser,
    fetchTeamMembers,
    fetchCustomColumns,
    saveCustomColumns,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    updateCurrentUser,
    uploadAvatar,
    deleteAvatar,
    createTask,
    updateTask,
    deleteTask,
    uploadTaskAttachment,
    uploadMultipleTaskAttachments,
    deleteTaskAttachment,
    addTaskComment,
    uploadProjectAttachment,
    deleteProjectAttachment,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    deleteProject,
    leaveProject,
    transferProjectOwnership,
    refreshData,
    setIsDragging,
    // Direct state setters for WebSocket updates
    setTasks,
    // Permission helpers
    getUserRoleInProject,
    canViewAllProjectTasks,
    canEditTask,
    canDeleteTask,
    canCreateTask,
    canEditProject,
    canDeleteProject,
    hasPermission,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
