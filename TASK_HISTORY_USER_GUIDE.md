# Task History - User Guide

## Overview
The Task History feature provides a comprehensive audit trail of all changes made to tasks in your project management system.

## Accessing Task History

### Step 1: Open a Task
Click on any task to open the task detail modal.

### Step 2: Navigate to History Tab
You'll see two tabs at the bottom of the task modal:
- **Комментарии** (Comments) - View and add comments
- **История** (History) - View complete change history

Click on the "История" tab to view the task's complete history.

## What Gets Tracked

### Task Creation
When a task is first created, you'll see:
```
✅ [User Name] создал задачу
   2 часа назад
```

### Status Changes
When a task status changes:
```
🔄 [User Name] изменил статус
   К выполнению → В процессе
   1 час назад
```

### Assignee Changes
When someone is assigned to a task:
```
👤 [User Name] назначил исполнителя
   Александр Петров
   30 минут назад
```

When an assignee is removed:
```
👤 [User Name] снял исполнителя
   Мария Иванова
   15 минут назад
```

### Priority Changes
When task priority changes:
```
🔥 [User Name] изменил приоритет
   Средний → Высокий
   45 минут назад
```

### Deadline Changes
When a deadline is set:
```
📅 [User Name] установил дедлайн
   25 декабря 2024
   1 час назад
```

When a deadline is changed:
```
📅 [User Name] изменил дedлайн
   20 дек → 25 дек
   30 минут назад
```

When a deadline is removed:
```
📅 [User Name] удалил дедлайн
   10 минут назад
```

### Title and Description Changes
When the title is changed:
```
✏️ [User Name] изменил название
   Новое название задачи
   20 минут назад
```

When the description is changed:
```
✏️ [User Name] изменил описание
   15 минут назад
```

### Project Changes
When a task is moved to another project:
```
📁 [User Name] переместил в другой проект
   Личные задачи → Веб-сайт
   1 час назад
```

### Category Changes
When a task category is changed:
```
🏷️ [User Name] изменил категорию
   Без категории → Дизайн
   40 минут назад
```

### Comments
When a comment is added:
```
💬 [User Name] добавил комментарий
   Не забудьте про адаптивную версию для...
   5 минут назад
```

## Timeline Display

The history is displayed as a beautiful timeline with:

1. **Color-coded icons** for each action type
2. **User avatars** showing who made each change
3. **Relative timestamps** (e.g., "2 часа назад")
4. **Before/after values** for changes
5. **Chronological order** (most recent first)

## Status Translations

The system automatically translates status values to Russian:
- `todo` → "К выполнению"
- `in_progress` → "В процессе"
- `done` → "Выполнено"

## Priority Translations

Priority values are also translated:
- `low` → "Низкий"
- `medium` → "Средний"
- `high` → "Высокий"

## Icon Legend

- ✅ **Plus icon (green)** - Task created
- 🔄 **Arrow icon (blue)** - Status changed
- 👤 **User icon (yellow)** - Assignee changed
- 🔥 **Flame icon** - Priority changed
- 📅 **Calendar icon** - Deadline changed
- 💬 **Message icon (purple)** - Comment added
- 📁 **Folder icon** - Project changed
- 🏷️ **Tag icon** - Category changed
- ✏️ **Edit icon** - General update

## Empty State

If a task has no history yet, you'll see:
```
💬 История изменений пока пуста
```

This typically happens with newly created tasks before any changes are made.

## Automatic Updates

The history automatically refreshes when:
- You add a comment
- Any field is updated
- The modal is reopened

## Performance

- History is loaded on-demand when you open the History tab
- Results are cached during the modal session
- Database queries are optimized with proper indexing

## Privacy and Security

- Only users with access to the task can view its history
- History entries show which user made each change
- History is automatically deleted when a task is deleted
- No sensitive data is stored in history entries

## Tips

1. **Review Changes**: Use history to understand why a task was changed
2. **Track Progress**: See how a task evolved over time
3. **Accountability**: Know who made what changes and when
4. **Audit Trail**: Complete record for project management reviews
5. **Team Coordination**: Understand what teammates have done

## Technical Details

For developers and system administrators, see:
- `TASK_HISTORY_IMPLEMENTATION.md` - Technical implementation details
- Database migration: `prisma/migrations/20251210112928_add_task_history/`
