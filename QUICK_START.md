# Quick Start: Access Control System

## What Has Been Implemented

This PR adds a comprehensive role-based access control system with:

- ✅ **Database Schema**: Projects, Tasks, Members, and Invitations models
- ✅ **Permission System**: Complete role-based permissions (Owner, Collaborator, Member, Viewer)
- ✅ **Invitation System**: 72-hour token-based invitations with email notifications
- ✅ **API Endpoints**: RESTful invitation management endpoints
- ✅ **Data Migration**: Utility to migrate from KV store to Prisma

## Quick Setup

### 1. Apply Database Migrations

```bash
# Generate Prisma client (if not done)
npm run prisma:generate

# Apply migrations
npm run prisma:migrate
```

This will create the new database tables:
- `projects` - Project information
- `project_members` - User roles in projects
- `invitations` - Project invitations
- `tasks` - Task information

### 2. Migrate Existing Data (Optional)

If you have existing data in the KV store, migrate it:

```bash
# Migrate all users
npx tsx src/lib/migrate.ts all

# Or migrate specific user
npx tsx src/lib/migrate.ts user <userId>
```

### 3. Start the Server

```bash
# Start backend
npm run dev:server

# Start frontend (in another terminal)
npm run dev
```

## Testing the System

### Test Invitation Flow

1. **Create a project** (you'll be the Owner)
2. **Invite a user**: POST to `/api/projects/:projectId/invitations`
   ```json
   {
     "email": "user@example.com",
     "role": "collaborator"  // or "member" or "viewer"
   }
   ```
3. **Accept invitation**: Visit `/invite/{token}` or POST to `/api/invitations/{token}/accept`

### Test Permissions

**As Owner**:
- ✅ Can do everything
- ✅ Can invite users
- ✅ Can manage members

**As Collaborator**:
- ✅ Can edit project details
- ✅ Can create/edit/delete all tasks
- ❌ Cannot invite users or manage members

**As Member**:
- ✅ Can see project
- ✅ Can create tasks for themselves
- ✅ Can edit only their own tasks
- ❌ Cannot see other members' tasks
- ❌ Cannot delete tasks

**As Viewer**:
- ✅ Can see project and all tasks
- ❌ Cannot create or edit anything

## API Endpoints

### Invitations

```
POST   /api/projects/:projectId/invitations       # Create invitation (Owner only)
GET    /api/projects/:projectId/invitations       # List invitations (Owner only)
GET    /api/invitations/my-invitations            # Get your pending invitations
GET    /api/invitations/token/:token              # Get invitation details (public)
POST   /api/invitations/:token/accept             # Accept invitation
DELETE /api/invitations/:invitationId             # Revoke invitation (Owner only)
POST   /api/invitations/:invitationId/resend      # Resend invitation (Owner only)
```

### Members (To Be Implemented)

```
GET    /api/projects/:projectId/members           # List members (filtered by role)
PUT    /api/projects/:projectId/members/:id/role  # Change member role (Owner only)
DELETE /api/projects/:projectId/members/:id       # Remove member (Owner only)
```

## What Still Needs Implementation

### Backend
- [ ] Project CRUD endpoints using Prisma (currently uses KV store)
- [ ] Task CRUD endpoints using Prisma (currently uses KV store)
- [ ] Member management endpoints
- [ ] Apply permission checks to existing endpoints

### Frontend
- [ ] Update project components to use new endpoints
- [ ] Update task components to filter by role
- [ ] Update member management UI
- [ ] Add role indicators
- [ ] Hide/show buttons based on permissions

## Role Permissions Reference

| Action | Owner | Collaborator | Member | Viewer |
|--------|-------|--------------|--------|--------|
| View project | ✅ | ✅ | ✅ | ✅ |
| View all tasks | ✅ | ✅ | ❌ (own only) | ✅ |
| Create tasks | ✅ | ✅ | ✅ (self only) | ❌ |
| Edit tasks | ✅ (all) | ✅ (all) | ✅ (own) | ❌ |
| Delete tasks | ✅ | ✅ | ❌ | ❌ |
| Edit project | ✅ | ✅ | ❌ | ❌ |
| Invite users | ✅ | ❌ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ | ❌ |
| Archive project | ✅ | ❌ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |

## Files Changed

### New Files
- `src/lib/permissions.ts` - Permission checking functions
- `src/lib/invitations.ts` - Invitation management
- `src/lib/migrate.ts` - Data migration utility
- `src/server/routes/invitations.ts` - Invitation API routes
- `src/server/types.ts` - TypeScript types
- `ACCESS_CONTROL_IMPLEMENTATION.md` - Full implementation guide
- `QUICK_START.md` - This file

### Modified Files
- `prisma/schema.prisma` - Added Project, Task, Member, Invitation models
- `src/server/index.ts` - Integrated invitation routes

### Generated Files (not in git)
- `prisma/migrations/20251110160732_add_access_control_models/` - Database migration

## Troubleshooting

### Database Connection Error
Make sure Docker is running and database is accessible:
```bash
docker compose up -d
```

### Migration Errors
Reset database and reapply migrations:
```bash
npx prisma migrate reset
npm run prisma:migrate
```

### Server Won't Start
Check if port 3001 is available:
```bash
lsof -i :3001
# Kill any process using the port
kill -9 <PID>
```

## Next Steps for Developers

To complete the implementation:

1. **Implement Prisma-based endpoints** for projects and tasks
2. **Add member management** endpoints
3. **Update frontend** components to use new system
4. **Test thoroughly** with all roles
5. **Run data migration** for production data

See `ACCESS_CONTROL_IMPLEMENTATION.md` for detailed implementation checklist.

## Support

For questions or issues:
1. Check `ACCESS_CONTROL_IMPLEMENTATION.md` for detailed documentation
2. Review the code in `src/lib/permissions.ts` for permission logic
3. Test with different roles to understand behavior
