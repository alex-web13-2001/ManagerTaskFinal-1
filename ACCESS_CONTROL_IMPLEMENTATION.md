# Access Control System Implementation Guide

## Overview
This document describes the implementation of the comprehensive role-based access control system as specified in the requirements.

## Current Status

### ✅ Completed Components

#### 1. Database Schema (Phase 1)
- **File**: `prisma/schema.prisma`
- **Created Models**:
  - `Project`: Stores project information with owner relation
  - `ProjectMember`: Stores user roles in projects (owner, collaborator, member, viewer)
  - `Invitation`: Stores project invitations with token, expiry (72 hours), and status
  - `Task`: Stores tasks with proper relations to users and projects
- **Migration**: `20251110160732_add_access_control_models`

#### 2. Permission System (Phase 2)
- **File**: `src/lib/permissions.ts`
- **Functions Implemented**:
  - `getUserRoleInProject()`: Get user's role in a project
  - `canViewProject()`: Check if user can view project
  - `canEditProject()`: Check if user can edit project (Owner, Collaborator only)
  - `canDeleteProject()`: Check if user can delete project (Owner only)
  - `canArchiveProject()`: Check if user can archive project (Owner only)
  - `canManageMembers()`: Check if user can manage members (Owner only)
  - `canInviteUsers()`: Check if user can send invitations (Owner only)
  - `canViewTask()`: Check if user can view task (Member sees only their own)
  - `canCreateTask()`: Check if user can create task (Member only for themselves)
  - `canEditTask()`: Check if user can edit task (role-based)
  - `canDeleteTask()`: Check if user can delete task (Owner, Collaborator only)
  - `canChangeTaskAssignee()`: Check if user can change assignee (role-based)
  - `canViewMembers()`: Check if user can view members list
  - `shouldSeeOnlySelf()`: Check if user should see only themselves (Member role)
  - `filterTasksByRole()`: Filter tasks based on user role
  - `isLastOwner()`: Prevent removing last owner

#### 3. Invitation System (Phase 3)
- **File**: `src/lib/invitations.ts`
- **Functions Implemented**:
  - `generateInvitationToken()`: Generate secure random token
  - `getExpirationDate()`: Calculate 72-hour expiration
  - `isInvitationExpired()`: Check if invitation expired
  - `createInvitation()`: Create new invitation (Owner only)
  - `getInvitationByToken()`: Get invitation by token
  - `getInvitationById()`: Get invitation by ID
  - `getProjectInvitations()`: Get all invitations for project
  - `getUserPendingInvitations()`: Get user's pending invitations
  - `acceptInvitation()`: Accept an invitation
  - `revokeInvitation()`: Revoke an invitation
  - `resendInvitation()`: Resend invitation with new token

- **File**: `src/server/routes/invitations.ts`
- **API Endpoints**:
  - `POST /api/projects/:projectId/invitations`: Create invitation
  - `GET /api/projects/:projectId/invitations`: List project invitations
  - `GET /api/invitations/my-invitations`: Get user's pending invitations
  - `GET /api/invitations/token/:token`: Get invitation details
  - `POST /api/invitations/:token/accept`: Accept invitation
  - `DELETE /api/invitations/:invitationId`: Revoke invitation
  - `POST /api/invitations/:invitationId/resend`: Resend invitation

#### 4. Data Migration Utility
- **File**: `src/lib/migrate.ts`
- **Purpose**: Migrate existing data from KV store to Prisma models
- **Functions**:
  - `migrateUserProjects()`: Migrate user's projects
  - `migrateUserTasks()`: Migrate user's tasks
  - `migrateUserData()`: Migrate all user data
  - `migrateAllData()`: Migrate all users' data

### 🔄 Integration Required

#### 1. Server Integration
The invitation routes need to be integrated into the main server (`src/server/index.ts`):

```typescript
import invitationRoutes from './routes/invitations';

// Add to server after authentication middleware
app.use('/api/invitations', authenticate, invitationRoutes);
app.use('/api/projects', authenticate, invitationRoutes);
```

#### 2. Project Endpoints Migration
Current project endpoints use KV store. They need to be updated to use Prisma models:
- Create project: Use `prisma.project.create()`
- Get projects: Use `prisma.project.findMany()` with member relations
- Update project: Use `prisma.project.update()` with permission checks
- Delete project: Use `prisma.project.delete()` with permission checks
- Archive project: Update with permission checks

#### 3. Task Endpoints Migration
Current task endpoints use KV store. They need to be updated to use Prisma models:
- Create task: Check `canCreateTask()`, use `prisma.task.create()`
- Get tasks: Filter by role using `filterTasksByRole()`
- Update task: Check `canEditTask()`, use `prisma.task.update()`
- Delete task: Check `canDeleteTask()`, use `prisma.task.delete()`
- Change assignee: Check `canChangeTaskAssignee()`

#### 4. Member Management Endpoints
New endpoints needed:
- `GET /api/projects/:projectId/members`: List project members (filtered by role)
- `PUT /api/projects/:projectId/members/:memberId/role`: Change member role (Owner only)
- `DELETE /api/projects/:projectId/members/:memberId`: Remove member (Owner only)

#### 5. Frontend Updates
Components that need updates:
- `project-members-modal.tsx`: Use new permission checks, filter members for Member role
- `invitations-modal.tsx`: Use new invitation endpoints
- `task-table.tsx`: Filter tasks by role for Member users
- `project-kanban-board.tsx`: Filter tasks and check permissions
- `personal-kanban-board.tsx`: Continue to work as before
- Add UI indicators for user role
- Hide/disable buttons based on permissions

### 📋 Implementation Checklist

#### Backend (High Priority)
- [ ] Integrate invitation routes into main server
- [ ] Run data migration for existing users
- [ ] Create project management endpoints with Prisma
- [ ] Create task management endpoints with Prisma
- [ ] Create member management endpoints
- [ ] Update file attachment handling for Prisma tasks
- [ ] Add permission checks to all endpoints
- [ ] Test all permission scenarios

#### Backend (Medium Priority)
- [ ] Add audit logging for permission-sensitive operations
- [ ] Add rate limiting for invitation endpoints
- [ ] Implement invitation email templates
- [ ] Add webhook support for permission changes

#### Frontend (High Priority)
- [ ] Update project components to use new endpoints
- [ ] Update task components to filter by role
- [ ] Update invitation acceptance flow
- [ ] Add role indicators in UI
- [ ] Hide/show buttons based on permissions
- [ ] Update member management modal

#### Frontend (Medium Priority)
- [ ] Add permission error handling and user feedback
- [ ] Add role-based UI tours/tooltips
- [ ] Implement optimistic updates with rollback

#### Testing
- [ ] Test Owner permissions (full access)
- [ ] Test Collaborator permissions (no member management)
- [ ] Test Member permissions (own tasks only)
- [ ] Test Viewer permissions (read-only)
- [ ] Test invitation flow (create, accept, revoke, resend)
- [ ] Test edge cases (last owner, duplicate invitations, etc.)
- [ ] Test member visibility (Member sees only self)

## Role Permissions Summary

| Feature | Owner | Collaborator | Member | Viewer |
|---------|-------|--------------|--------|--------|
| View project | ✅ | ✅ | ✅ | ✅ |
| View all tasks | ✅ | ✅ | ❌ (own only) | ✅ |
| Create tasks | ✅ | ✅ | ✅ (self only) | ❌ |
| Edit tasks | ✅ (all) | ✅ (all) | ✅ (own) | ❌ |
| Delete tasks | ✅ | ✅ | ❌ | ❌ |
| Edit project | ✅ | ✅ | ❌ | ❌ |
| Invite users | ✅ | ❌ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ | ❌ |
| View members | ✅ | ✅ | ✅ (self only) | ✅ |
| Archive project | ✅ | ❌ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |

## Next Steps

1. **Immediate**: Integrate invitation routes into server
2. **Immediate**: Run data migration script
3. **Short-term**: Create Prisma-based project/task endpoints
4. **Short-term**: Update frontend components
5. **Medium-term**: Complete testing and refinement

## Notes

- The system supports gradual migration from KV store to Prisma
- Both systems can coexist during transition period
- Email service is optional (gracefully degrades if not configured)
- All permission checks happen server-side for security
- Frontend permissions are for UI/UX only, not security
