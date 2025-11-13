# Deep Links Implementation - Testing Guide

## Overview
This document describes how to test the deep links feature for tasks and projects.

## Features Implemented

### 1. Deep Link Routes
- `/tasks/:taskId` - Opens a specific task
- `/projects/:projectId` - Opens a specific project
- `/projects/:projectId/tasks/:taskId` - Opens a task within a project context

### 2. Backend API Endpoints

#### GET /api/tasks/:taskId
**Purpose**: Fetch a single task by ID with access control

**Access Control**:
- User is the task creator
- User is the task assignee
- Task belongs to a project where user is a member
- Task is personal (no project) AND user is the creator

**Response Codes**:
- 200: Success with task data
- 403: Access denied
- 404: Task not found
- 500: Server error

**Test Manually**:
```bash
# Get auth token first
TOKEN="your-jwt-token"

# Test accessing your own task
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/tasks/TASK_ID

# Test accessing someone else's task (should get 403)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/tasks/OTHER_USER_TASK_ID
```

#### GET /api/projects/:id
**Purpose**: Fetch a single project by ID (already existed, uses canAccessProject middleware)

**Access Control**: Handled by `canAccessProject` middleware
- User is the project owner
- User is a project member

### 3. Frontend Features

#### URL-to-State Synchronization
The `MainApp` component synchronizes URL parameters with application state:
- Reads `taskId` and `projectId` from URL params
- Updates `selectedTaskId` and `selectedProjectId` states
- Sets appropriate view (projects view for project links, dashboard for task-only links)

#### Navigation Handlers
All navigation now uses React Router's `navigate()`:
- `handleTaskClick(taskId)` - Navigates to task URL
- `handleProjectClick(projectId)` - Navigates to project URL
- `handleTaskClose()` - Navigates back to appropriate view
- `handleBackToProjects()` - Navigates to home

#### Share Button
Component: `src/components/share-button.tsx`

**Features**:
- Uses Web Share API on supported devices (mobile)
- Falls back to clipboard copy
- Shows "Copied!" feedback
- Toast notification on success/error

**Locations**:
- TaskModal header (view mode only)
- ProjectDetailView header

### 4. Redirect After Login
When an unauthenticated user accesses a deep link:
1. Current path is saved to `sessionStorage` as `redirectAfterLogin`
2. User is redirected to `/login`
3. After successful login, user is redirected to original URL
4. The task modal or project view opens automatically

## Manual Testing Scenarios

### Test Case 1: Share and Access Task Link
1. Open the app and navigate to a task
2. In view mode, click the "Share" button
3. Copy the link (e.g., `http://localhost:5173/tasks/abc-123`)
4. Open link in incognito/private window
5. **Expected**: Redirected to login, after login task opens in modal

### Test Case 2: Share and Access Project Link
1. Navigate to a project
2. Click the "Share" button in project header
3. Copy the link (e.g., `http://localhost:5173/projects/proj-456`)
4. Open link in new tab
5. **Expected**: Project view opens directly

### Test Case 3: Task Within Project Context
1. Open a task from within a project
2. Share button should generate: `/projects/proj-456/tasks/task-123`
3. Opening this link should:
   - Open the project view
   - Automatically open the task modal
   - Back button from task modal returns to project (not dashboard)

### Test Case 4: Browser Navigation
1. Open a task via deep link
2. Click browser back button
3. **Expected**: Modal closes, returns to previous view
4. Click browser forward button
5. **Expected**: Task modal reopens

### Test Case 5: Access Control
1. Get a deep link to a task you don't have access to
2. Try to access it
3. **Expected**: 403 error handled gracefully
   - Task doesn't appear in context
   - Modal doesn't open or shows error

### Test Case 6: Non-Existent Resources
1. Access `/tasks/non-existent-id`
2. **Expected**: 404 error handled gracefully
3. Access `/projects/non-existent-id`
4. **Expected**: Project not found, appropriate error message

## Code Review Checklist

- [x] React Router properly integrated with BrowserRouter
- [x] Routes defined for all deep link patterns
- [x] URL params extracted with useParams hook
- [x] Navigation uses navigate() instead of state changes
- [x] Backend endpoint created for GET /api/tasks/:taskId
- [x] Access control implemented on backend
- [x] ShareButton component created and integrated
- [x] Redirect-after-login implemented
- [x] Global TaskModal in MainApp (not in individual views)
- [x] Views accept and use onTaskClick callback
- [x] Build succeeds without errors
- [x] TypeScript compiles successfully
- [x] Server starts without compilation errors

## Known Limitations

1. **Task Loading**: Tasks are still loaded from context (app-context). If a task is not in the context, it won't open. This is by design to keep the implementation minimal. A full implementation would fetch the task directly via the API endpoint.

2. **Error Handling**: Error states for 403/404 from the backend are not fully implemented in the UI. Tasks that can't be accessed simply won't appear in the context.

3. **Deep State**: The implementation preserves basic routing but doesn't capture all navigation state (e.g., which view was active, filters applied).

## Future Enhancements

1. Add API call in TaskModal to fetch task directly if not in context
2. Implement error UI for 403/404 scenarios
3. Add loading states for deep link access
4. Persist more application state in URL (filters, view mode, etc.)
5. Add tests for routing logic
6. Add analytics tracking for shared links

## Conclusion

The deep links feature is fully functional for the core use case of sharing and accessing tasks and projects via URLs. The implementation follows React Router best practices and maintains backward compatibility with the existing state-based navigation.
