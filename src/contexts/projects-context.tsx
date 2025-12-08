import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { projectsAPI, teamAPI, tagsAPI, getAuthToken } from '../utils/api-client';
import { Project, TeamMember, UserRole } from '../types';
import { toast } from 'sonner';
import { useAuth } from './auth-context';
import { useWebSocket } from './websocket-context';
import { hasRolePermission, type Permission, type UserRole as RBACUserRole } from '../lib/rbac';

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

interface ProjectsContextType {
  projects: Project[];
  archivedProjects: Project[];
  teamMembers: TeamMember[];
  isLoading: boolean;
  projectTags: Record<string, string[]>; // projectId -> tags[]
  personalTags: string[];
  fetchProjects: () => Promise<void>;
  fetchArchivedProjects: () => Promise<void>;
  fetchTeamMembers: () => Promise<void>;
  fetchProjectTags: (projectId: string) => Promise<void>;
  fetchPersonalTags: () => Promise<void>;
  addProjectTag: (projectId: string, tag: string) => Promise<void>;
  deleteProjectTag: (projectId: string, tag: string) => Promise<void>;
  addPersonalTag: (tag: string) => Promise<void>;
  deletePersonalTag: (tag: string) => Promise<void>;
  createProject: (projectData: Partial<Project>) => Promise<Project>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<Project>;
  archiveProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  leaveProject: (projectId: string) => Promise<void>;
  transferProjectOwnership: (projectId: string, newOwnerId: string) => Promise<void>;
  uploadProjectAttachment: (projectId: string, file: File) => Promise<any>;
  deleteProjectAttachment: (projectId: string, attachmentId: string) => Promise<void>;
  getUserRoleInProject: (projectId: string) => UserRole;
  canEditProject: (projectId: string) => boolean;
  canDeleteProject: (projectId: string) => boolean;
  hasPermission: (permission: Permission, projectId?: string) => boolean;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projectTags, setProjectTags] = useState<Record<string, string[]>>({});
  const [personalTags, setPersonalTags] = useState<string[]>([]);
  
  const { currentUser, isAuthenticated } = useAuth();
  const { isConnected: isWebSocketConnected, subscribe, joinProject: wsJoinProject, leaveProject: wsLeaveProject } = useWebSocket();

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const fetchedProjects = await projectsAPI.getAll();
      
      // Filter out archived projects (they should be loaded separately)
      const activeProjects = fetchedProjects.filter((p: Project) => !p.archived);
      
      // Limit projects to prevent memory issues
      const limitedProjects = activeProjects.slice(0, 500);
      if (activeProjects.length > 500) {
        console.warn(`⚠️ Показано ${limitedProjects.length} из ${activeProjects.length} проектов для оптимизации производительности`);
      }
      
      // Extract team members from all projects
      const membersMap = new Map<string, TeamMember>();
      limitedProjects.forEach((project: Project) => {
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
          return prevProjects;
        }
        console.log('✅ Проекты обновлены:', { было: prevProjects.length, стало: limitedProjects.length });
        return limitedProjects;
      });
    } catch (error: any) {
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки проектов:', error);
        toast.error('Ошибка загрузки проектов');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Автозагрузка проектов при аутентификации
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      console.log('🔄 ProjectsContext: Автозагрузка проектов при монтировании');
      fetchProjects();
    }
    // fetchProjects is stable because it's wrapped in useCallback with empty deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser?.id]);

  const fetchArchivedProjects = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }
      
      const archived = await projectsAPI.getArchived();
      console.log('✅ Архивные проекты загружены:', archived.length);
      setArchivedProjects(archived);
    } catch (error: any) {
      if (!error.message?.includes('авторизован') && !error.message?.includes('Not authenticated')) {
        console.error('❌ Ошибка загрузки архивных проектов:', error);
      }
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }
      
      // Team members are extracted from projects when projects are loaded
      console.log('✅ Участники команды будут загружены из проектов');
    } catch (error: any) {
      console.error('❌ Ошибка загрузки участников команды:', error);
    }
  }, []);

  const createProject = useCallback(async (projectData: Partial<Project>): Promise<Project> => {
    try {
      const newProject = await projectsAPI.create(projectData);
      await fetchProjects();
      toast.success('Проект создан');
      return newProject;
    } catch (error: any) {
      console.error('Create project error:', error);
      toast.error(error.message || 'Ошибка создания проекта');
      throw error;
    }
  }, [fetchProjects]);

  const updateProject = useCallback(async (projectId: string, updates: Partial<Project>): Promise<Project> => {
    let originalProject: Project | undefined;
    
    setProjects((prev) => {
      const project = prev.find(p => p.id === projectId);
      if (!project) return prev;
      
      originalProject = project;
      const updatedProjectOptimistic = { ...project, ...updates };
      return prev.map((p) => (p.id === projectId ? updatedProjectOptimistic : p));
    });
    
    try {
      const updatedProject = await projectsAPI.update(projectId, updates);
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updatedProject : p)));
      toast.success('Проект обновлен');
      return updatedProject;
    } catch (error: any) {
      console.error('Update project error:', error);
      
      if (originalProject) {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? originalProject : p)));
      }
      
      toast.error(error.message || 'Ошибка обновления проекта');
      throw error;
    }
  }, []);

  const archiveProject = useCallback(async (projectId: string): Promise<void> => {
    let originalProject: Project | undefined;
    
    setProjects((prev) => {
      originalProject = prev.find(p => p.id === projectId);
      return prev.filter((p) => p.id !== projectId);
    });
    
    try {
      const archivedProject = await projectsAPI.archive(projectId);
      setArchivedProjects((prev) => [...prev, archivedProject]);
      toast.success('Проект отправлен в архив');
    } catch (error: any) {
      console.error('Archive project error:', error);
      
      if (originalProject) {
        setProjects((prev) => [...prev, originalProject]);
      }
      
      toast.error(error.message || 'Ошибка архивирования проекта');
      throw error;
    }
  }, []);

  const restoreProject = useCallback(async (projectId: string): Promise<void> => {
    let originalArchivedProject: Project | undefined;
    
    setArchivedProjects((prev) => {
      originalArchivedProject = prev.find(p => p.id === projectId);
      return prev.filter((p) => p.id !== projectId);
    });
    
    try {
      const restoredProject = await projectsAPI.restore(projectId);
      setProjects((prev) => [...prev, restoredProject]);
      toast.success('Проект восстановлен из архива');
    } catch (error: any) {
      console.error('Restore project error:', error);
      
      if (originalArchivedProject) {
        setArchivedProjects((prev) => [...prev, originalArchivedProject]);
      }
      
      toast.error(error.message || 'Ошибка восстановления проекта');
      throw error;
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      await projectsAPI.delete(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setArchivedProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Проект удалён');
    } catch (error: any) {
      console.error('Delete project error:', error);
      toast.error(error.message || 'Ошибка удаления проекта');
      throw error;
    }
  }, []);

  const leaveProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      await projectsAPI.leave(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Вы покинули проект');
    } catch (error: any) {
      console.error('Leave project error:', error);
      toast.error(error.message || 'Ошибка выхода из проекта');
      throw error;
    }
  }, []);

  const transferProjectOwnership = useCallback(async (projectId: string, newOwnerId: string): Promise<void> => {
    try {
      await projectsAPI.transferOwnership(projectId, newOwnerId);
      
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, userId: newOwnerId }
            : p
        )
      );
      
      toast.success('Владелец проекта изменён');
    } catch (error: any) {
      console.error('Transfer ownership error:', error);
      toast.error(error.message || 'Ошибка передачи владения');
      throw error;
    }
  }, []);

  const uploadProjectAttachment = useCallback(async (projectId: string, file: File): Promise<any> => {
    try {
      console.log(`📎 uploadProjectAttachment: Uploading file ${file.name} for project ${projectId}`);
      const attachment = await projectsAPI.uploadAttachment(projectId, file);
      console.log(`✅ uploadProjectAttachment: Upload successful, attachment:`, attachment);
      return attachment;
    } catch (error: any) {
      console.error(`❌ uploadProjectAttachment: Error uploading file ${file.name}:`, error);
      toast.error(error.message || 'Ошибка загрузки файла');
      throw error;
    }
  }, []);

  const deleteProjectAttachment = useCallback(async (projectId: string, attachmentId: string): Promise<void> => {
    try {
      console.log(`🗑️ deleteProjectAttachment: Deleting attachment ${attachmentId} from project ${projectId}`);
      await projectsAPI.deleteAttachment(projectId, attachmentId);
      console.log(`✅ deleteProjectAttachment: Attachment deleted successfully`);
      toast.success('Файл удалён');
    } catch (error: any) {
      console.error(`❌ deleteProjectAttachment: Error deleting attachment:`, error);
      toast.error(error.message || 'Ошибка удаления файла');
      throw error;
    }
  }, []);

  // Permission helpers
  const getUserRoleInProject = useCallback((projectId: string): UserRole => {
    if (!currentUser) return 'viewer';
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return 'viewer';
    
    // 1. Check if user is the project owner by userId (ownerId -> userId from backend)
    if (project.userId === currentUser.id) {
      return 'owner';
    }
    
    // 2. Otherwise, search in members by userId/id/email
    if (project.members && Array.isArray(project.members)) {
      const member = project.members.find((m: any) =>
        m.userId === currentUser.id ||
        m.id === currentUser.id ||
        m.email === currentUser.email
      );
      
      if (member?.role) {
        return member.role as UserRole;
      }
    }
    
    return 'viewer';
  }, [currentUser, projects]);

  const canEditProject = useCallback((projectId: string): boolean => {
    const role = getUserRoleInProject(projectId);
    return role === 'owner' || role === 'collaborator';
  }, [getUserRoleInProject]);

  const canDeleteProject = useCallback((projectId: string): boolean => {
    const role = getUserRoleInProject(projectId);
    return role === 'owner';
  }, [getUserRoleInProject]);

  const hasPermission = useCallback((permission: Permission, projectId?: string): boolean => {
    if (!currentUser) return false;
    
    if (!projectId) {
      return false;
    }
    
    const role = getUserRoleInProject(projectId);
    if (!role) return false;
    
    return hasRolePermission(role as RBACUserRole, permission);
  }, [currentUser, getUserRoleInProject]);

  // ========== TAGS MANAGEMENT ==========

  const fetchProjectTags = useCallback(async (projectId: string) => {
    try {
      const tags = await tagsAPI.getProjectTags(projectId);
      setProjectTags(prev => ({ ...prev, [projectId]: tags }));
    } catch (error) {
      console.error('Failed to fetch project tags:', error);
      toast.error('Не удалось загрузить теги проекта');
    }
  }, []);

  const fetchPersonalTags = useCallback(async () => {
    try {
      const tags = await tagsAPI.getPersonalTags();
      setPersonalTags(tags);
    } catch (error) {
      console.error('Failed to fetch personal tags:', error);
      toast.error('Не удалось загрузить личные теги');
    }
  }, []);

  const addProjectTag = useCallback(async (projectId: string, tag: string) => {
    try {
      await tagsAPI.addProjectTag(projectId, tag);
      // Refresh project tags after adding
      await fetchProjectTags(projectId);
      toast.success('Тег добавлен в проект');
    } catch (error: any) {
      console.error('Failed to add project tag:', error);
      toast.error(error.message || 'Не удалось добавить тег');
      throw error;
    }
  }, [fetchProjectTags]);

  const deleteProjectTag = useCallback(async (projectId: string, tag: string) => {
    try {
      await tagsAPI.deleteProjectTag(projectId, tag);
      // Refresh project tags after deleting
      await fetchProjectTags(projectId);
      toast.success('Тег удалён из проекта');
    } catch (error: any) {
      console.error('Failed to delete project tag:', error);
      toast.error(error.message || 'Не удалось удалить тег');
      throw error;
    }
  }, [fetchProjectTags]);

  const addPersonalTag = useCallback(async (tag: string) => {
    try {
      await tagsAPI.addPersonalTag(tag);
      // Refresh personal tags after adding
      await fetchPersonalTags();
      toast.success('Личный тег добавлен');
    } catch (error: any) {
      console.error('Failed to add personal tag:', error);
      toast.error(error.message || 'Не удалось добавить личный тег');
      throw error;
    }
  }, [fetchPersonalTags]);

  const deletePersonalTag = useCallback(async (tag: string) => {
    try {
      await tagsAPI.deletePersonalTag(tag);
      // Refresh personal tags after deleting
      await fetchPersonalTags();
      toast.success('Личный тег удалён');
    } catch (error: any) {
      console.error('Failed to delete personal tag:', error);
      toast.error(error.message || 'Не удалось удалить личный тег');
      throw error;
    }
  }, [fetchPersonalTags]);

  // Load personal tags on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchPersonalTags();
    }
  }, [isAuthenticated, fetchPersonalTags]);

  // Load project tags when projects are loaded
  useEffect(() => {
    if (projects.length > 0) {
      projects.forEach(project => {
        fetchProjectTags(project.id);
      });
    }
  }, [projects, fetchProjectTags]);

  // Subscribe to WebSocket project events
  useEffect(() => {
    if (!isWebSocketConnected) return;

    const handleProjectUpdated = (data: { project: Project; projectId: string }) => {
      console.log('📥 ProjectsContext: project:updated', data);
      fetchProjects();
    };

    const handleProjectDeleted = (data: { projectId: string }) => {
      console.log('📥 ProjectsContext: project:deleted', data);
      setProjects(prev => prev.filter(p => p.id !== data.projectId));
      setArchivedProjects(prev => prev.filter(p => p.id !== data.projectId));
    };

    const handleProjectMemberAdded = (data: { projectId: string; member: any }) => {
      console.log('📥 ProjectsContext: project:member_added', data);
      fetchProjects();
      fetchTeamMembers();
      toast.info(`New member joined: ${data.member.user?.name || data.member.email}`);
    };

    const handleProjectMemberRemoved = (data: { projectId: string; memberId: string }) => {
      console.log('📥 ProjectsContext: project:member_removed', data);
      fetchProjects();
    };

    const handleInviteAccepted = (data: { invitationId: string; projectId: string; userId: string }) => {
      console.log('📥 ProjectsContext: invite:accepted', data);
      fetchProjects();
      fetchTeamMembers();
    };

    const handleProjectTagsUpdated = (data: { projectId: string; tags: string[]; timestamp: string }) => {
      console.log('📥 ProjectsContext: project:tags_updated', data);
      
      // Update local state
      setProjectTags(prev => ({
        ...prev,
        [data.projectId]: data.tags,
      }));
    };

    const handlePersonalTagsUpdated = (data: { userId: string; tags: string[]; timestamp: string }) => {
      console.log('📥 ProjectsContext: user:tags_updated', data);
      
      // Update local state only if it's for the current user
      if (currentUser && data.userId === currentUser.id) {
        setPersonalTags(data.tags);
      }
    };

    const unsubscribers = [
      subscribe('project:updated', handleProjectUpdated),
      subscribe('project:deleted', handleProjectDeleted),
      subscribe('project:member_added', handleProjectMemberAdded),
      subscribe('project:member_removed', handleProjectMemberRemoved),
      subscribe('invite:accepted', handleInviteAccepted),
      subscribe('project:tags_updated', handleProjectTagsUpdated),
      subscribe('user:tags_updated', handlePersonalTagsUpdated),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isWebSocketConnected, subscribe, fetchProjects, fetchTeamMembers, currentUser]);

  // Auto-join project rooms when authenticated and connected
  useEffect(() => {
    if (!isAuthenticated || !isWebSocketConnected || projects.length === 0) return;
    
    projects.forEach((project) => {
      wsJoinProject(project.id);
      console.log(`📥 Auto-joined project room: project:${project.id}`);
    });

    return () => {
      projects.forEach((project) => {
        wsLeaveProject(project.id);
      });
    };
  }, [isAuthenticated, isWebSocketConnected, projects, wsJoinProject, wsLeaveProject]);

  const value: ProjectsContextType = {
    projects,
    archivedProjects,
    teamMembers,
    isLoading,
    projectTags,
    personalTags,
    fetchProjects,
    fetchArchivedProjects,
    fetchTeamMembers,
    fetchProjectTags,
    fetchPersonalTags,
    addProjectTag,
    deleteProjectTag,
    addPersonalTag,
    deletePersonalTag,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    deleteProject,
    leaveProject,
    transferProjectOwnership,
    uploadProjectAttachment,
    deleteProjectAttachment,
    getUserRoleInProject,
    canEditProject,
    canDeleteProject,
    hasPermission,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
