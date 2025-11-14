# Quick Testing Guide for UI Fixes

This guide provides a quick way to test all the UI improvements made in this PR.

## Prerequisites
- Two browser windows or incognito tabs for testing realtime features
- Test project with external links
- Test tasks with categories

## Quick Test Scenarios

### 1. Project Modal - External Links (Issue 1)
**Test Steps:**
1. Open any project in edit mode
2. Add a new external link with:
   - Name: "Documentation"
   - URL: "https://github.com/very-long-repository-name/very-long-project-name/blob/main/documentation/getting-started.md#section-about-something-important"
3. Click "Add Link"

**Expected Result:**
- ✅ URL is truncated with ellipsis (`...`)
- ✅ Full URL appears in tooltip when hovering
- ✅ URL is blue and clickable
- ✅ Delete button (X) is always visible
- ✅ Only ONE "Manage Members" button exists (in the header of Members section)

**Screenshot locations:**
- Project modal with long URL truncated
- Hover tooltip showing full URL

---

### 2. Header - Connection Status (Issue 2)
**Test Steps:**
1. Load the application
2. Observe the header bar

**Expected Result:**
- ✅ WiFi icon only (no "Connected" text)
- ✅ Icon is GREEN when connected
- ✅ "Т24 Бот" button is on the LEFT side (after logo, before "New Task")
- ✅ "Т24 Бот" button has a visible border

**To test disconnection:**
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Observe WiFi icon turns RED
4. Set back to "Online"
5. Icon turns GREEN again

**Screenshot locations:**
- Header with green WiFi icon
- Header with "Т24 Бот" button on the left

---

### 3. Task Modal - View Mode (Issue 3)
**Test Steps:**
1. Create a task with a category assigned
2. Click on the task to view it (not edit)

**Expected Result:**
- ✅ NO close button (X) in top-right corner
- ✅ Category badge is visible next to project name
- ✅ "Close" button exists at the bottom

**Test Edit Mode:**
1. Click "Edit" on the task
2. Modal switches to edit mode

**Expected Result:**
- ✅ Close button (X) IS present in top-right corner
- ✅ Category badge still visible

**Screenshot locations:**
- View mode without X button
- Category badge next to project name

---

### 4. Welcome Modal (Issue 4)
**Test Steps:**
1. Open URL with `?welcome=true` parameter
   - Example: `http://localhost:3000/?welcome=true`
2. Welcome modal appears

**Expected Result:**
- ✅ Modal has reasonable width (max 600px, not stretched)
- ✅ "Подключить сейчас" button text is clearly readable (white on blue)
- ✅ Modal is centered on screen
- ✅ All text is easy to read

**Screenshot locations:**
- Welcome modal on desktop (showing proper width)
- Close-up of "Подключить сейчас" button

---

### 5. Calendar - Non-overlapping Tasks (Issue 5)
**Test Steps:**
1. Create multiple tasks with overlapping dates:
   - Task A: Jan 1 - Jan 5
   - Task B: Jan 3 - Jan 7
   - Task C: Jan 2 - Jan 6
   - Task D: Jan 8 - Jan 10
2. Navigate to Calendar view (Dashboard → Calendar)

**Expected Result:**
- ✅ Tasks A, B, C are in separate rows (tracks)
- ✅ Task D can be in same row as Task A (no overlap)
- ✅ No visual overlapping of task cards
- ✅ All tasks are readable
- ✅ Clicking on tasks opens task detail modal

**Screenshot locations:**
- Calendar view showing multiple tasks in separate rows
- Zoomed view showing no overlap

---

### 6. Realtime Member Updates (Issue 6)
**Test Steps:**
1. Open TWO browser windows (Window A and Window B)
2. Log in as User A in Window A
3. Log in as User B in Window B
4. In Window A:
   - Create a new project "Test Project"
   - Invite User B to the project
5. In Window B:
   - Check notifications (bell icon)
   - Accept the invitation
6. In Window A (WITHOUT REFRESHING):
   - Click "New Task"
   - Open the "Assignee" dropdown

**Expected Result:**
- ✅ User B appears in the assignee dropdown immediately
- ✅ NO page refresh needed
- ✅ Project modal shows User B in members list

**Alternative Test (if WebSocket not available):**
1. User B accepts invitation
2. Check if polling updates the member list within 30 seconds

**Screenshot locations:**
- Window B showing accepted invitation
- Window A showing User B in assignee dropdown (without refresh)

---

## Screenshot Checklist

Create screenshots for:
- [ ] Project modal with long URL properly truncated
- [ ] Header with color-coded WiFi icon (green)
- [ ] Header showing "Т24 Бот" button on the left with border
- [ ] Task modal in view mode (no X button)
- [ ] Task modal showing category badge
- [ ] Welcome modal with proper width on desktop
- [ ] Calendar with multiple non-overlapping tasks
- [ ] Assignee dropdown showing newly added member (realtime)

## Known Limitations

1. **WebSocket Connection**: Realtime updates require WebSocket to be working. If WebSocket is not connected, polling will handle updates with a delay.

2. **Browser Support**: Tested on modern browsers (Chrome, Firefox, Safari, Edge). May have minor styling differences on older browsers.

3. **Mobile View**: Changes are optimized for desktop but remain responsive on mobile.

## Troubleshooting

### Realtime updates not working?
- Check if WebSocket icon is green (connected)
- Open browser console and look for WebSocket connection logs
- Check server logs to ensure WebSocket server is running
- Try refreshing the page and accepting invitation again

### Long URLs still overflowing?
- Check if the URL is longer than the modal width
- Verify browser zoom is at 100%
- Clear browser cache and reload

### Button/icon colors not showing?
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check if browser extensions are interfering

## Performance Notes

All changes are lightweight and should not impact performance:
- CSS-only changes for truncation
- Minimal JavaScript for event handlers
- No new dependencies added
- Build size remains approximately the same

## Accessibility

All changes maintain accessibility:
- ✅ WiFi icon has `title` attribute for screen readers
- ✅ Links have `rel="noopener noreferrer"` for security
- ✅ Modal close button has `sr-only` label
- ✅ All interactive elements are keyboard accessible

---

## Quick Test Script

For developers who want to quickly verify all changes:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the development server
npm run dev

# In another terminal, run the backend server
npm run dev:server
```

Then follow the test scenarios above in your browser at `http://localhost:5173` (or the port shown in terminal).

---

## Reporting Issues

If you find any issues during testing:

1. Document the steps to reproduce
2. Take a screenshot
3. Note your browser and version
4. Check browser console for errors
5. Create a detailed issue report

All UI improvements have been implemented according to the technical specification and are ready for testing!
