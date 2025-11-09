# Testing Checklist - Supabase to Prisma Migration

This checklist covers all the features that need to be manually tested after the migration from Supabase to self-hosted Postgres with Prisma.

---

## 🔧 Pre-Testing Setup

- [ ] Copy `.env.example` to `.env`
- [ ] Start Postgres: `npm run docker:up`
- [ ] Generate Prisma Client: `npm run prisma:generate`
- [ ] Run migrations: `npm run prisma:migrate`
- [ ] Seed database: `npm run prisma:seed`
- [ ] Start backend: `npm run dev:server`
- [ ] Start frontend: `npm run dev`

---

## ✅ Testing Categories

### 1. Authentication & Authorization

#### Sign Up
- [ ] Navigate to registration page
- [ ] Create account with:
  - Name: Test User
  - Email: test@example.com
  - Password: test123456
- [ ] Verify success message appears
- [ ] Verify auto-redirect to dashboard
- [ ] Check localStorage for `auth_token`
- [ ] Verify token is a JWT (contains 3 parts separated by dots)

#### Sign In
- [ ] Sign out
- [ ] Sign in with test@example.com / test123456
- [ ] Verify success message
- [ ] Verify redirect to dashboard
- [ ] Check localStorage for `auth_token`

#### Sign In with Admin
- [ ] Sign out
- [ ] Sign in with admin@example.com / admin123
- [ ] Verify successful login

#### Invalid Credentials
- [ ] Try to sign in with wrong password
- [ ] Verify error message appears
- [ ] Try to sign in with non-existent email
- [ ] Verify error message appears

#### Session Persistence
- [ ] Sign in successfully
- [ ] Refresh the page
- [ ] Verify you remain logged in
- [ ] Check that user data loads correctly

#### Sign Out
- [ ] Click sign out button
- [ ] Verify redirect to login page
- [ ] Verify `auth_token` removed from localStorage
- [ ] Try to access dashboard - should redirect to login

---

### 2. User Profile & Avatar

#### View Profile
- [ ] Navigate to profile page
- [ ] Verify user name displays correctly
- [ ] Verify email displays correctly

#### Upload Avatar
- [ ] Click "Upload Avatar" button
- [ ] Select an image file (JPG, PNG)
- [ ] Verify upload progress/success message
- [ ] Verify avatar displays on profile page
- [ ] Check uploads/ directory contains the file
- [ ] Verify avatar URL starts with `/uploads/`

#### Update Profile
- [ ] Try to update user name
- [ ] Verify changes are saved
- [ ] Refresh page and verify changes persist

---

### 3. Projects Management

#### Create Project
- [ ] Click "New Project" button
- [ ] Fill in project details:
  - Name: Test Project
  - Description: This is a test project
  - Color: Choose any color
- [ ] Click "Create"
- [ ] Verify project appears in projects list
- [ ] Verify redirect to project page

#### View Projects
- [ ] Navigate to projects list
- [ ] Verify all projects display
- [ ] Click on a project
- [ ] Verify project details page opens

#### Update Project
- [ ] Open a project
- [ ] Click edit button
- [ ] Update project name and description
- [ ] Save changes
- [ ] Verify changes persist after refresh

#### Archive Project
- [ ] Open a project
- [ ] Click "Archive" button
- [ ] Verify project moves to archived section
- [ ] Navigate to archived projects
- [ ] Verify project appears there

#### Restore Project
- [ ] In archived projects
- [ ] Click "Restore" on a project
- [ ] Verify project returns to active projects

#### Delete Project
- [ ] Archive a project
- [ ] In archived projects, click "Delete"
- [ ] Confirm deletion
- [ ] Verify project is completely removed

---

### 4. Tasks Management

#### Create Task
- [ ] Open a project
- [ ] Click "Add Task" or "New Task"
- [ ] Fill in task details:
  - Title: Test Task
  - Description: This is a test task
  - Priority: High
  - Status: To Do
  - Due Date: Pick a date
- [ ] Click "Create"
- [ ] Verify task appears in tasks list

#### View Tasks
- [ ] Navigate to dashboard
- [ ] Verify all tasks display
- [ ] Switch between Kanban and Table views
- [ ] Verify both views show tasks correctly

#### Update Task
- [ ] Click on a task to open details
- [ ] Update title, description, priority, status
- [ ] Save changes
- [ ] Verify changes persist

#### Drag and Drop (Kanban)
- [ ] Switch to Kanban view
- [ ] Drag a task to a different column
- [ ] Verify task status updates
- [ ] Refresh page
- [ ] Verify task remains in new column

#### Delete Task
- [ ] Open a task
- [ ] Click "Delete" button
- [ ] Confirm deletion
- [ ] Verify task is removed from all views

---

### 5. Task Attachments

#### Upload Attachment
- [ ] Open a task
- [ ] Click "Add Attachment" or "Upload File"
- [ ] Select a file (PDF, image, document)
- [ ] Verify upload success message
- [ ] Verify attachment appears in task
- [ ] Verify file is in uploads/ directory
- [ ] Check attachment has correct:
  - Filename
  - File size
  - Upload date

#### View Attachment
- [ ] Click on attachment name/link
- [ ] Verify file opens or downloads
- [ ] Verify correct file is served

#### Multiple Attachments
- [ ] Upload 2-3 different files to same task
- [ ] Verify all attachments display
- [ ] Verify each can be viewed independently

#### Delete Attachment
- [ ] Click delete on an attachment
- [ ] Confirm deletion
- [ ] Verify attachment removed from task
- [ ] Note: File may still exist in uploads/ (cleanup not yet implemented)

---

### 6. Key-Value Store

#### Save Data
- [ ] Create tasks and projects
- [ ] Verify data persists in database
- [ ] Check KV store using Prisma Studio:
  ```bash
  npx prisma studio
  ```
- [ ] Verify keys like `tasks`, `projects`, `custom_columns` exist

#### Load Data
- [ ] Refresh the page
- [ ] Verify all tasks load
- [ ] Verify all projects load
- [ ] Verify custom columns load (if any)

#### Custom Columns
- [ ] Navigate to table view settings
- [ ] Create a custom column
- [ ] Save custom column settings
- [ ] Refresh page
- [ ] Verify custom column persists

---

### 7. Error Handling

#### Network Errors
- [ ] Stop the backend server
- [ ] Try to create a task
- [ ] Verify appropriate error message
- [ ] Start backend server
- [ ] Retry - verify it works

#### Unauthorized Access
- [ ] Clear localStorage (auth_token)
- [ ] Try to access dashboard
- [ ] Verify redirect to login
- [ ] Try API call in browser console:
  ```javascript
  fetch('http://localhost:3001/api/kv/tasks')
  ```
- [ ] Verify 401 Unauthorized response

#### Invalid Data
- [ ] Try to create task with empty title
- [ ] Verify validation error
- [ ] Try to upload invalid file type
- [ ] Verify appropriate error

---

### 8. API Endpoints

Test these in browser console or using curl:

#### Health Check
```bash
curl http://localhost:3001/health
```
- [ ] Verify returns `{"status":"ok"}`

#### Auth Endpoints
```bash
# Sign up
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"curl@test.com","password":"test123","name":"Curl Test"}'

# Sign in
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"curl@test.com","password":"test123"}'
```
- [ ] Verify returns token
- [ ] Save token for next tests

#### KV Store Endpoints
```bash
# Set value (replace TOKEN)
curl -X POST http://localhost:3001/api/kv/test_key \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"value":"test value"}'

# Get value
curl http://localhost:3001/api/kv/test_key \
  -H "Authorization: Bearer TOKEN"
```
- [ ] Verify set returns success
- [ ] Verify get returns correct value

---

### 9. Database Integrity

#### Using Prisma Studio
```bash
npx prisma studio
```

- [ ] Open Prisma Studio at http://localhost:5555
- [ ] Check `users` table
  - Verify admin user exists
  - Verify test users exist
  - Verify passwords are hashed (not plain text)
- [ ] Check `kv_store` table
  - Verify keys exist (tasks, projects, etc.)
  - Verify values are JSON

#### Using psql
```bash
docker exec -it taskmanager-postgres psql -U postgres -d taskmanager
```

```sql
-- Check tables exist
\dt

-- Check user count
SELECT COUNT(*) FROM users;

-- Check KV store
SELECT key, created_at, updated_at FROM kv_store;

-- Exit
\q
```

---

### 10. File System

#### Uploads Directory
```bash
ls -la uploads/
```

- [ ] Verify uploads/ directory exists
- [ ] Verify uploaded files are present
- [ ] Verify filenames are unique (timestamp-based)
- [ ] Check file permissions are correct

#### Static File Serving
- [ ] Upload an avatar
- [ ] Copy the avatar URL from profile
- [ ] Paste URL directly in browser
- [ ] Verify image displays correctly
- [ ] Try an attachment URL
- [ ] Verify file downloads/displays

---

### 11. Migration Compatibility

#### Deprecation Warnings
- [ ] Open browser console
- [ ] Look for deprecation warnings about supabase client
- [ ] Verify warnings appear only once per import
- [ ] Note which components still use old imports

#### API Client
- [ ] Verify all API calls go to http://localhost:3001
- [ ] Check Network tab in DevTools
- [ ] Verify no calls to Supabase domains
- [ ] Verify JWT token in Authorization headers

---

### 12. Performance

#### Load Time
- [ ] Clear browser cache
- [ ] Reload page
- [ ] Verify page loads in < 3 seconds
- [ ] Check Network tab for slow requests

#### Large Data
- [ ] Create 20+ tasks
- [ ] Switch between views
- [ ] Verify UI remains responsive
- [ ] Check for console errors

---

### 13. Security

#### JWT Tokens
- [ ] Decode JWT token using jwt.io
- [ ] Verify contains correct user ID (`sub` claim)
- [ ] Verify contains email
- [ ] Verify has expiration (`exp` claim)
- [ ] Check expiration is ~7 days from creation

#### Password Hashing
- [ ] Check database using Prisma Studio
- [ ] Verify passwords are hashed (long random strings)
- [ ] Verify passwords are NOT plain text

#### Authorization
- [ ] Create a task while logged in
- [ ] Copy the API request from Network tab
- [ ] Remove Authorization header
- [ ] Retry request
- [ ] Verify returns 401 Unauthorized

---

### 14. Edge Cases

#### Empty States
- [ ] Sign up as new user (no data)
- [ ] Verify empty state messages display
- [ ] Verify "Create Project" prompts appear

#### Concurrent Updates
- [ ] Open same task in two browser tabs
- [ ] Update task in tab 1
- [ ] Update task in tab 2
- [ ] Verify last update wins

#### File Upload Limits
- [ ] Try to upload very large file (>50MB)
- [ ] Verify error message
- [ ] Verify upload is rejected

---

## 📊 Test Results

Track your results here:

- **Total Tests**: ___
- **Passed**: ___
- **Failed**: ___
- **Blocked**: ___

### Issues Found

List any issues discovered during testing:

1. 
2. 
3. 

### Notes

Additional observations:



---

## ✅ Sign Off

- [ ] All critical tests passed
- [ ] All blocking issues resolved
- [ ] Documentation reviewed and accurate
- [ ] Ready for production deployment

**Tested By**: _______________
**Date**: _______________
**Environment**: Development / Staging / Production
