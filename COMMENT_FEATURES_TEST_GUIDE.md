# Comment Features Testing Guide

## Overview
This guide helps verify that the comment persistence and real-time update fixes are working correctly.

## Prerequisites
1. Server running: `npm run dev:server`
2. Client running: `npm run dev`
3. Two browsers or browser windows for testing real-time updates
4. At least two user accounts created
5. At least one shared project with both users as members

## Test Scenarios

### Test 1: Comment Persistence - Personal Task
**Goal**: Verify comments on personal tasks are saved and persist after modal close/reload

**Steps**:
1. Log in as User A
2. Navigate to "My Tasks" or "Dashboard" 
3. Create a new personal task (not in any project)
4. Open the task modal
5. Add a comment: "This is my first comment"
6. Click "Комментарий добавлен" notification should appear
7. Close the task modal
8. Reopen the same task
9. Verify the comment is still visible
10. Refresh the page (F5)
11. Open the task again
12. Verify the comment is still visible

**Expected Result**:
- ✅ Comment appears immediately after adding
- ✅ Comment persists after closing and reopening modal
- ✅ Comment persists after full page reload
- ✅ Comment shows correct author name and avatar
- ✅ Comment shows relative time (e.g., "несколько секунд назад")

**Troubleshooting**:
- If comment disappears after close: Check browser console for errors
- Verify `/api/tasks/:taskId` endpoint returns comments array
- Check that `transformTaskForResponse` is preserving comments

---

### Test 2: Comment Persistence - Project Task
**Goal**: Verify comments on project tasks are saved and persist

**Steps**:
1. Log in as User A
2. Navigate to a shared project
3. Create a new task in the project or select existing task
4. Open the task modal
5. Add a comment: "Project task comment test"
6. Close the modal
7. Reopen the task
8. Verify comment is visible
9. Refresh the page
10. Open the task again
11. Verify comment still visible

**Expected Result**:
- ✅ Same as Test 1 - comments persist correctly

---

### Test 3: Real-Time Comment Updates - Project Task
**Goal**: Verify comments appear in real-time for other users in same project

**Setup**:
- Browser A: User A logged in, viewing Project X
- Browser B: User B logged in, viewing same Project X
- Both users should be members of Project X

**Steps**:
1. In Browser A: Open a task in Project X
2. In Browser B: Open the same task
3. In Browser A: Add comment "Real-time test from User A"
4. **Observe Browser B** (User B's window)
5. Verify comment appears automatically in Browser B
6. In Browser B: Add comment "Reply from User B"
7. **Observe Browser A**
8. Verify comment appears automatically in Browser A

**Expected Result**:
- ✅ Comment from User A appears in Browser B without reload (within 1-2 seconds)
- ✅ Comment from User B appears in Browser A without reload
- ✅ Author names and avatars are correct for each comment
- ✅ Comments appear in correct chronological order (newest first)
- ✅ WebSocket connection status shows "Connected" in both browsers

**Server Logs Should Show**:
```
📡 [WebSocket] Broadcasted comment:added to project:{projectId}
```

**Troubleshooting**:
- If no real-time update: Check WebSocket connection status (header shows "Connected")
- Verify both users joined the project room
- Check browser console for WebSocket messages
- Server logs should show `comment:added` event emission

---

### Test 4: No Cross-User Updates for Personal Tasks
**Goal**: Verify personal tasks do not broadcast comments to other users

**Setup**:
- Browser A: User A logged in
- Browser B: User B logged in

**Steps**:
1. In Browser A: Create a personal task (no project)
2. In Browser A: Open the task and add a comment
3. **Check Browser B**: User B should NOT see any notification or update
4. Verify server logs do NOT show WebSocket emission for personal tasks

**Expected Result**:
- ✅ Comment is saved and visible to User A
- ✅ No WebSocket `comment:added` event emitted
- ✅ User B sees no updates (as expected - personal tasks are private)
- ✅ Server logs show: `💬 Comment added to task {id} by user {userId}` but NO WebSocket broadcast

---

### Test 5: Multiple Comments Display
**Goal**: Verify multiple comments are displayed correctly

**Steps**:
1. Open any task (personal or project)
2. Add first comment: "Comment 1"
3. Add second comment: "Comment 2"
4. Add third comment: "Comment 3"
5. Verify "Показать все комментарии" button appears
6. Click button to expand all comments
7. Verify all 3 comments are visible
8. Click "Скрыть комментарии" button
9. Verify only the most recent comment is shown

**Expected Result**:
- ✅ Most recent comment shown by default when multiple exist
- ✅ "Показать все комментарии (3)" button shows correct count
- ✅ All comments visible when expanded
- ✅ Comments sorted by newest first
- ✅ Can collapse back to showing only latest

---

### Test 6: Comment User Information
**Goal**: Verify comment author information is displayed correctly

**Steps**:
1. Log in as User A (with name and avatar set)
2. Add a comment to any task
3. Verify your own comment shows "Вы" (You) instead of your name
4. Have User B (different user) add a comment to the same task
5. Verify User B's comment shows their actual name (not "Вы")
6. Verify User B's avatar is displayed correctly
7. If User B has no avatar, verify fallback shows initials

**Expected Result**:
- ✅ Current user's comments show "Вы"
- ✅ Other users' comments show their actual names
- ✅ Avatars displayed correctly when available
- ✅ Fallback initials shown when no avatar
- ✅ Relative timestamp shows (e.g., "2 минуты назад")

---

### Test 7: Edge Cases

**Test 7a: Empty Comment**
- Try to submit empty comment (just spaces)
- **Expected**: Button disabled, cannot submit

**Test 7b: Very Long Comment**
- Add a comment with 500+ characters
- **Expected**: Comment saves and displays correctly, wraps to multiple lines

**Test 7c: Comment with Line Breaks**
- Add comment with multiple paragraphs using Enter key
- **Expected**: Line breaks preserved, whitespace shown correctly

**Test 7d: Rapid Multiple Comments**
- Add 5 comments quickly in succession
- **Expected**: All comments saved, no duplicates, correct order

**Test 7e: Duplicate Prevention**
- Open same task in two tabs as same user
- Add comment in Tab 1
- **Expected**: Comment appears in both tabs, but only once (no duplicate)

---

## Verification Checklist

After completing all tests, verify:

- [ ] Comments persist on personal tasks after modal close
- [ ] Comments persist on personal tasks after page reload
- [ ] Comments persist on project tasks after modal close
- [ ] Comments persist on project tasks after page reload
- [ ] Real-time updates work for project tasks between multiple users
- [ ] Personal tasks do NOT broadcast to other users
- [ ] Multiple comments display correctly with expand/collapse
- [ ] Comment author names and avatars display correctly
- [ ] Current user's comments show "Вы" instead of name
- [ ] Empty comments cannot be submitted
- [ ] Long comments wrap correctly
- [ ] Line breaks in comments are preserved
- [ ] No duplicate comments when receiving real-time updates
- [ ] WebSocket connection shows "Connected" status
- [ ] Server logs show correct comment events

## Known Behavior

**Personal Tasks**: 
- Comments work fully (create, persist, display)
- NO real-time updates to other users (as designed)
- Only the task owner can see the task and comments

**Project Tasks**:
- Comments work fully (create, persist, display)
- Real-time updates broadcast to all project members
- All project members can see and add comments

## Troubleshooting Common Issues

**Issue**: Comments disappear after modal close
- **Check**: Browser console for errors
- **Check**: Network tab - does `/api/tasks/:taskId` return comments?
- **Check**: Comments field in response has `user` object

**Issue**: No real-time updates
- **Check**: WebSocket connection status (should show "Connected")
- **Check**: Both users are members of the same project
- **Check**: Server logs show `📡 [WebSocket] Broadcasted comment:added`
- **Check**: Browser console for `📥 WebSocket: comment:added` log

**Issue**: Comment shows "Unknown" as author
- **Check**: Comment has `user` field in response
- **Check**: User is in teamMembers list or is currentUser
- **Check**: transformTaskForResponse includes user info

**Issue**: Duplicate comments appear
- **Check**: Comment deduplication logic in websocket-context.tsx
- **Check**: Each comment has unique ID
