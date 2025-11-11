# Структура компонентов и их взаимосвязи

## Иерархия React компонентов

```
App.tsx (Root)
│
├─── ErrorBoundary
│    └─── Catches and displays errors
│
├─── DndProviderWrapper
│    └─── Provides HTML5 drag-and-drop context
│
└─── AppProvider (Context)
     │    └─── Global state management
     │
     ├─── SidebarProvider
     │    │
     │    ├─── Header
     │    │    ├─── Logo
     │    │    ├─── Navigation menu
     │    │    ├─── Profile dropdown
     │    │    └─── Create task button
     │    │
     │    ├─── SidebarNav
     │    │    ├─── Navigation items
     │    │    │    ├─── Dashboard
     │    │    │    ├─── Projects
     │    │    │    ├─── Tasks
     │    │    │    ├─── Categories
     │    │    │    ├─── Archive
     │    │    │    └─── Profile
     │    │    │
     │    │    ├─── RealtimeIndicator
     │    │    └─── Logout button
     │    │
     │    └─── SidebarInset (Main content area)
     │         │
     │         └─── [Current View based on routing]
     │              │
     │              ├─── DashboardView
     │              │    ├─── Stats cards
     │              │    ├─── PersonalKanbanBoard
     │              │    │    ├─── KanbanSkeleton (loading)
     │              │    │    └─── Task cards with DnD
     │              │    └─── Calendar button
     │              │
     │              ├─── DashboardCalendarView
     │              │    ├─── Calendar component
     │              │    ├─── Task list for selected date
     │              │    └─── Back button
     │              │
     │              ├─── ProjectsView
     │              │    ├─── ProjectModal (create/edit)
     │              │    ├─── Project cards grid
     │              │    └─── Archive toggle
     │              │
     │              ├─── ProjectDetailView
     │              │    ├─── Project header
     │              │    │    ├─── Name, description
     │              │    │    ├─── Members button
     │              │    │    ├─── Calendar button
     │              │    │    ├─── Settings button
     │              │    │    └─── Back button
     │              │    │
     │              │    ├─── ProjectMembersModal
     │              │    │    ├─── Members list
     │              │    │    ├─── Invite form
     │              │    │    ├─── Pending invitations
     │              │    │    └─── Role management
     │              │    │
     │              │    ├─── ProjectKanbanBoard
     │              │    │    ├─── Filtered tasks by project
     │              │    │    ├─── DnD functionality
     │              │    │    └─── Task cards
     │              │    │
     │              │    └─── ProjectAboutModal
     │              │         ├─── Project info
     │              │         ├─── Edit form
     │              │         └─── Delete button
     │              │
     │              ├─── ProjectCalendarView
     │              │    ├─── Project calendar
     │              │    ├─── Tasks on dates
     │              │    └─── Back button
     │              │
     │              ├─── TasksView
     │              │    ├─── FiltersPanel
     │              │    │    ├─── Status filter
     │              │    │    ├─── Priority filter
     │              │    │    ├─── Project filter
     │              │    │    └─── Search
     │              │    │
     │              │    └─── TaskTable
     │              │         ├─── Sortable columns
     │              │         ├─── Task rows
     │              │         └─── Pagination
     │              │
     │              ├─── CategoriesView
     │              │    ├─── Category list
     │              │    ├─── Create category
     │              │    └─── Edit/delete actions
     │              │
     │              ├─── ArchiveView
     │              │    ├─── Archived projects
     │              │    └─── Restore button
     │              │
     │              ├─── ProfileView
     │              │    ├─── User info
     │              │    ├─── Avatar upload
     │              │    ├─── Password change
     │              │    └─── Settings
     │              │
     │              └─── InviteAcceptPage
     │                   ├─── Invitation details
     │                   ├─── Accept button
     │                   └─── Decline button
     │
     └─── Global Modals
          │
          ├─── TaskModal
          │    ├─── Title input
          │    ├─── Description textarea
          │    ├─── Status select
          │    ├─── Priority select
          │    ├─── Project select
          │    ├─── Category select
          │    ├─── Assignee select
          │    ├─── Due date picker
          │    ├─── Tags input
          │    ├─── Attachments section
          │    │    ├─── Upload button
          │    │    └─── File list
          │    └─── Save/Cancel buttons
          │
          ├─── CreateTaskDialog (simplified version)
          │    └─── Quick task creation
          │
          ├─── TaskDetailModal
          │    ├─── Full task view
          │    ├─── Comments (if implemented)
          │    ├─── Activity log
          │    └─── Edit button
          │
          └─── InvitationsModal
               ├─── Invitation list
               ├─── Send invitation form
               └─── Manage invitations
```

## Основные UI компоненты (src/components/ui/)

```
ui/
├── accordion.tsx         - Раскрывающиеся секции
├── alert-dialog.tsx      - Модальные диалоги подтверждения
├── avatar.tsx            - Аватары пользователей
├── button.tsx            - Кнопки (primary, secondary, ghost, etc.)
├── calendar.tsx          - Компонент календаря
├── card.tsx              - Карточки для контента
├── checkbox.tsx          - Чекбоксы
├── collapsible.tsx       - Сворачиваемые блоки
├── command.tsx           - Command palette (Cmd+K)
├── context-menu.tsx      - Контекстное меню (ПКМ)
├── dialog.tsx            - Модальные окна
├── dropdown-menu.tsx     - Выпадающие меню
├── form.tsx              - Обертки для форм
├── hover-card.tsx        - Карточки при наведении
├── input.tsx             - Текстовые поля
├── label.tsx             - Лейблы для форм
├── menubar.tsx           - Меню-бары
├── navigation-menu.tsx   - Навигационные меню
├── popover.tsx           - Всплывающие окна
├── progress.tsx          - Прогресс-бары
├── radio-group.tsx       - Радио-кнопки
├── scroll-area.tsx       - Скроллируемые области
├── select.tsx            - Селекты (выпадающие списки)
├── separator.tsx         - Разделители
├── sheet.tsx             - Боковые панели
├── sidebar.tsx           - Сайдбар компоненты
├── skeleton.tsx          - Скелетоны загрузки
├── slider.tsx            - Слайдеры
├── sonner.tsx            - Тосты (уведомления)
├── switch.tsx            - Переключатели
├── table.tsx             - Таблицы
├── tabs.tsx              - Вкладки
├── textarea.tsx          - Многострочные текстовые поля
├── toast.tsx             - Тосты (альтернативная реализация)
├── toggle.tsx            - Тогглы
├── toggle-group.tsx      - Группы тогглов
└── tooltip.tsx           - Подсказки
```

## Взаимодействие компонентов с контекстом

```
┌─────────────────────────────────────────────────────────────┐
│                        AppContext                            │
│                    (Global State Store)                      │
├─────────────────────────────────────────────────────────────┤
│  State:                                                      │
│  • tasks: Task[]                                            │
│  • projects: Project[]                                      │
│  • categories: Category[]                                   │
│  • loading: boolean                                         │
│  • error: Error | null                                      │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ useContext(AppContext)
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ DashboardView│  │ProjectsView │  │  TasksView  │
├─────────────┤  ├─────────────┤  ├─────────────┤
│ Uses:        │  │ Uses:       │  │ Uses:       │
│ • tasks     │  │ • projects  │  │ • tasks     │
│ • loading   │  │ • loading   │  │ • projects  │
│             │  │             │  │ • loading   │
│ Calls:      │  │ Calls:      │  │             │
│ • refresh   │  │ • create    │  │ Calls:      │
│   Tasks()   │  │   Project() │  │ • refresh   │
│             │  │ • update    │  │   Tasks()   │
│             │  │   Project() │  │ • filter    │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Поток данных для создания задачи

```
User clicks "Create Task" button
         │
         ▼
Header component
         │
         ├─ setIsCreateTaskOpen(true)
         │
         ▼
TaskModal opens
         │
         ├─ User fills form:
         │  • Title
         │  • Description
         │  • Status
         │  • Priority
         │  • Project (optional)
         │  • Assignee (optional)
         │  • Due date (optional)
         │
         └─ User clicks "Create"
                  │
                  ▼
         TaskModal.onSave()
                  │
                  ▼
         const { createTask } = useContext(AppContext)
                  │
                  ▼
         createTask(taskData)
                  │
                  ├─ Optimistic update:
                  │  setTasks([...tasks, tempTask])
                  │
                  ├─ API call:
                  │  tasksAPI.createTask(taskData)
                  │        │
                  │        └─> POST /api/tasks
                  │                  │
                  │                  ├─ Authenticate
                  │                  ├─ Validate
                  │                  ├─ Check permissions
                  │                  ├─ Prisma.task.create()
                  │                  └─ Response: created task
                  │
                  ├─ On success:
                  │  • Replace temp task with real task
                  │  • Show success toast
                  │  • Close modal
                  │
                  └─ On error:
                     • Rollback optimistic update
                     • Show error toast
                     • Keep modal open
```

## Поток данных для Drag & Drop

```
User drags task card
         │
         ▼
react-dnd (DragSource)
         │
         ├─ onDragStart
         │  • Store dragged task ID
         │  • Visual feedback (opacity)
         │
         ├─ onDragOver (DropTarget)
         │  • Calculate drop position
         │  • Show drop indicator
         │
         └─ onDrop
                  │
                  ▼
         useKanbanDnD hook
                  │
                  ├─ Get tasks in target column
                  ├─ Find drop index
                  ├─ Calculate new orderKey:
                  │     const beforeTask = targetTasks[dropIndex - 1]
                  │     const afterTask = targetTasks[dropIndex]
                  │     const newOrderKey = generateOrderKey(
                  │       beforeTask?.orderKey,
                  │       afterTask?.orderKey
                  │     )
                  │
                  ├─ Optimistic UI update:
                  │  • Move task in local state
                  │  • Update status
                  │  • Update orderKey
                  │
                  └─ API call:
                           │
                           ▼
                  const { updateTask } = useContext(AppContext)
                           │
                           ▼
                  updateTask(taskId, {
                    status: newStatus,
                    orderKey: newOrderKey
                  })
                           │
                           └─> PUT /api/tasks/:id
                                     │
                                     ├─ Authenticate
                                     ├─ Check canEditTask()
                                     ├─ Prisma.task.update()
                                     └─ Response
                                           │
                                           ├─ Success: keep update
                                           └─ Error: rollback
```

## Взаимодействие с системой разрешений

```
┌────────────────────────────────────────────────────────────┐
│                Component Permission Checks                  │
└────────────────────────────────────────────────────────────┘

ProjectDetailView
         │
         ├─ Load project
         ├─ Get user role in project
         │     const role = await getUserRoleInProject(
         │       userId,
         │       projectId
         │     )
         │
         └─ Conditional rendering based on role:
                  │
                  ├─ role === 'owner' || role === 'collaborator'
                  │     └─> Show: Edit, Delete, Invite buttons
                  │
                  ├─ role === 'member'
                  │     └─> Show: Create task button
                  │          Hide: Edit project, Delete, Invite
                  │
                  └─ role === 'viewer'
                        └─> Show: View only
                             Hide: All edit buttons


TaskModal (Edit mode)
         │
         ├─ Load task
         ├─ Check if user can edit:
         │     const canEdit = await canEditTask(
         │       userId,
         │       taskId
         │     )
         │
         └─ Conditional rendering:
                  │
                  ├─ canEdit === true
                  │     └─> Enable all fields
                  │          Show: Save, Delete buttons
                  │
                  └─ canEdit === false
                        └─> Disable all fields
                             Show: Read-only view
                             Display: "You don't have permission"


ProjectMembersModal
         │
         ├─ Get current user role
         │
         └─ For each member:
                  │
                  ├─ role === 'owner'
                  │     └─> Show: Change role, Remove buttons
                  │          For all members (except self)
                  │
                  ├─ role === 'collaborator'
                  │     └─> Show: Remove button
                  │          For members (not owners/collaborators)
                  │          Hide: Change role button
                  │
                  └─ role === 'member' || 'viewer'
                        └─> Show: View only
                             Hide: All management buttons
```

## Компоненты с внешними зависимостями

```
┌──────────────────────────────────────────────────────────────┐
│              Third-party Libraries Usage                      │
└──────────────────────────────────────────────────────────────┘

KanbanBoard
├── react-dnd
│   ├── useDrag - Drag source hook
│   ├── useDrop - Drop target hook
│   └── DndProvider - Context provider
│
└── useKanbanDnD (custom hook)
    └── Wraps react-dnd logic


TaskModal / Forms
├── react-hook-form
│   ├── useForm - Form state management
│   ├── register - Field registration
│   ├── handleSubmit - Form submission
│   └── formState - Validation state
│
└── Radix UI Dialog
    ├── Dialog.Root
    ├── Dialog.Trigger
    ├── Dialog.Portal
    └── Dialog.Content


Calendar Components
├── date-fns
│   ├── format - Date formatting
│   ├── addDays - Date arithmetic
│   └── isSameDay - Date comparison
│
└── react-day-picker
    ├── DayPicker - Calendar widget
    └── Custom modifiers


Animations
├── framer-motion
│   ├── motion.div - Animated elements
│   ├── AnimatePresence - Exit animations
│   └── useAnimation - Imperative controls
│
└── Used in:
    ├── Modal transitions
    ├── Page transitions
    └── Drag feedback


File Uploads
├── Browser File API
│   ├── <input type="file">
│   ├── FileReader
│   └── FormData
│
└── multer (server-side)
    ├── diskStorage
    └── fileFilter


Notifications
├── sonner
│   ├── toast.success()
│   ├── toast.error()
│   ├── toast.info()
│   └── toast.loading()
│
└── Used for:
    ├── Action confirmations
    ├── Error messages
    └── Loading states
```

## Жизненный цикл компонента DashboardView

```
1. Component Mount
   └─> useEffect(() => {
         // Subscribe to context
         const { tasks, loading, refreshTasks } = useContext(AppContext)
         
         // Initial data fetch (if needed)
         if (tasks.length === 0 && !loading) {
           refreshTasks()
         }
       }, [])

2. Context Updates
   └─> AppContext polls every 5 seconds
       └─> New tasks received from server
           └─> Context updates state
               └─> DashboardView re-renders
                   └─> KanbanBoard updates with new tasks

3. User Interaction
   └─> User drags task
       └─> useKanbanDnD hook
           └─> Optimistic update (immediate)
           └─> API call (background)
               └─> Success: keep update
               └─> Error: rollback + toast

4. Component Unmount
   └─> useEffect cleanup
       └─> Unsubscribe from context (if needed)
       └─> Cancel pending requests
```

## Резюме взаимосвязей

### Основные паттерны

1. **Props drilling avoided**: Использование Context API для глобального состояния
2. **Single source of truth**: AppContext хранит каноничные данные
3. **Optimistic updates**: Немедленный UI отклик, откат при ошибке
4. **Polling sync**: Периодическая синхронизация с сервером
5. **Permission-based rendering**: Условный рендеринг на основе ролей

### Потоки данных

```
Server (Source of Truth)
       ↕ (Polling/API calls)
AppContext (Client Cache)
       ↕ (Context.Provider)
Components (UI Layer)
       ↕ (User interactions)
User Actions
```

### Зависимости компонентов

- **Высокосвязанные**: Header ↔ TaskModal (через props)
- **Слабосвязанные**: Views ↔ AppContext (через context)
- **Независимые**: UI components (через props only)

### Рекомендации по рефакторингу

1. **Разделить AppContext**: 
   - TasksContext
   - ProjectsContext
   - UserContext

2. **Внедрить React Query**:
   - Автоматическое кеширование
   - Оптимизация запросов
   - Управление загрузкой

3. **Компонентизация**:
   - Разбить большие компоненты (ProjectDetailView)
   - Выделить переиспользуемые части (TaskCard)

4. **TypeScript improvements**:
   - Строгие типы для props
   - Generic компоненты
   - Utility types для состояний
