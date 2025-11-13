/**
 * Role-Based Access Control (RBAC) system
 * Defines permissions for each user role in projects
 */

export type UserRole = 'owner' | 'collaborator' | 'member' | 'viewer';

export type Permission = 
  | 'project:view'
  | 'project:edit'
  | 'project:delete'
  | 'project:archive'
  | 'project:manage-members'
  | 'project:invite-users'
  | 'task:view'
  | 'task:create'
  | 'task:edit'
  | 'task:delete'
  | 'task:assign'
  | 'members:view-all';

/**
 * Permissions mapping for each role
 * Owner has all permissions
 * Collaborator has most permissions except critical project management
 * Member has limited permissions including task:assign
 * Viewer can only view
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'project:view',
    'project:edit',
    'project:delete',
    'project:archive',
    'project:manage-members',
    'project:invite-users',
    'task:view',
    'task:create',
    'task:edit',
    'task:delete',
    'task:assign',
    'members:view-all',
  ],
  collaborator: [
    'project:view',
    'project:edit',
    'task:view',
    'task:create',
    'task:edit',
    'task:delete',
    'task:assign',
    'members:view-all',
  ],
  member: [
    'project:view',
    'task:view',
    'task:create',
    'task:edit',
    'task:assign', // FIX Problem #2: Members can now assign tasks to others
  ],
  viewer: [
    'project:view',
    'task:view',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasRolePermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
