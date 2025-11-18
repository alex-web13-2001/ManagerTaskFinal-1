# WebSocket-First with Smart Polling - Testing Guide

## Test Environment Setup

1. Start the backend server:
```bash
cd /home/runner/work/ManagerTaskFinal-1/ManagerTaskFinal-1
npm run dev:server
```

2. In another terminal, start the frontend:
```bash
cd /home/runner/work/ManagerTaskFinal-1/ManagerTaskFinal-1
npm run dev
```

## Test Cases

### Test 1: WebSocket Active - No Polling
**Goal**: Verify that when WebSocket is connected, no HTTP polling requests occur.

**Steps**:
1. Open browser to http://localhost:5173
2. Login with valid credentials
3. Open DevTools -> Network tab
4. Filter by `/api/tasks` or `/api/projects`
5. Observe for 30 seconds

**Expected Result**:
- Console shows: `⚡ WebSocket активен. Поллинг отключен.`
- No periodic HTTP requests to `/api/tasks` or `/api/projects` (except initial load)
- `isRealtimeConnected` status indicator shows connected (if UI has one)

### Test 2: Task Creation with WebSocket
**Goal**: Verify instant task synchronization via WebSocket without polling.

**Steps**:
1. Open two browser tabs to the app with same user
2. In Tab 1, create a new task
3. Observe Tab 2

**Expected Result**:
- Tab 2 shows the new task immediately (within 1-2 seconds)
- Console in Tab 2 shows: `📥 WebSocket: task:created`
- No HTTP request to `/api/tasks` in Tab 2's Network tab

### Test 3: Attachment Upload with WebSocket
**Goal**: Verify attachment changes sync via WebSocket.

**Steps**:
1. Open two browser tabs
2. In Tab 1, open a task and upload an attachment
3. Observe Tab 2

**Expected Result**:
- Tab 2 shows the new attachment immediately
- Console shows: `📥 WebSocket: task:updated`
- Console shows: `📤 WebSocket: Emitted task:updated after attachment upload`

### Test 4: Custom Columns with WebSocket
**Goal**: Verify custom column changes sync across tabs.

**Steps**:
1. Open two browser tabs
2. In Tab 1, go to settings and modify custom columns
3. Save changes
4. Observe Tab 2

**Expected Result**:
- Tab 2 shows updated custom columns
- Console shows: `📥 WebSocket: user:settings_updated`
- Console shows: `🔄 Updating custom columns from WebSocket`
- Toast notification: "Настройки обновлены в другой вкладке"

### Test 5: Categories with WebSocket
**Goal**: Verify category changes sync across tabs.

**Steps**:
1. Open two browser tabs
2. In Tab 1, add/edit a category
3. Save changes
4. Observe Tab 2

**Expected Result**:
- Tab 2 shows updated categories
- Console shows: `📥 WebSocket: user:settings_updated`
- Console shows: `🔄 Updating categories from WebSocket`

### Test 6: Smart Polling Fallback (WebSocket Offline)
**Goal**: Verify Smart Polling activates when WebSocket disconnects.

**Steps**:
1. Open browser with DevTools
2. Login and verify WebSocket is connected
3. In DevTools -> Network tab, set throttling to "Offline"
4. Wait a few seconds for disconnect
5. Observe console and Network tab

**Expected Result**:
- Console shows: `🔌 WebSocket status changed: Disconnected`
- Console shows: `⚠️ WebSocket отключен. Запуск резервного поллинга...`
- Network tab shows periodic requests to `/api/tasks`, `/api/projects` every ~10 seconds

### Test 7: WebSocket Reconnection Sync
**Goal**: Verify single sync when WebSocket reconnects.

**Steps**:
1. Continue from Test 6 (WebSocket offline)
2. In DevTools, set throttling back to "No throttling"
3. Wait for reconnection
4. Observe console and Network tab

**Expected Result**:
- Console shows: `🔌 WebSocket status changed: Connected`
- Console shows: `🔄 WebSocket восстановлен. Синхронизация данных...`
- Console shows: `⚡ WebSocket активен. Поллинг отключен.`
- Network shows ONE sync request, then no more periodic polling

### Test 8: Drag and Drop During Polling
**Goal**: Verify polling respects drag state.

**Steps**:
1. Force WebSocket offline (DevTools -> Offline mode)
2. Start dragging a task card
3. Hold the drag for 15+ seconds
4. Observe console and Network

**Expected Result**:
- Console shows: `[Smart Polling] Skipping update during drag operation`
- No API requests occur while dragging
- After dropping card, next polling cycle proceeds normally

### Test 9: Multiple Tabs Sync
**Goal**: Verify all changes sync across multiple tabs.

**Steps**:
1. Open 3 browser tabs with the same user
2. In Tab 1, create a task
3. In Tab 2, add an attachment to that task
4. In Tab 3, add a comment

**Expected Result**:
- All tabs show all changes immediately
- All WebSocket events are received by all tabs
- No conflicts or duplicate data

### Test 10: Server Restart Recovery
**Goal**: Verify app handles server restart gracefully.

**Steps**:
1. Have app running in browser
2. Stop backend server (Ctrl+C)
3. Wait 10 seconds
4. Restart backend server
5. Observe console

**Expected Result**:
- Console shows disconnect: `🔌 WebSocket: Disconnected`
- Smart Polling activates: `⚠️ WebSocket отключен. Запуск резервного поллинга...`
- After server restart, WebSocket reconnects: `✅ WebSocket: Connected`
- Console shows sync: `🔄 WebSocket восстановлен. Синхронизация данных...`
- Polling stops: `⚡ WebSocket активен. Поллинг отключен.`

## Performance Verification

### Network Load Comparison

**Before (Constant Polling)**:
- HTTP requests: Every 5 seconds continuously
- 12 requests per minute per tab
- 720 requests per hour per tab

**After (WebSocket-First with Smart Polling)**:
- HTTP requests when WebSocket active: 0 (only WebSocket)
- HTTP requests when WebSocket offline: Every 10 seconds
- 6 requests per minute per tab (fallback only)
- Typical operation: 0-10 requests per hour per tab

**Expected Improvement**: 95%+ reduction in HTTP requests

## Troubleshooting

### WebSocket Not Connecting
1. Check console for auth token
2. Verify VITE_API_BASE_URL in .env
3. Check server logs for connection attempts
4. Verify CORS settings in server

### Polling Not Stopping
1. Verify `isRealtimeConnected` is true
2. Check console for WebSocket connection status
3. Look for errors in WebSocket event listener

### Events Not Syncing
1. Check if WebSocket rooms are joined correctly
2. Verify server emits events (check server logs)
3. Check if event handlers are registered (console)
4. Verify no errors in event processing

## Success Criteria

✅ WebSocket connected: No HTTP polling
✅ Task creation: Instant sync via WebSocket
✅ Attachments: Instant sync via WebSocket  
✅ Custom columns: Instant sync via WebSocket
✅ Categories: Instant sync via WebSocket
✅ WebSocket offline: Smart Polling active (10s interval)
✅ WebSocket reconnect: Single sync + polling stops
✅ Drag respect: No updates during drag
✅ Multi-tab: All changes sync instantly
✅ Network load: 95%+ reduction in HTTP requests
