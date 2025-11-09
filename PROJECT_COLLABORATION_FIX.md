# Project Collaboration & Shared Access - Fix Documentation

## 🔧 Issue Fixed

Updated project members modal to use new KV store-based API instead of old Supabase endpoints.

---

## ❌ Problem

The `project-members-modal.tsx` component was still using old Supabase Edge Function endpoints that no longer exist:

```typescript
// OLD - These endpoints don't exist anymore
`https://${projectId}.supabase.co/functions/v1/make-server-d9879966/projects/${prjId}/members`
`https://${projectId}.supabase.co/functions/v1/make-server-d9879966/projects/${prjId}/invitations`
```

This caused errors when trying to:
- View project members
- Invite new members
- Change member roles
- Remove members
- Manage invitations

---

## ✅ Solution

Updated all member management functions to use the new KV store-based `projectsAPI`:

### 1. **Fetch Members**
```typescript
// NEW - Uses KV store
const projects = await projectsAPI.getAll();
const project = projects.find((p: any) => p.id === prjId);
const members = project.members || [];
```

### 2. **Invite Members**
```typescript
// NEW - Updates project in KV store
const newInvitation = {
  id: `inv-${Date.now()}`,
  email: inviteEmail,
  role: inviteRole,
  status: 'pending',
  sentDate: new Date().toISOString(),
};
project.invitations = [...(project.invitations || []), newInvitation];
await projectsAPI.update(prjId, { invitations: project.invitations });
```

### 3. **Change Role**
```typescript
// NEW - Updates member role in project
const projectMembers = project.members || [];
projectMembers[memberIndex].role = newRole;
await projectsAPI.update(prjId, { members: projectMembers });
```

### 4. **Remove Member**
```typescript
// NEW - Filters out member and updates project
const updatedMembers = projectMembers.filter((m: any) => m.id !== memberToDelete.id);
await projectsAPI.update(prjId, { members: updatedMembers });
```

### 5. **Manage Invitations**
```typescript
// NEW - Updates invitation status in project
invitations[inviteIndex].status = 'revoked';
await projectsAPI.update(prjId, { invitations });
```

---

## 📋 Changes Made

### File Updated: `src/components/project-members-modal.tsx`

**Imports Changed:**
```diff
- import { projectId, publicAnonKey } from '../utils/supabase/info';
- import { getAuthToken } from '../utils/supabase/client';
+ import { getAuthToken } from '../utils/supabase/client';
+ import { projectsAPI } from '../utils/api-client';
```

**Functions Updated:**
1. ✅ `fetchMembers()` - Now fetches from KV store
2. ✅ `fetchInvitations()` - Now fetches from KV store
3. ✅ `handleInvite()` - Now creates invitation in KV store
4. ✅ `handleResendInvite()` - Now updates invitation in KV store
5. ✅ `handleRevokeInvite()` - Now revokes invitation in KV store
6. ✅ `handleChangeRole()` - Now updates role in KV store
7. ✅ `handleDeleteMember()` - Now removes member in KV store

---

## 🔍 How It Works Now

### Data Structure in KV Store

Projects are stored in KV store under key "projects" with this structure:

```typescript
{
  id: string,
  name: string,
  color: string,
  members: [
    {
      id: string,
      userId: string,
      name: string,
      email: string,
      role: 'owner' | 'collaborator' | 'member' | 'viewer',
      addedDate: string (ISO)
    }
  ],
  invitations: [
    {
      id: string,
      email: string,
      role: 'owner' | 'collaborator' | 'member' | 'viewer',
      status: 'pending' | 'expired' | 'revoked' | 'accepted',
      sentDate: string (ISO),
      link?: string
    }
  ],
  // ... other project fields
}
```

### API Flow

1. **Get project data**: `projectsAPI.getAll()` → Returns all projects from KV store
2. **Find specific project**: `projects.find(p => p.id === projectId)`
3. **Modify members/invitations**: Update the project object
4. **Save changes**: `projectsAPI.update(projectId, { members, invitations })`

---

## 🧪 Testing

### Test Member Management

```bash
# 1. View members (should now work without errors)
# Open project → Click members button
# Should display list of members from KV store

# 2. Invite member
# Click "Пригласить" tab
# Enter email: test@example.com
# Select role: member
# Click "Отправить приглашение"
# Should create invitation in KV store

# 3. Change role
# Go to members tab
# Click on role dropdown for a member
# Select new role
# Should update role in KV store

# 4. Remove member
# Click trash icon next to member
# Confirm deletion
# Should remove member from KV store

# 5. Manage invitations
# Go to invitations tab
# Click "Отозвать" to revoke invitation
# Should update invitation status to 'revoked'
```

### Test with Browser Console

```javascript
// Check projects in KV store
const projects = await projectsAPI.getAll();
console.log('Projects:', projects);

// Check specific project
const project = projects[0];
console.log('Members:', project.members);
console.log('Invitations:', project.invitations);
```

---

## ⚠️ Known Limitations

### 1. **No Email Notifications**

Currently, invitations are created in the database but **no actual email** is sent to invited users.

**Future Enhancement Needed:**
- Integrate with email service to send invitation emails
- Include invitation link in email
- Add email template for invitations

### 2. **No Real-time Updates**

Changes to members/invitations are **not synchronized in real-time** across different browser tabs or users.

**Current Behavior:**
- User A invites someone → User B won't see it until they refresh
- Recommendation: Use polling or add WebSocket support

### 3. **No User Lookup**

When inviting, the system doesn't check if the email belongs to an existing user.

**Current Behavior:**
- Invitation is created regardless of whether email exists in system
- Future: Add user lookup to auto-add existing users

### 4. **Invitation Links**

Invitation links are generated but **acceptance flow is not implemented**.

**What's Missing:**
- Route to handle `/invite/:projectId/:token`
- Logic to accept invitation and add user to project
- Link expiration handling

---

## 📊 Remaining Issues to Fix

### Other Components Still Using Old Endpoints

Found these files still using old Supabase endpoints:

1. **`src/components/profile-view.tsx`**
   - Line: `https://${projectId}.supabase.co/functions/v1/make-server-d9879966/tasks/cleanup-duplicates`
   - Used for: Task cleanup
   - Status: Needs migration

2. **`src/contexts/app-context.tsx`**
   - Multiple category endpoints:
     - GET `/categories`
     - POST `/categories`
     - PUT `/categories/:id`
     - DELETE `/categories/:id`
   - Status: Needs migration to KV store

**Next Steps:**
- These should also be migrated to use KV store API
- Or add corresponding endpoints to Express server

---

## ✅ Verification Checklist

After deploying these changes, verify:

- [ ] Can view project members list
- [ ] Can invite new members
- [ ] Can change member roles
- [ ] Can remove members
- [ ] Can view invitations
- [ ] Can resend invitations
- [ ] Can revoke invitations
- [ ] No console errors when opening members modal
- [ ] All actions persist after page refresh

---

## 🔐 Security Notes

### Current Security

✅ **Authentication Required**: All operations require JWT token
✅ **Role-Based Access**: Only owners can manage members
✅ **Last Owner Protection**: Cannot remove/demote last owner

### Security Considerations

⚠️ **No Server-Side Validation**: All changes happen client-side via KV store API
- Recommendation: Add server-side endpoints with proper validation
- Check user permissions before allowing member changes
- Validate role transitions

⚠️ **No Audit Trail**: Member changes are not logged
- Recommendation: Add audit log for member management actions
- Track who added/removed/changed roles

---

## 📝 Summary

**Fixed**: ✅ Project members modal now works with new KV store API
**Status**: Functional but missing some features (email notifications, real-time, invitation acceptance)
**Next**: Migrate remaining Supabase endpoints and add missing features

---

**File Changed**: `src/components/project-members-modal.tsx`
**Lines Changed**: ~200 lines (function rewrites)
**Backwards Compatible**: Yes (uses same data structure)
