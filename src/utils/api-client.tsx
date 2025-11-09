/**
 * API Client for self-hosted backend
 * Replaces Supabase client with JWT-based authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// ========== TOKEN MANAGEMENT ==========

const TOKEN_KEY = 'auth_token';

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

const clearAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// ========== AUTH API ==========

export const authAPI = {
  signUp: async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign up');
      }

      const data = await response.json();
      setAuthToken(data.token);
      
      return {
        user: data.user,
        session: { access_token: data.token },
      };
    } catch (error: any) {
      console.error('SignUp error:', error);
      throw error;
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign in');
      }

      const data = await response.json();
      setAuthToken(data.token);
      
      return {
        user: data.user,
        session: { access_token: data.token },
      };
    } catch (error: any) {
      console.error('SignIn error:', error);
      throw error;
    }
  },

  signOut: async () => {
    clearAuthToken();
    return { error: null };
  },

  forgotPassword: async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send password reset email');
      }

      const data = await response.json();
      return { message: data.message };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw error;
    }
  },

  resetPassword: async (token: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      const data = await response.json();
      return { message: data.message };
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw error;
    }
  },

  getCurrentUser: async () => {
    const token = getAuthToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        clearAuthToken();
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Get current user error:', error);
      clearAuthToken();
      return null;
    }
  },

  updateProfile: async (updates: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // TODO: Implement profile update endpoint
    console.warn('Profile update endpoint not yet implemented');
    return updates;
  },

  uploadAvatar: async (file: File) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload avatar');
    }

    const data = await response.json();
    return data.avatarUrl;
  },

  deleteAvatar: async () => {
    // TODO: Implement avatar delete endpoint
    console.warn('Avatar delete endpoint not yet implemented');
    return true;
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    // Simple implementation - check for user on mount
    authAPI.getCurrentUser().then(callback);
    
    // Return unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  },
};

// ========== TASKS API ==========

export const tasksAPI = {
  getAll: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Tasks are stored in KV store
    const response = await fetch(`${API_BASE_URL}/api/kv/tasks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }

    const data = await response.json();
    return data.value || [];
  },

  create: async (taskData: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Get existing tasks
    const tasks = await tasksAPI.getAll();
    
    // Create new task
    const newTask = {
      ...taskData,
      id: taskData.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save updated tasks
    tasks.push(newTask);
    await fetch(`${API_BASE_URL}/api/kv/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: tasks }),
    });

    return newTask;
  },

  update: async (taskId: string, updates: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Get existing tasks
    const tasks = await tasksAPI.getAll();
    
    // Find and update task
    const index = tasks.findIndex((t: any) => t.id === taskId);
    if (index === -1) {
      throw new Error('Task not found');
    }

    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Save updated tasks
    await fetch(`${API_BASE_URL}/api/kv/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: tasks }),
    });

    return tasks[index];
  },

  delete: async (taskId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Get existing tasks
    const tasks = await tasksAPI.getAll();
    
    // Filter out deleted task
    const updatedTasks = tasks.filter((t: any) => t.id !== taskId);

    // Save updated tasks
    await fetch(`${API_BASE_URL}/api/kv/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: updatedTasks }),
    });

    return true;
  },

  uploadAttachment: async (taskId: string, file: File) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', taskId);

    const response = await fetch(`${API_BASE_URL}/api/upload-attachment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload attachment');
    }

    const data = await response.json();
    return data.attachment;
  },

  deleteAttachment: async (taskId: string, attachmentId: string) => {
    // TODO: Implement attachment delete
    console.warn('Attachment delete not yet implemented');
    return true;
  },
};

// ========== PROJECTS API ==========

export const projectsAPI = {
  getAll: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/kv/projects`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    const data = await response.json();
    return data.value || [];
  },

  create: async (projectData: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const projects = await projectsAPI.getAll();
    
    const newProject = {
      ...projectData,
      id: projectData.id || `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projects.push(newProject);
    await fetch(`${API_BASE_URL}/api/kv/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: projects }),
    });

    return newProject;
  },

  update: async (projectId: string, updates: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const projects = await projectsAPI.getAll();
    const index = projects.findIndex((p: any) => p.id === projectId);
    
    if (index === -1) {
      throw new Error('Project not found');
    }

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await fetch(`${API_BASE_URL}/api/kv/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: projects }),
    });

    return projects[index];
  },

  archive: async (projectId: string) => {
    return projectsAPI.update(projectId, { archived: true });
  },

  restore: async (projectId: string) => {
    return projectsAPI.update(projectId, { archived: false });
  },

  delete: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const projects = await projectsAPI.getAll();
    const updatedProjects = projects.filter((p: any) => p.id !== projectId);

    await fetch(`${API_BASE_URL}/api/kv/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: updatedProjects }),
    });

    return true;
  },

  getArchived: async () => {
    const projects = await projectsAPI.getAll();
    return projects.filter((p: any) => p.archived);
  },

  getTasks: async (projectId: string) => {
    const tasks = await tasksAPI.getAll();
    return tasks.filter((t: any) => t.projectId === projectId);
  },
};

// ========== INVITATIONS API ==========

export const invitationsAPI = {
  getMyInvitations: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/kv/invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch invitations');
    }

    const data = await response.json();
    return data.value || [];
  },

  acceptInvitation: async (projectId: string, invitationId: string) => {
    // TODO: Implement invitation acceptance
    console.warn('Invitation acceptance not yet implemented');
    return { success: true };
  },
};

// ========== TEAM MEMBERS API ==========

export const teamAPI = {
  getMembers: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/kv/members`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch members');
    }

    const data = await response.json();
    return data.value || [];
  },
};

// ========== DIAGNOSTICS API ==========

export const diagnosticsAPI = {
  diagnoseProjectTasks: async (projectId: string) => {
    console.warn('Diagnostics not implemented for new backend');
    return { issues: [] };
  },

  migrateProjectTasks: async (projectId: string) => {
    console.warn('Migration not implemented for new backend');
    return { success: true };
  },
};

// ========== USER SETTINGS API (Custom Columns) ==========

export const userSettingsAPI = {
  getCustomColumns: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/kv/custom_columns`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch custom columns');
    }

    const data = await response.json();
    return data.value || [];
  },

  saveCustomColumns: async (customColumns: Array<{ id: string; title: string; color: string }>) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    await fetch(`${API_BASE_URL}/api/kv/custom_columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: customColumns }),
    });

    return customColumns;
  },
};
