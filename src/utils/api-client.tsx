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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    // Tasks are stored in user-scoped KV store
    const response = await fetch(`${API_BASE_URL}/api/kv/tasks:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

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
    await fetch(`${API_BASE_URL}/api/kv/tasks:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

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
    await fetch(`${API_BASE_URL}/api/kv/tasks:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    // Get existing tasks
    const tasks = await tasksAPI.getAll();
    
    // Filter out deleted task
    const updatedTasks = tasks.filter((t: any) => t.id !== taskId);

    // Save updated tasks
    await fetch(`${API_BASE_URL}/api/kv/tasks:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    // Fetch owned projects
    const ownedResponse = await fetch(`${API_BASE_URL}/api/kv/projects:${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!ownedResponse.ok) {
      throw new Error('Failed to fetch projects');
    }

    const ownedData = await ownedResponse.json();
    const ownedProjects = ownedData.value || [];
    
    // Fetch shared projects (projects where user is a member)
    const sharedResponse = await fetch(`${API_BASE_URL}/api/kv/shared_projects:${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    let sharedProjects = [];
    if (sharedResponse.ok) {
      const sharedData = await sharedResponse.json();
      const projectRefs = sharedData.value || []; // Array of {projectId, ownerId, role}
      
      // Fetch actual project data for each shared project
      for (const ref of projectRefs) {
        try {
          const projectResponse = await fetch(`${API_BASE_URL}/api/kv/project:${ref.projectId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            if (projectData.value) {
              sharedProjects.push({
                ...projectData.value,
                userRole: ref.role, // Add user's role in this project
                isShared: true,
              });
            }
          }
        } catch (error) {
          console.error(`Failed to fetch shared project ${ref.projectId}:`, error);
        }
      }
    }
    
    // Combine owned and shared projects
    return [...ownedProjects, ...sharedProjects];
  },

  create: async (projectData: any) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const projects = await projectsAPI.getAll();
    
    const newProject = {
      ...projectData,
      id: projectData.id || `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projects.push(newProject);
    await fetch(`${API_BASE_URL}/api/kv/projects:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

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

    await fetch(`${API_BASE_URL}/api/kv/projects:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const projects = await projectsAPI.getAll();
    const updatedProjects = projects.filter((p: any) => p.id !== projectId);

    await fetch(`${API_BASE_URL}/api/kv/projects:${userId}`, {
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
  
  // ========== PROJECT SHARING METHODS ==========
  
  /**
   * Send invitation to join project
   */
  sendInvitation: async (projectId: string, email: string, role: 'admin' | 'collaborator' | 'member' | 'viewer') => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');
    
    // Create invitation
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const invitation = {
      id: invitationId,
      projectId,
      projectOwnerId: userId,
      invitedEmail: email,
      role,
      status: 'pending',
      sentDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      inviteLink: `${window.location.origin}/invite/${invitationId}`,
    };
    
    // Store invitation globally so invitee can see it
    const invitationsResponse = await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    let allInvitations = [];
    if (invitationsResponse.ok) {
      const data = await invitationsResponse.json();
      allInvitations = data.value || [];
    }
    
    allInvitations.push(invitation);
    
    await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: allInvitations }),
    });
    
    // Also update project with invitation
    const projects = await projectsAPI.getAll();
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    
    let projectName = 'Проект';
    if (projectIndex !== -1) {
      const project = projects[projectIndex];
      projectName = project.name;
      project.invitations = [...(project.invitations || []), invitation];
      await projectsAPI.update(projectId, { invitations: project.invitations });
    }
    
    // Send invitation email
    try {
      await fetch(`${API_BASE_URL}/api/invitations/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          invitationId: invitation.id,
          email: invitation.invitedEmail,
          projectName: projectName,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        }),
      });
      console.log('✅ Invitation email sent to:', email);
    } catch (emailError) {
      console.warn('⚠️ Failed to send invitation email (invitation still created):', emailError);
    }
    
    console.log('✅ Invitation sent:', invitation);
    return invitation;
  },
  
  /**
   * Get invitations for current user (by email)
   */
  getMyPendingInvitations: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    // Get current user email
    const userResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get current user');
    }
    
    const userData = await userResponse.json();
    const userEmail = userData.user.email;
    
    // Fetch all pending invitations
    const response = await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const allInvitations = data.value || [];
    
    // Filter invitations for this user's email
    return allInvitations.filter((inv: any) => 
      inv.invitedEmail.toLowerCase() === userEmail.toLowerCase() && 
      inv.status === 'pending' &&
      new Date(inv.expiresAt) > new Date() // Not expired
    );
  },
  
  /**
   * Accept project invitation
   */
  acceptInvitation: async (invitationId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');
    
    // Get the invitation
    const invitationsResponse = await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!invitationsResponse.ok) {
      throw new Error('Failed to fetch invitations');
    }
    
    const invitationsData = await invitationsResponse.json();
    const allInvitations = invitationsData.value || [];
    const invitationIndex = allInvitations.findIndex((inv: any) => inv.id === invitationId);
    
    if (invitationIndex === -1) {
      throw new Error('Invitation not found');
    }
    
    const invitation = allInvitations[invitationIndex];
    
    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error('Invitation has expired');
    }
    
    // Update invitation status
    allInvitations[invitationIndex].status = 'accepted';
    allInvitations[invitationIndex].acceptedAt = new Date().toISOString();
    
    await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: allInvitations }),
    });
    
    // Add user to project's shared_projects list
    const sharedProjectsResponse = await fetch(`${API_BASE_URL}/api/kv/shared_projects:${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    let sharedProjects = [];
    if (sharedProjectsResponse.ok) {
      const data = await sharedProjectsResponse.json();
      sharedProjects = data.value || [];
    }
    
    // Add project reference
    sharedProjects.push({
      projectId: invitation.projectId,
      ownerId: invitation.projectOwnerId,
      role: invitation.role,
      joinedAt: new Date().toISOString(),
    });
    
    await fetch(`${API_BASE_URL}/api/kv/shared_projects:${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: sharedProjects }),
    });
    
    // Store project data separately for shared access
    // Fetch the project from owner
    const projectResponse = await fetch(`${API_BASE_URL}/api/kv/projects:${invitation.projectOwnerId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (projectResponse.ok) {
      const projectsData = await projectResponse.json();
      const ownerProjects = projectsData.value || [];
      const project = ownerProjects.find((p: any) => p.id === invitation.projectId);
      
      if (project) {
        // Store project in shared location
        await fetch(`${API_BASE_URL}/api/kv/project:${invitation.projectId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ value: project }),
        });
        
        // Add member to project
        const members = project.members || [];
        const userResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          members.push({
            id: userId,
            userId: userId,
            name: userData.user.name,
            email: userData.user.email,
            role: invitation.role,
            addedDate: new Date().toISOString(),
          });
          
          // Update project with new member
          project.members = members;
          
          // Update in owner's projects
          const projectIndex = ownerProjects.findIndex((p: any) => p.id === invitation.projectId);
          if (projectIndex !== -1) {
            ownerProjects[projectIndex] = project;
            await fetch(`${API_BASE_URL}/api/kv/projects:${invitation.projectOwnerId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ value: ownerProjects }),
            });
          }
          
          // Update in shared location
          await fetch(`${API_BASE_URL}/api/kv/project:${invitation.projectId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ value: project }),
          });
        }
      }
    }
    
    console.log('✅ Invitation accepted:', invitationId);
    return { success: true, projectId: invitation.projectId };
  },
  
  /**
   * Reject project invitation
   */
  rejectInvitation: async (invitationId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    // Get the invitation
    const invitationsResponse = await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!invitationsResponse.ok) {
      throw new Error('Failed to fetch invitations');
    }
    
    const invitationsData = await invitationsResponse.json();
    const allInvitations = invitationsData.value || [];
    const invitationIndex = allInvitations.findIndex((inv: any) => inv.id === invitationId);
    
    if (invitationIndex === -1) {
      throw new Error('Invitation not found');
    }
    
    // Update invitation status
    allInvitations[invitationIndex].status = 'rejected';
    allInvitations[invitationIndex].rejectedAt = new Date().toISOString();
    
    await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ value: allInvitations }),
    });
    
    console.log('✅ Invitation rejected:', invitationId);
    return { success: true };
  },
  
  /**
   * Revoke sent invitation (by project owner)
   */
  revokeInvitation: async (projectId: string, invitationId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');
    
    // Update in pending invitations
    const invitationsResponse = await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (invitationsResponse.ok) {
      const invitationsData = await invitationsResponse.json();
      const allInvitations = invitationsData.value || [];
      const invitationIndex = allInvitations.findIndex((inv: any) => inv.id === invitationId);
      
      if (invitationIndex !== -1) {
        allInvitations[invitationIndex].status = 'revoked';
        allInvitations[invitationIndex].revokedAt = new Date().toISOString();
        
        await fetch(`${API_BASE_URL}/api/kv/pending_invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ value: allInvitations }),
        });
      }
    }
    
    // Update in project
    const projects = await projectsAPI.getAll();
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    
    if (projectIndex !== -1) {
      const project = projects[projectIndex];
      const invitations = project.invitations || [];
      const invIndex = invitations.findIndex((inv: any) => inv.id === invitationId);
      
      if (invIndex !== -1) {
        invitations[invIndex].status = 'revoked';
        invitations[invIndex].revokedAt = new Date().toISOString();
        await projectsAPI.update(projectId, { invitations });
      }
    }
    
    console.log('✅ Invitation revoked:', invitationId);
    return { success: true };
  },
  
  /**
   * Remove member from project
   */
  removeMember: async (projectId: string, memberId: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');
    
    // Get project
    const projects = await projectsAPI.getAll();
    const project = projects.find((p: any) => p.id === projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Check if user is owner
    if (project.userId !== userId) {
      throw new Error('Only project owner can remove members');
    }
    
    // Remove from project members
    const members = project.members || [];
    const updatedMembers = members.filter((m: any) => m.id !== memberId && m.userId !== memberId);
    
    await projectsAPI.update(projectId, { members: updatedMembers });
    
    // Remove from member's shared projects
    const memberSharedResponse = await fetch(`${API_BASE_URL}/api/kv/shared_projects:${memberId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (memberSharedResponse.ok) {
      const data = await memberSharedResponse.json();
      const sharedProjects = data.value || [];
      const updatedShared = sharedProjects.filter((ref: any) => ref.projectId !== projectId);
      
      await fetch(`${API_BASE_URL}/api/kv/shared_projects:${memberId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ value: updatedShared }),
      });
    }
    
    console.log('✅ Member removed from project:', memberId);
    return { success: true };
  },
  
  /**
   * Update member role in project
   */
  updateMemberRole: async (projectId: string, memberId: string, newRole: 'admin' | 'collaborator' | 'member' | 'viewer') => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');
    
    // Get project
    const projects = await projectsAPI.getAll();
    const project = projects.find((p: any) => p.id === projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Check if user is owner
    if (project.userId !== userId) {
      throw new Error('Only project owner can update member roles');
    }
    
    // Update member role
    const members = project.members || [];
    const memberIndex = members.findIndex((m: any) => m.id === memberId || m.userId === memberId);
    
    if (memberIndex !== -1) {
      members[memberIndex].role = newRole;
      await projectsAPI.update(projectId, { members });
    }
    
    // Update in member's shared projects
    const memberSharedResponse = await fetch(`${API_BASE_URL}/api/kv/shared_projects:${memberId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (memberSharedResponse.ok) {
      const data = await memberSharedResponse.json();
      const sharedProjects = data.value || [];
      const refIndex = sharedProjects.findIndex((ref: any) => ref.projectId === projectId);
      
      if (refIndex !== -1) {
        sharedProjects[refIndex].role = newRole;
        
        await fetch(`${API_BASE_URL}/api/kv/shared_projects:${memberId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ value: sharedProjects }),
        });
      }
    }
    
    console.log('✅ Member role updated:', memberId, newRole);
    return { success: true };
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
   * Accept an invitation (delegates to projectsAPI)
   */
  acceptInvitation: async (invitationId: string) => {
    return projectsAPI.acceptInvitation(invitationId);
  },
  
  /**
   * Reject an invitation (delegates to projectsAPI)
   */
  rejectInvitation: async (invitationId: string) => {
    return projectsAPI.rejectInvitation(invitationId);
  },
};

// ========== TEAM MEMBERS API ==========

export const teamAPI = {
  getMembers: async () => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const response = await fetch(`${API_BASE_URL}/api/kv/members:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    const response = await fetch(`${API_BASE_URL}/api/kv/custom_columns:${userId}`, {
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
    
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('Invalid token');

    await fetch(`${API_BASE_URL}/api/kv/custom_columns:${userId}`, {
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
