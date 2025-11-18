# Comment System Bugs - Testing Guide

This guide describes how to test the fixes for the two critical comment system bugs.

## Overview of Fixes

### Bug 1: Comments Disappear After Page Reload
**Symptom:** Comments added to tasks disappear from the UI after pressing F5, even though they're stored in the database.

**Fix:** Implemented on-demand task loading in TaskModal that fetches full task details (including comments) from the server when opening a task.

### Bug 2: Real-time Comment Updates Not Working
**Symptom:** When two users have the same project task open, comments added by one user don't appear in real-time for the other user.

**Fix:** Implemented automatic project room joining when WebSocket connects, ensuring all project members receive real-time comment updates.

---

## Testing Bug 1: Comments Persistence After Reload

### Prerequisites
- A user account with at least one task (personal or project)
- Browser with dev tools open (to view console logs)

### Test Steps

#### Test 1.1: Personal Task Comments Persist After Reload

1. **Create or Open a Personal Task:**
   - Log in to the application
   - Navigate to the personal tasks section (Kanban board)
   - Create a new task or click on an existing task to open the TaskModal

2. **Add a Comment:**
   - In the TaskModal, scroll to the comments section
   - Enter a comment (e.g., "Test comment 1")
   - Click "Отправить" (Send)
   - **Verify:** The comment appears immediately in the comments list

3. **Close and Reopen Modal:**
   - Close the TaskModal
   - Reopen the same task
   - **Verify:** The comment is still visible

4. **Perform Full Page Reload:**
   - Press F5 or Ctrl+R to reload the page
   - Wait for the page to fully load
   - Reopen the same task
   - **Expected Result:** ✅ The comment is visible
   - **Check Console:** Look for log message: `✅ Task {taskId} reloaded with comments: 1`

#### Test 1.2: Project Task Comments Persist After Reload

1. **Create or Open a Project Task:**
   - Navigate to a project's Kanban board
   - Create a new task or click on an existing task

2. **Add Multiple Comments:**
   - Add 2-3 comments to the task
   - **Verify:** All comments appear in the list

3. **Close and Reopen Modal:**
   - Close the TaskModal
   - Reopen the same task
   - **Verify:** All comments are still visible

4. **Perform Full Page Reload:**
   - Press F5 to reload the page
   - Navigate back to the project
   - Reopen the same task
   - **Expected Result:** ✅ All comments are visible
   - **Check Console:** Log should show: `🔄 Loading task {taskId} with comments`

#### Test 1.3: Comments with User Information

1. **Verify Comment User Data:**
   - Open a task with comments
   - For each comment, verify:
     - User name is displayed correctly
     - User avatar (if set) is displayed
     - Timestamp shows "X minutes/hours ago"
   - **Expected Result:** ✅ All user information is present and correct

---

## Testing Bug 2: Real-time Comment Updates

### Prerequisites
- Two browser sessions (two different browsers, or one normal + one incognito)
- Two user accounts that are members of the same project
- A project task that both users can access

### Test Steps

#### Test 2.1: Real-time Comments Between Project Members

1. **Setup Two Sessions:**
   - **Browser A:** Log in as User A
   - **Browser B:** Log in as User B (must be a member of the same project)
   - Navigate both to the same project

2. **Open WebSocket Connection:**
   - In both browsers, open the developer console
   - **Verify in Console:** Look for these messages:
     - `✅ WebSocket: Connected {socketId}`
     - `📥 Auto-joined project room: project:{projectId}`
   - This confirms both users have joined the project room

3. **Open Same Task:**
   - In both browsers, open the same project task (TaskModal should be open)

4. **Add Comment from Browser A:**
   - In Browser A (User A), add a comment: "Real-time test comment"
   - Click "Отправить"
   - **Verify in Browser A Console:**
     - Server response logged
     - Comment added to local state

5. **Check Browser B:**
   - **Expected Result in Browser B:** ✅ The comment appears immediately without refresh
   - **Verify in Browser B Console:** Look for:
     - `📥 WebSocket: comment:added`
     - Event data showing the new comment
   - **Verify in UI:** The new comment is visible in the comments section

#### Test 2.2: Multiple Comments from Different Users

1. **Continue from Test 2.1 with both modals open**

2. **Add Comment from Browser B:**
   - In Browser B (User B), add a reply: "Reply from User B"
   - **Expected in Browser A:** ✅ Reply appears in real-time

3. **Rapid Comments:**
   - Alternately add 3-4 comments from each browser
   - **Expected Result:** ✅ All comments appear in both browsers in the correct order
   - **No Duplicates:** Each comment appears exactly once

#### Test 2.3: Personal Tasks Don't Broadcast

1. **Test with Personal Task:**
   - In Browser A, open a personal task (no projectId)
   - Add a comment
   - **Expected in Browser B:** ❌ No comment appears (correct behavior)
   - **Reason:** Personal tasks don't broadcast to other users

2. **Verify Console:**
   - In Browser A server logs: Should NOT see `Broadcasted comment:added to project:X`
   - Personal task comments are saved but not broadcast

---

## Edge Cases and Additional Tests

### Test 3.1: User Joins Project After Connection

1. **Add User to Project:**
   - Have User A add User B to a project while User B is already logged in
   - **Expected:** User B's WebSocket should join the new project room
   - **How to Verify:** Check console for `📥 Auto-joined project room`

2. **Test Real-time Updates:**
   - Open a task from the new project in both browsers
   - Add a comment from Browser A
   - **Expected:** ✅ Appears in Browser B

### Test 3.2: WebSocket Reconnection

1. **Simulate Disconnect:**
   - In Browser A, open Network tab
   - Throttle network or go offline momentarily
   - **Check Console:** `🔌 WebSocket: Disconnected`

2. **Reconnect:**
   - Restore network
   - **Expected:** 
     - `✅ WebSocket: Connected`
     - Auto-joins all project rooms again
     - Real-time updates work again

### Test 3.3: Multiple Projects

1. **User in Multiple Projects:**
   - User A is a member of Projects 1, 2, and 3
   - **Check Console on Login:**
     - Should see 3 "Auto-joined project room" messages
   
2. **Test Isolation:**
   - Open a task in Project 1
   - In another browser (User B, only in Project 1), add a comment
   - **Expected:** Real-time update works
   - User C (only in Project 2) should not see this update

---

## Troubleshooting

### Comments Don't Persist After Reload

**Check:**
1. Console for errors during `loadTask` call
2. Network tab - verify `GET /api/tasks/{taskId}` returns comments
3. Browser local storage/session for authentication token
4. Server logs for task fetch errors

**Common Causes:**
- Task not found (deleted?)
- User lost access to task/project
- Server not returning comments in response

### Real-time Updates Not Working

**Check:**
1. WebSocket connection status in console
2. "Auto-joined project room" messages
3. Server logs for `Broadcasted comment:added` messages
4. Both users are actually in the same project

**Common Causes:**
- WebSocket not connected (check network)
- Users not in the same project
- Server not emitting events to project room
- Client not listening for `comment:added` event

---

## Expected Console Output

### On Page Load (Successful Connection):
```
🔌 WebSocket: Connecting to ws://localhost:3001
✅ WebSocket: Connected abc123
📥 Auto-joined project room: project:proj-1
📥 Auto-joined project room: project:proj-2
```

### On Opening Task Modal:
```
🔄 Loading task task-123 with comments
✅ Task task-123 reloaded with comments: 3
```

### On Receiving Real-time Comment:
```
📥 WebSocket: comment:added {taskId: "task-123", comment: {...}, timestamp: "..."}
```

---

## Verification Checklist

### Bug 1 Fixed:
- [ ] Comments appear after adding them
- [ ] Comments persist after closing/reopening modal
- [ ] Comments persist after F5 page reload
- [ ] Comments show correct user information
- [ ] Works for both personal and project tasks

### Bug 2 Fixed:
- [ ] WebSocket connects successfully
- [ ] Users auto-join project rooms
- [ ] Real-time comments appear for project tasks
- [ ] Multiple users see each other's comments instantly
- [ ] Personal tasks don't broadcast to others
- [ ] Comments appear in correct order
- [ ] No duplicate comments

---

## Success Criteria

Both bugs are considered fixed when:

1. **Bug 1:** After adding comments and performing a full page reload (F5), all comments remain visible when opening the task modal.

2. **Bug 2:** When two users have the same project task open, a comment added by one user appears immediately in the other user's UI without manual refresh.

If any test fails, check the console logs and server logs for error messages and refer to the troubleshooting section above.
