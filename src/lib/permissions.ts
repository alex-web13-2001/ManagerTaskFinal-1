/**
 * Permission system for role-based access control
 * Implements requirements from the access control specification
 */

import prisma from './prisma';

export type UserRole = 'owner' | 'collaborator' | 'member' | 'viewer';

/**
 * Get user's role in a project
 * Returns null if user is not a member
 */
export async function getUserRoleInProject(
  userId: string,
  projectId: string
): Promise<UserRole | null> {
  try {
    // Check if user is project owner
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId,
      },
    });

    if (project) {
      return 'owner';
    }

    // Check if user is a member
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (membership && membership.role) {
      return membership.role as UserRole;
    }

    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if user can view project
 * All members can view projects
 */
export async function canViewProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role !== null;
}

/**
 * Check if user can edit project details (name, description, color, etc.)
 * Only Owner and Collaborator can edit
 */
export async function canEditProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role === 'owner' || role === 'collaborator';
}

/**
 * Check if user can delete project
 * Only Owner can delete
 */
export async function canDeleteProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role === 'owner';
}

/**
 * Check if user can archive/restore project
 * Only Owner can archive
 */
export async function canArchiveProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role === 'owner';
}

/**
 * Check if user can manage members (add, remove, change roles)
 * Only Owner can manage members
 */
export async function canManageMembers(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role === 'owner';
}

/**
 * Check if user can invite users to project
 * Only Owner can invite
 */
export async function canInviteUsers(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role === 'owner';
}

/**
 * Check if user can view a specific task
 * - All roles can view tasks in projects they're part of
 * - Member can only view their own tasks (assigned or created by them)
 */
export async function canViewTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return false;
    }

    // Personal tasks - only creator can view
    if (!task.projectId) {
      return task.creatorId === userId;
    }

    const role = await getUserRoleInProject(userId, task.projectId);

    if (!role) {
      return false;
    }

    // Member can only view their own tasks
    if (role === 'member') {
      return task.creatorId === userId || task.assigneeId === userId;
    }

    // All other roles can view all tasks
    return true;
  } catch (error) {
    console.error('Error checking task view permission:', error);
    return false;
  }
}

/**
 * Check if user can create a task in project
 * - Personal tasks: user can only create for themselves or without assignee
 * - Owner, Collaborator, Member can create tasks in projects
 * - Member can only create tasks assigned to themselves or without assignee
 */
export async function canCreateTask(
  userId: string,
  projectId: string | null,
  assigneeId?: string | null
): Promise<boolean> {
  // Personal tasks (no project) - user can only create for themselves or without assignee
  if (!projectId) {
    return !assigneeId || assigneeId === userId;
  }

  const role = await getUserRoleInProject(userId, projectId);

  if (!role) {
    return false;
  }

  // Viewer cannot create tasks
  if (role === 'viewer') {
    return false;
  }

  // Member can only create tasks assigned to themselves or without assignee
  if (role === 'member') {
    return assigneeId === userId || assigneeId === null;
  }

  // Owner and Collaborator can create any task
  return true;
}

/**
 * Check if user can edit a task
 * - Owner and Collaborator can edit any task
 * - Member can only edit their own tasks
 * - Viewer cannot edit
 */
export async function canEditTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return false;
    }

    // Personal tasks - only creator can edit
    if (!task.projectId) {
      return task.creatorId === userId;
    }

    const role = await getUserRoleInProject(userId, task.projectId);

    if (!role) {
      return false;
    }

    // Owner and Collaborator can edit any task
    if (role === 'owner' || role === 'collaborator') {
      return true;
    }

    // Member can only edit their own tasks
    if (role === 'member') {
      return task.creatorId === userId || task.assigneeId === userId;
    }

    // Viewer cannot edit
    return false;
  } catch (error) {
    console.error('Error checking task edit permission:', error);
    return false;
  }
}

/**
 * Check if user can delete a task
 * - Owner and Collaborator can delete any task
 * - Member and Viewer cannot delete tasks
 */
export async function canDeleteTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return false;
    }

    // Personal tasks - only creator can delete
    if (!task.projectId) {
      return task.creatorId === userId;
    }

    const role = await getUserRoleInProject(userId, task.projectId);

    // Only Owner and Collaborator can delete
    return role === 'owner' || role === 'collaborator';
  } catch (error) {
    console.error('Error checking task delete permission:', error);
    return false;
  }
}

/**
 * Check if user can change task assignee
 * - Owner and Collaborator can change to any member
 * - Member can only assign to themselves
 * - Viewer cannot change assignee
 */
export async function canChangeTaskAssignee(
  userId: string,
  taskId: string,
  newAssigneeId: string | null
): Promise<boolean> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return false;
    }

    // Personal tasks - only creator can change assignee
    if (!task.projectId) {
      return task.creatorId === userId;
    }

    const role = await getUserRoleInProject(userId, task.projectId);

    if (!role) {
      return false;
    }

    // Owner and Collaborator can change to anyone
    if (role === 'owner' || role === 'collaborator') {
      return true;
    }

    // Member can only assign to themselves
    if (role === 'member') {
      return newAssigneeId === userId || newAssigneeId === null;
    }

    // Viewer cannot change assignee
    return false;
  } catch (error) {
    console.error('Error checking assignee change permission:', error);
    return false;
  }
}

/**
 * Check if user can view members list
 * - All roles except Member can view full members list
 * - Member can only see themselves
 */
export async function canViewMembers(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRoleInProject(userId, projectId);
  return role !== null;
}

/**
 * Check if user should see only themselves in members list
 * - Member role only sees themselves
 */
export function shouldSeeOnlySelf(role: UserRole | null): boolean {
  return role === 'member';
}

/**
 * Filter tasks based on user role
 * - Member: only their own tasks (created or assigned)
 * - All others: all project tasks
 */
export async function filterTasksByRole(
  userId: string,
  projectId: string,
  tasks: any[]
): Promise<any[]> {
  const role = await getUserRoleInProject(userId, projectId);

  if (role === 'member') {
    return tasks.filter(
      (task) => task.creatorId === userId || task.assigneeId === userId
    );
  }

  return tasks;
}

/**
 * Check if removing a member would leave project without owners
 */
export async function isLastOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
      },
    });

    if (!project) {
      return false;
    }

    // Count owners (project owner + members with owner role)
    const ownerCount = project.members.filter(
      (m) => m.role === 'owner'
    ).length + 1; // +1 for project owner

    // If this user is an owner and there's only one owner, they're the last
    const userRole = await getUserRoleInProject(userId, projectId);
    return userRole === 'owner' && ownerCount === 1;
  } catch (error) {
    console.error('Error checking last owner:', error);
    return false;
  }
}
