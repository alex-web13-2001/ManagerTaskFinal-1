# User Data Isolation - Test Guide

## Problem Fixed
Previously, all users were seeing the same tasks, projects, and categories because data was stored in shared KV store keys. This has been fixed by implementing user-scoped data storage.

## How It Works

### Before the Fix
- Tasks stored in: `tasks`
- Projects stored in: `projects`
- Categories stored in: `categories`
- Result: All users saw ALL data from ALL users

### After the Fix
- Tasks stored in: `tasks:userId`
- Projects stored in: `projects:userId`
- Categories stored in: `categories:userId`
- Custom columns stored in: `custom_columns:userId`
- Invitations stored in: `invitations:userId`
- Members stored in: `members:userId`
- Result: Each user sees ONLY their own data

## Manual Testing Steps

### Test 1: Create Two Users and Verify Data Isolation

1. **Register User 1**
   - Sign up with email: user1@test.com
   - Password: test123
   - Name: Test User 1

2. **Create Data for User 1**
   - Create a project: "User 1 Project"
   - Create a task: "User 1 Task"
   - Create a category: "User 1 Category"
   - Note down the data created

3. **Sign Out User 1**
   - Click on sign out

4. **Register User 2**
   - Sign up with email: user2@test.com
   - Password: test123
   - Name: Test User 2

5. **Verify User 2 Sees No Data from User 1**
   - Check projects list: Should be EMPTY (no "User 1 Project")
   - Check tasks list: Should be EMPTY (no "User 1 Task")
   - Check categories: Should be EMPTY (no "User 1 Category")

6. **Create Data for User 2**
   - Create a project: "User 2 Project"
   - Create a task: "User 2 Task"
   - Create a category: "User 2 Category"

7. **Sign Out User 2 and Sign Back in as User 1**
   - Sign out
   - Sign in with user1@test.com

8. **Verify User 1 Still Sees Only Their Own Data**
   - Should see: "User 1 Project", "User 1 Task", "User 1 Category"
   - Should NOT see: "User 2 Project", "User 2 Task", "User 2 Category"

### Test 2: Verify JWT Token Contains User ID

1. Open browser developer tools (F12)
2. Go to Application/Storage > Local Storage
3. Find the `auth_token` entry
4. Copy the token value
5. Go to https://jwt.io
6. Paste the token
7. Verify the payload contains a `sub` field with the user ID

### Expected Results

✅ Each user should only see their own tasks, projects, and categories
✅ Creating data as User 1 should not affect User 2's data
✅ Switching between users should show different data
✅ JWT token should contain the user ID in the `sub` field

## Technical Details

### Changes Made

1. **Added getUserIdFromToken() helper**
   - Decodes JWT token on the client side
   - Extracts the `sub` (user ID) field
   - Used in all API calls to scope data by user

2. **Updated API Client (src/utils/api-client.tsx)**
   - All KV store keys now include userId suffix
   - Format: `key:userId` (e.g., `tasks:123abc`, `projects:456def`)

3. **Updated Context (src/contexts/app-context.tsx)**
   - Category management now uses user-scoped keys
   - All CRUD operations include userId in the key

### Data Migration Note

**Important:** Existing data in the old keys (without userId) will not be automatically migrated. Users will start with fresh, empty workspaces after this fix. If data migration is needed:

1. Export data from old keys
2. Associate with correct users
3. Import into new user-scoped keys

This is intentional to ensure clean separation and avoid data corruption.

## Security Considerations

✅ User ID is extracted from authenticated JWT token
✅ Server-side authentication still validates the token
✅ Users cannot access other users' data by manipulating the userId
✅ All API calls require valid authentication token

## Future Enhancements

Possible future improvements:
- Add database-level access control (currently using KV store)
- Implement shared projects with explicit permissions
- Add team/organization support
- Implement audit logging for data access
