# WebSocket Real-Time Synchronization - Testing Guide

## Quick Test Guide

This guide helps you verify that WebSocket real-time synchronization is working correctly.

## Prerequisites

1. Server running: `npm run dev:server`
2. Client running: `npm run dev` or built and deployed
3. Two browsers or tabs (or incognito mode) for testing

## Test Scenarios

### Test 1: Connection Status
**Goal**: Verify WebSocket connects and shows status

**Steps**:
1. Open the application in browser
2. Log in with a user account
3. Look at the header (top right)
4. Verify you see a "Connected" status with green Wifi icon

**Expected Result**:
- Green Wifi icon with "Connected" text visible
- Server logs show: `✅ WebSocket authenticated: [username]`
- Server logs show: `🔗 Client connected: [username]`

**Troubleshooting**:
- If shows "Offline": Check server is running
- Check browser console for connection errors
- Verify JWT token is present in localStorage

---

### Test 2: Real-Time Task Creation
**Goal**: Verify tasks appear instantly for all users

**Steps**:
1. Open app in Browser A (User A)
2. Open app in Browser B (User B) - different user
3. Both users navigate to same project
4. User A creates a new task
5. Observe Browser B (User B)

**Expected Result**:
- Task appears in Browser B without page refresh
- Toast notification shows: "New task: [task title]"
- Task appears in correct column
- Server logs show: `📤 Emitted task:created to room project:[id]`

**Troubleshooting**:
- Verify both users are in the same project
- Check server logs for WebSocket events
- Verify connection status shows "Connected"

---

### Test 3: Real-Time Task Update
**Goal**: Verify task edits sync instantly

**Steps**:
1. Both users viewing same project with existing tasks
2. User A clicks on a task and edits its title
3. User A saves the task
4. Observe Browser B (User B)

**Expected Result**:
- Task title updates in Browser B automatically
- No toast notification (silent update)
- Update happens within 1-2 seconds
- Server logs show: `📤 Emitted task:updated to room project:[id]`

---

### Test 4: Real-Time Task Deletion
**Goal**: Verify task deletions sync instantly

**Steps**:
1. Both users viewing same project with existing tasks
2. User A deletes a task
3. Observe Browser B (User B)

**Expected Result**:
- Task disappears from Browser B immediately
- Toast notification shows: "Task deleted"
- Server logs show: `📤 Emitted task:deleted to room project:[id]`

---

### Test 5: Real-Time Drag-and-Drop (Most Important!)
**Goal**: Verify the main issue is fixed - new tasks can be dragged immediately

**Steps**:
1. User A viewing project in kanban view
2. User A creates a new task in "To Do" column
3. **Without refreshing the page**, User A tries to drag the newly created task to "In Progress"
4. Simultaneously, User B should see the task appear and then move

**Expected Result**:
- ✅ User A can drag the newly created task immediately (no need to refresh!)
- ✅ Task moves to new column for User A
- ✅ User B sees task appear in original column
- ✅ User B sees task move to new column within 1-2 seconds
- Server logs show: `📤 Emitted task:created` followed by `📤 Emitted task:updated`

**This is the critical test - it solves the original problem!**

---

### Test 6: Real-Time Invitations
**Goal**: Verify invitations notify users instantly

**Steps**:
1. User A opens a project
2. User B is logged in on another browser/tab
3. User A invites User B's email to the project
4. Observe Browser B (User B)

**Expected Result**:
- Toast notification appears in Browser B: "New invitation: [Project Name]"
- Bell icon shows notification badge
- Server logs show: `📤 Emitted invite:received to room user:[userId]`

**Note**: This only works if User B is already logged in with that email.

---

### Test 7: Real-Time Member Updates
**Goal**: Verify project member list updates instantly

**Steps**:
1. User A viewing project members modal
2. User B viewing same project or project list
3. User A accepts invitation or Owner adds a member
4. Observe Browser B

**Expected Result**:
- Member list updates in Browser B automatically
- Toast shows: "New member joined: [name]"
- Server logs show: `📤 Emitted project:member_added`

---

### Test 8: Connection Resilience
**Goal**: Verify reconnection works after disconnect

**Steps**:
1. User viewing project (connected)
2. Stop the server: Ctrl+C in terminal
3. Observe connection status in header
4. Restart server: `npm run dev:server`
5. Wait 5-10 seconds

**Expected Result**:
- Connection status changes to "Offline" (red icon)
- After server restart, status changes back to "Connected" (green icon)
- Browser console shows reconnection attempts
- Server logs show new connection after restart

---

### Test 9: Multi-Project Isolation
**Goal**: Verify events only go to users in the same project

**Steps**:
1. User A viewing Project 1
2. User B viewing Project 2 (different project)
3. User A creates task in Project 1
4. Observe Browser B (User B in Project 2)

**Expected Result**:
- User B does NOT see the task from Project 1
- User B does NOT get notification about Project 1 task
- Events are properly isolated to project rooms

---

### Test 10: Performance with Many Tasks
**Goal**: Verify performance doesn't degrade with many real-time updates

**Steps**:
1. User A and User B viewing same project
2. User A creates 10 tasks quickly (one after another)
3. User A moves several tasks between columns via drag-and-drop
4. Observe both browsers

**Expected Result**:
- All tasks appear in User B's view
- All movements sync correctly
- No lag or UI freezing
- No duplicate tasks
- Server handles load without errors

---

## Debugging Tips

### Check Server Logs
Look for these messages:
```
🔌 Initializing WebSocket server...
✅ WebSocket server initialized
✅ WebSocket authenticated: [username]
🔗 Client connected: [username]
📥 User [username] joined project room: project:[projectId]
📤 Emitted task:created to room project:[projectId]
```

### Check Browser Console
Look for these messages:
```
🔌 WebSocket: Connecting to http://localhost:3001
✅ WebSocket: Connected [socketId]
📥 Joined project room: [projectId]
📥 WebSocket: task:created [data]
```

### Common Issues

**Issue**: "Offline" status despite server running
- **Fix**: Check if JWT token is expired or invalid
- **Fix**: Verify VITE_API_URL matches server URL
- **Fix**: Check for CORS errors in browser console

**Issue**: Events not syncing between users
- **Fix**: Verify both users are in the same project room
- **Fix**: Check server logs to see if events are being emitted
- **Fix**: Verify WebSocket connection is established (check "Connected" status)

**Issue**: Tasks appear but can't be dragged
- **Fix**: This should not happen anymore - if it does, check console for errors
- **Fix**: Verify task has `id` field populated
- **Fix**: Check if drag-and-drop library (react-dnd) is loaded

**Issue**: Duplicate tasks appearing
- **Fix**: This is handled in code - check for deduplication logic
- **Fix**: Verify task IDs are unique
- **Fix**: Check if fetchTasks is being called multiple times

## Success Criteria

✅ All 10 tests pass
✅ No console errors
✅ Server logs show WebSocket activity
✅ Connection indicator shows "Connected"
✅ Tasks sync within 1-2 seconds
✅ **Main issue fixed**: New tasks can be dragged immediately!

## Performance Benchmarks

Expected metrics:
- Connection time: < 500ms
- Event latency: < 100ms (local), < 500ms (remote)
- Memory usage: Stable over time (no leaks)
- Reconnection time: < 5 seconds after disconnect

## Next Steps

After all tests pass:
1. Test with real production data
2. Monitor server logs for errors
3. Check for any memory leaks with long sessions
4. Gather user feedback on real-time updates
5. Consider adding more user presence features

## Rollback Procedure

If critical issues are found:
1. Stop the server
2. Git revert to previous commit
3. Rebuild and redeploy
4. Application will work with old polling mechanism
5. No data loss as database schema unchanged
