/**
 * API Client for self-hosted backend
 * Replaces Supabase client with JWT-based authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

/**
 * Get user ID from JWT token
 */
const getUserIdFromToken = (): string | null => {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    // Decode JWT token (without verifying - verification happens on server)
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

    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }

    return await response.json();
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
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/avatar`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete avatar');
    }

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

    // Use new Prisma-based endpoint
    const response = await fetch(`${API_BASE_URL}/api/tasks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch tasks' }));
      throw new Error(errorData.error || 'Failed to fetch tasks');
    }

    const tasks = await response.json();
    return tasks;
  },

  create: async (taskData: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Use new Prisma-based endpoint
    const response = await fetch(`${API_BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create task' }));
      throw new Error(errorData.error || `Failed to create task: ${response.status} ${response.statusText}`);
    }

    const newTask = await response.json();
    return newTask;
  },

  update: async (taskId: string, updates: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Use new Prisma-based endpoint
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update task' }));
      throw new Error(errorData.error || `Failed to update task: ${response.status} ${response.statusText}`);
    }

    const updatedTask = await response.json();
    return updatedTask;
  },

  delete: async (taskId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // Use new Prisma-based endpoint
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete task' }));
      throw new Error(errorData.error || `Failed to delete task: ${response.status} ${response.statusText}`);
    }

    return true;
  },

  uploadAttachment: async (taskId: string, file: File) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('files', file);
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
    // Return first attachment for backward compatibility
    return data.attachments?.[0] || data.attachment;
  },

  uploadMultipleAttachments: async (taskId: string, files: File[]) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
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
      throw new Error(error.error || 'Failed to upload attachments');
    }

    const data = await response.json();
    return data.attachments;
  },

  deleteAttachment: async (taskId: string, attachmentId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete attachment');
    }

    return true;
  },

  /**
   * Upload project attachment
   */
  uploadProjectAttachment: async (projectId: string, file: File) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    const response = await fetch(`${API_BASE_URL}/api/upload-project-attachment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload project attachment');
    }

    const data = await response.json();
    return data.attachment;
  },
};

// ========== PROJECTS API ==========

export const projectsAPI = {
  /**
   * Get all projects accessible to the user (owned + member of)
   */
  getAll: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    const projects = await response.json();
    return projects;
  },

  /**
   * Create a new project
   */
  create: async (projectData: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create project');
    }

    const newProject = await response.json();
    return newProject;
  },

  /**
   * Update a project
   */
  update: async (projectId: string, updates: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update project');
    }

    const updatedProject = await response.json();
    return updatedProject;
  },

  /**
   * Archive a project
   */
  archive: async (projectId: string) => {
    return projectsAPI.update(projectId, { archived: true });
  },

  /**
   * Restore an archived project
   */
  restore: async (projectId: string) => {
    return projectsAPI.update(projectId, { archived: false });
  },

  /**
   * Delete a project
   */
  delete: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete project');
    }

    return true;
  },

  /**
   * Get archived projects
   */
  getArchived: async () => {
    const projects = await projectsAPI.getAll();
    return projects.filter((p: any) => p.archived);
  },

  /**
   * Get tasks in a project
   */
  getTasks: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tasks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch project tasks');
    }

    const tasks = await response.json();
    return tasks;
  },

  /**
   * Get project members
   */
  getProjectMembers: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch project members');
    }

    const members = await response.json();
    return members;
  },

  /**
   * Get pending invitations for current user
   */
  getMyPendingInvitations: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/my/pending_invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pending invitations');
    }

    const invitations = await response.json();
    return invitations;
  },

  /**
   * Accept an invitation using token
   */
  acceptInvitation: async (token: string) => {
    const authToken = getAuthToken();
    if (!authToken) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/invitations/${token}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept invitation');
    }

    const result = await response.json();
    return result;
  },

  /**
   * Reject an invitation (revoke)
   */
  rejectInvitation: async (invitationId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject invitation');
    }

    return true;
  },

  /**
   * Send invitation to project
   */
  sendInvitation: async (projectId: string, email: string, role: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invitation');
    }

    return await response.json();
  },

  /**
   * Revoke invitation
   */
  revokeInvitation: async (projectId: string, invitationId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke invitation');
    }

    return true;
  },

  /**
   * Update member role
   */
  updateMemberRole: async (projectId: string, memberId: string, role: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update member role');
    }

    return await response.json();
  },

  /**
   * Remove member from project
   */
  removeMember: async (projectId: string, memberId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove member');
    }

    return true;
  },

  /**
   * Get invitations for a project
   * FIX: Added to fetch real-time invitation data from database
   */
  getProjectInvitations: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch project invitations');
    }

    const data = await response.json();
    return data.invitations || [];
  },

  /**
   * Resend invitation
   * FIX: Added to resend invitations using backend API
   */
  resendInvitation: async (invitationId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resend invitation');
    }

    return await response.json();
  },

  /**
   * Get categories available for a specific project
   * FIX Problem #3: Returns only categories assigned to this project
   */
  getProjectCategories: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/categories`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch project categories');
    }

    const categories = await response.json();
    return categories;
  },
};
// ========== INVITATIONS API ==========

export const invitationsAPI = {
  /**
   * Get invitations sent to current user's email
   */
  getMyInvitations: async () => {
    return projectsAPI.getMyPendingInvitations();
  },

  /**
   * Accept an invitation using token (delegates to projectsAPI)
   */
  acceptInvitation: async (token: string) => {
    return projectsAPI.acceptInvitation(token);
  },
  
  /**
   * Reject an invitation using database ID (delegates to projectsAPI)
   */
  rejectInvitation: async (invitationId: string) => {
    return projectsAPI.rejectInvitation(invitationId);
  },
};

// ========== TEAM MEMBERS API ==========

export const teamAPI = {
  getMembers: async (projectId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch members');
    }

    const members = await response.json();
    return members;
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/custom_columns`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch custom columns');
    }

    const columns = await response.json();
    return columns;
  },

  saveCustomColumns: async (customColumns: Array<{ id: string; title: string; color: string }>) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/custom_columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ columns: customColumns }),
    });

    if (!response.ok) {
      throw new Error('Failed to save custom columns');
    }

    return customColumns;
  },
};

// ========== CATEGORIES API ==========

export const categoriesAPI = {
  getCategories: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/categories`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    const categories = await response.json();
    return categories;
  },

  saveCategories: async (categories: Array<{ id: string; name: string; color: string }>) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ categories }),
    });

    if (!response.ok) {
      throw new Error('Failed to save categories');
    }

    return categories;
  },
};
