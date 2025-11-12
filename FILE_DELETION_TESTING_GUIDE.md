# Testing Guide: File Deletion System Fix

## Overview
This guide provides step-by-step instructions to test all changes made in the file deletion system fix.

---

## Prerequisites
1. Server running: `npm run dev:server`
2. Frontend running: `npm run dev`
3. Test user account with projects and tasks
4. Browser DevTools open (Network tab)

---

## Test 1: Task Attachment Deletion via UI

### Setup:
1. Create a test task or use existing task with attachments
2. Upload one or more files to the task

### Test Steps:
1. Open task modal (click on any task)
2. Locate the attachments section
3. Click the "X" button next to an attachment
4. Verify loading state appears

### Expected Results:
- ✅ Attachment disappears from UI immediately
- ✅ No error messages in console
- ✅ Network tab shows: `DELETE /api/tasks/{taskId}/attachments/{attachmentId}` with 200 status
- ✅ File is removed from `uploads/` directory (check server filesystem)
- ✅ Refreshing the page shows attachment is gone

### Check Server Logs:
```
🗑️ Deleted file: {filename}
```

---

## Test 2: Cascade Delete - Task Deletion

### Setup:
1. Create a test task with 2-3 file attachments
2. Note the filenames in `uploads/` directory before deletion

### Test Steps:
1. Delete the task (using delete button)
2. Confirm deletion in dialog

### Expected Results:
- ✅ Task disappears from UI
- ✅ No error messages
- ✅ Network tab shows: `DELETE /api/tasks/{taskId}` with 200 status
- ✅ ALL attachment files removed from `uploads/` directory
- ✅ Database records cleaned up

### Check Server Logs:
```
🗑️ Deleted file: {filename1}
🗑️ Deleted file: {filename2}
🗑️ Deleted file: {filename3}
```

---

## Test 3: Cascade Delete - Project Deletion

### Setup:
1. Create a test project with:
   - 2-3 project attachments (uploaded at project level)
   - 2-3 tasks, each with 1-2 attachments
2. Note ALL filenames in `uploads/` directory

### Test Steps:
1. Delete the project
2. Confirm deletion

### Expected Results:
- ✅ Project disappears from UI
- ✅ ALL project attachments deleted from `uploads/`
- ✅ ALL task attachments from project tasks deleted from `uploads/`
- ✅ No orphaned files remain
- ✅ Database fully cleaned up

### Check Server Logs:
```
🗑️ Deleted project file: {project-file1}
🗑️ Deleted project file: {project-file2}
🗑️ Deleted task file: {task1-file1}
🗑️ Deleted task file: {task1-file2}
🗑️ Deleted task file: {task2-file1}
...
```

### Manual Verification:
```bash
# Before deletion
ls -la uploads/ | wc -l
# Note the count

# After deletion
ls -la uploads/ | wc -l
# Should be reduced by number of project + task files
```

---

## Test 4: Long Filename UI Display

### Setup:
1. Prepare test files with very long names:
   - `Very_Long_Filename_With_Many_Characters_That_Should_Be_Truncated_Properly_Test_File_1234567890.pdf`
   - `Очень_Длинное_Имя_Файла_С_Кириллицей_Которое_Должно_Быть_Обрезано_Правильно.docx`

### Test Steps - Project Modal:
1. Open "Edit Project" modal
2. Upload file with long name to Links section
3. Upload file with long name to Attachments section

### Expected Results:
- ✅ Filename truncated with ellipsis (...)
- ✅ Modal width doesn't stretch
- ✅ No horizontal scrollbar
- ✅ Icon remains visible and aligned
- ✅ File size remains visible
- ✅ Delete button remains visible and clickable

### Test Steps - Project About Modal:
1. Open project "About" (info modal)
2. View links and attachments sections

### Expected Results:
- ✅ Same truncation behavior as edit modal
- ✅ Consistent styling
- ✅ No layout breaks

---

## Test 5: Responsive Modal Design

### Test Steps - Desktop (1920x1080):
1. Open "Project Members" modal
2. Try to invite a new member
3. Note the layout of invitation form

### Expected Results:
- ✅ Form elements in single horizontal row
- ✅ Email input takes majority of width
- ✅ Role selector has fixed width (w-52)
- ✅ Invite button has auto width
- ✅ Good spacing between elements

### Test Steps - Tablet (768px):
1. Resize browser to 768px width
2. Open "Project Members" modal
3. Try to invite a new member

### Expected Results:
- ✅ Form still in horizontal row (sm: breakpoint)
- ✅ Elements properly sized
- ✅ No overflow

### Test Steps - Mobile (375px):
1. Resize browser to 375px width or use mobile DevTools
2. Open "Project Members" modal
3. Try to invite a new member

### Expected Results:
- ✅ Form elements stack vertically (flex-col)
- ✅ Email input is full width
- ✅ Role selector is full width
- ✅ Invite button is full width
- ✅ Good vertical spacing
- ✅ Modal fits within viewport
- ✅ Padding is reduced (p-4)

---

## Test 6: Rate Limiting

### Test Steps:
1. Attempt to delete 10+ files rapidly (within 15 minutes)
2. Try the 11th deletion

### Expected Results:
- ✅ First 10 deletions succeed
- ✅ 11th deletion returns 429 (Too Many Requests)
- ✅ Error message: "Слишком много попыток загрузки файлов. Попробуйте через 15 минут."
- ✅ After 15 minutes, deletions work again

---

## Test 7: Permission Validation

### Test Steps - Task Attachment:
1. Login as user with "Viewer" role in a project
2. Try to delete a task attachment

### Expected Results:
- ✅ Delete fails with 403 Forbidden
- ✅ Error message about permissions
- ✅ File not deleted

### Test Steps - Project Deletion:
1. Login as "Collaborator" in a project
2. Try to delete the project

### Expected Results:
- ✅ Delete fails with 403 Forbidden
- ✅ Error: "Only the project owner can delete the project"

---

## Test 8: Security - Path Traversal Prevention

### Manual Testing (Developer Only):
⚠️ This test requires direct API access

### Test Steps:
1. Get valid authentication token
2. Try to delete with malicious paths:

```bash
# Attempt 1: Directory traversal
DELETE /api/tasks/{taskId}/attachments/../../../etc/passwd

# Attempt 2: Absolute path
DELETE /api/tasks/{taskId}/attachments//etc/passwd

# Attempt 3: URL encoded traversal
DELETE /api/tasks/{taskId}/attachments/%2e%2e%2f%2e%2e%2f
```

### Expected Results:
- ✅ All attempts fail safely
- ✅ Only files in `uploads/` directory can be affected
- ✅ No directory traversal possible
- ✅ Path normalization prevents attacks

---

## Test 9: Error Handling - Missing Files

### Test Steps:
1. Create task with attachment
2. Manually delete file from `uploads/` directory
3. Delete task from UI

### Expected Results:
- ✅ Task deletion succeeds
- ✅ No error shown to user
- ✅ Database cleaned up properly
- ✅ Server logs show: "Failed to delete file:" (handled gracefully)

---

## Test 10: Concurrent Operations

### Test Steps:
1. Open same task in two browser tabs
2. Delete attachment in tab 1
3. Try to delete same attachment in tab 2

### Expected Results:
- ✅ First deletion succeeds
- ✅ Second deletion returns 404 (Not Found)
- ✅ No server errors
- ✅ UI shows appropriate error message

---

## Regression Testing

### Things That Should Still Work:
- ✅ Uploading new attachments
- ✅ Downloading attachments
- ✅ Creating tasks without attachments
- ✅ Creating projects without attachments
- ✅ Editing tasks/projects without touching attachments
- ✅ Viewing attachments in read-only mode

---

## Performance Testing

### Large Project Deletion:
1. Create project with:
   - 10 project attachments
   - 50 tasks
   - 3 attachments per task (150 total task attachments)
2. Delete the project

### Expected Results:
- ✅ Deletion completes within reasonable time (< 30 seconds)
- ✅ All 160 files deleted
- ✅ No timeout errors
- ✅ Server remains responsive

---

## Browser Compatibility

Test on:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Sign-Off Checklist

- [ ] Test 1: Task attachment deletion works
- [ ] Test 2: Task cascade deletion works
- [ ] Test 3: Project cascade deletion works
- [ ] Test 4: Long filenames display correctly
- [ ] Test 5: Modals are responsive
- [ ] Test 6: Rate limiting works
- [ ] Test 7: Permissions enforced
- [ ] Test 8: Path traversal prevented
- [ ] Test 9: Error handling graceful
- [ ] Test 10: Concurrent operations safe
- [ ] Regression: No broken features
- [ ] Performance: Acceptable speed
- [ ] Browser: Works across browsers

---

## Reporting Issues

If any test fails, please report with:
1. Test number and name
2. Steps to reproduce
3. Expected vs actual result
4. Browser and version
5. Server console logs
6. Network tab screenshot
