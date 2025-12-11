# Fix: Mention Autocomplete Click/Enter Issue in Radix Dialog

## 🐛 Problem Description

When trying to select a user from the mention autocomplete list (@username):
- ❌ Mouse click did not work
- ❌ Enter key did not work
- ✅ User list displayed correctly
- ✅ Arrow key navigation worked (highlighting changed)

## 🔍 Root Cause

**MentionAutocomplete was rendered INSIDE Radix UI Dialog!**

Radix UI Dialog (@radix-ui/react-dialog) has built-in event handling:
- Focus trap - focus is trapped inside the dialog
- Escape key handler - closes dialog on Escape
- Click outside handler - closes dialog on click outside DialogContent
- **Event capturing** - uses capture phase to intercept events
- Pointer events management - manages mouse events

### Why It Didn't Work:

1. **Radix Dialog intercepts events in CAPTURE PHASE** (before bubbling!)
2. `e.stopPropagation()` DOESN'T HELP against capture phase listeners
3. Dialog intercepts the event BEFORE it reaches MentionAutocomplete
4. `overflow-y: auto` on DialogContent creates new stacking context and can clip elements

## 💡 Solution: Use React Portal

Render MentionAutocomplete OUTSIDE DialogContent using `createPortal` from React.

## 📝 Changes Made

### Change 1: task-modal.tsx - Add createPortal import

```tsx
import React from 'react';
import { createPortal } from 'react-dom';
```

### Change 2: task-modal.tsx - Use Portal for MentionAutocomplete (lines ~1503-1515)

**Before:**
```tsx
{/* Mention Autocomplete */}
{showMentionAutocomplete && (
  <MentionAutocomplete
    users={mentionableUsers}
    onSelect={handleMentionSelect}
    searchQuery={mentionQuery}
    position={mentionPosition}
    onClose={() => setShowMentionAutocomplete(false)}
  />
)}
```

**After:**
```tsx
{/* Mention Autocomplete - render outside Dialog using Portal */}
{showMentionAutocomplete && createPortal(
  <MentionAutocomplete
    users={mentionableUsers}
    onSelect={handleMentionSelect}
    searchQuery={mentionQuery}
    position={mentionPosition}
    onClose={() => setShowMentionAutocomplete(false)}
  />,
  document.body
)}
```

### Change 3: mention-autocomplete.tsx - Update positioning and z-index (line 128)

**Before:**
```tsx
className="absolute z-50 w-72 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
```

**After:**
```tsx
className="fixed z-[100] w-72 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
```

**Changes:**
- `absolute` → `fixed` (because element is now rendered in `document.body` and coordinates are calculated relative to viewport)
- `z-50` → `z-[100]` (to be above Radix Dialog which uses z-50)

### Change 4: task-modal.tsx - Add cleanup useEffect (after line 327)

```tsx
// Close mention autocomplete when Dialog closes
React.useEffect(() => {
  if (!open) {
    setShowMentionAutocomplete(false);
  }
}, [open]);
```

### Change 5: handleCommentKeyDown - Already Correct ✅

The `handleCommentKeyDown` function was already correctly implemented:
- Prevents default for arrow keys when autocomplete is open
- Does NOT prevent default for Enter key, allowing the event to reach document listener

```typescript
const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (showMentionAutocomplete) {
    // For arrows, prevent cursor movement in textarea
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    // For Enter - do NOT call preventDefault so the event reaches document
    return;
  }
  
  // Submit on Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (commentText.trim() && !isSubmittingComment) {
      handleSubmitComment();
    }
  }
};
```

## ✅ Acceptance Criteria

After the fix, the following should work:
1. ✅ Select user with mouse click
2. ✅ Select user with Enter key
3. ✅ Navigate with arrow keys up/down
4. ✅ Close on Escape
5. ✅ Close on click outside list
6. ✅ Correct autocomplete positioning (not clipped by overflow)
7. ✅ Entire list visible above Dialog
8. ✅ Focus remains on textarea after selection
9. ✅ Mention correctly inserted into text
10. ✅ Autocomplete closes when Dialog closes

## 🏗️ Technical Details

### Why Portal Works:

1. **Bypasses Dialog's Event Capture**: By rendering outside Dialog, the autocomplete receives events directly
2. **Correct Stacking Context**: With z-[100], it appears above Dialog (z-50)
3. **No Overflow Clipping**: Not constrained by DialogContent's overflow-y: auto
4. **Fixed Positioning**: Coordinates remain correct relative to viewport

### Files Modified:
- `src/components/task-modal.tsx` - Added Portal rendering and cleanup
- `src/components/mention-autocomplete.tsx` - Updated positioning and z-index

### Build Status:
✅ Build completed successfully with no errors

## 📚 Lessons Learned

1. **Radix Dialog Event Handling**: Radix Dialog intercepts events in capture phase, which means nested interactive components may not receive events properly.

2. **Portal Pattern**: When adding interactive dropdowns, autocompletes, or popovers inside Radix Dialog, use `createPortal` to render them in `document.body`.

3. **Positioning Strategy**: When using Portal with fixed positioning, ensure coordinates are calculated relative to viewport, not parent element.

4. **Z-index Management**: Components rendered via Portal need explicit z-index to appear above Dialog overlays.

## 🔗 Related Components

- **MentionAutocomplete**: User selection dropdown for @mentions
- **Radix Dialog**: Modal dialog component from @radix-ui/react-dialog
- **TaskModal**: Main task creation/editing modal

## 🚀 Next Steps

1. Test the fix in development environment
2. Verify all acceptance criteria are met
3. Test edge cases (long user lists, different screen sizes)
4. Monitor for any regression issues
