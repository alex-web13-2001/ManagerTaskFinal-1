# Техническая архитектура Task Manager

## Диаграмма компонентов высокого уровня

```
┌─────────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   App.tsx    │  │  Components  │  │   Contexts   │          │
│  │  (Routing)   │  │    (UI)      │  │   (State)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                     │
│                  ┌─────────▼─────────┐                          │
│                  │   API Client      │                          │
│                  │  (JWT + Fetch)    │                          │
│                  └─────────┬─────────┘                          │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTP/REST
                             │ Authorization: Bearer <token>
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Express + TypeScript)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Middleware Layer                        │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐    │ │
│  │  │   CORS   │→ │ authenticate │→ │ canAccessProject │    │ │
│  │  └──────────┘  └──────────────┘  └──────────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      API Routes                             │ │
│  │  • /api/auth/*        - Аутентификация                     │ │
│  │  • /api/projects/*    - Управление проектами               │ │
│  │  • /api/tasks/*       - Управление задачами                │ │
│  │  • /api/invitations/* - Приглашения                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Business Logic Layer                      │ │
│  │  ┌──────────┐  ┌────────────┐  ┌─────────────┐           │ │
│  │  │   Auth   │  │Permissions │  │ Invitations │           │ │
│  │  │  (JWT)   │  │   (RBAC)   │  │   (Email)   │           │ │
│  │  └──────────┘  └────────────┘  └─────────────┘           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Prisma ORM Layer                         │ │
│  │  • User queries                                             │ │
│  │  • Project queries                                          │ │
│  │  • Task queries                                             │ │
│  │  • Transaction management                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQL
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                         │
│  • users              - Пользователи                            │
│  • projects           - Проекты                                 │
│  • project_members    - Участники проектов (RBAC)              │
│  • tasks              - Задачи                                  │
│  • attachments        - Вложения                                │
│  • invitations        - Приглашения                             │
│  • kv_store           - Key-Value хранилище                     │
└─────────────────────────────────────────────────────────────────┘
```

## Диаграмма потока аутентификации

```
┌────────┐                                              ┌────────┐
│ Client │                                              │ Server │
└───┬────┘                                              └───┬────┘
    │                                                       │
    │  1. POST /api/auth/signin                            │
    │     { email, password }                              │
    ├──────────────────────────────────────────────────────>
    │                                                       │
    │                          2. Validate credentials     │
    │                             bcrypt.compare()         │
    │                                    │                 │
    │                                    ▼                 │
    │                          3. Generate JWT token       │
    │                             jwt.sign()               │
    │                                    │                 │
    │  4. Response: { token, user }      │                 │
    │<──────────────────────────────────────────────────────
    │                                                       │
    │  5. Store token in localStorage                      │
    │     localStorage.setItem('auth_token', token)        │
    │                                                       │
    │  6. Subsequent requests with token                   │
    │     Authorization: Bearer <token>                    │
    ├──────────────────────────────────────────────────────>
    │                                                       │
    │                          7. Verify token             │
    │                             jwt.verify()             │
    │                                    │                 │
    │                                    ▼                 │
    │                          8. Extract user ID          │
    │                             payload.sub              │
    │                                    │                 │
    │  9. Response with data             │                 │
    │<──────────────────────────────────────────────────────
    │                                                       │
```

## Диаграмма системы разрешений (RBAC)

```
┌────────────────────────────────────────────────────────────────┐
│                     RBAC Permission System                      │
└────────────────────────────────────────────────────────────────┘

Request Flow:
─────────────

  Client Request
       │
       ▼
  authenticate()
       │
       ├─ Verify JWT Token
       └─ Extract user ID (req.user.sub)
       │
       ▼
  canAccessProject()
       │
       ├─ Get project ID from params
       ├─ Query: getUserRoleInProject(userId, projectId)
       │     │
       │     ├─ Check: User is owner? → return 'owner'
       │     ├─ Check: User is member? → return role from ProjectMember
       │     └─ Otherwise → return null (403 Forbidden)
       │
       └─ Attach role to req.user.roleInProject
       │
       ▼
  Endpoint Handler
       │
       ├─ Perform action based on role
       └─ Return response


Permission Matrix:
──────────────────

┌─────────────────────┬───────┬──────────────┬────────┬────────┐
│ Action              │ Owner │ Collaborator │ Member │ Viewer │
├─────────────────────┼───────┼──────────────┼────────┼────────┤
│ View project        │   ✅  │      ✅      │   ✅   │   ✅   │
│ Edit project        │   ✅  │      ✅      │   ❌   │   ❌   │
│ Delete project      │   ✅  │      ❌      │   ❌   │   ❌   │
│ Archive project     │   ✅  │      ❌      │   ❌   │   ❌   │
│ Invite users        │   ✅  │      ✅      │   ❌   │   ❌   │
│ Remove members      │   ✅  │      ✅      │   ❌   │   ❌   │
│ Change roles        │   ✅  │      ❌      │   ❌   │   ❌   │
├─────────────────────┼───────┼──────────────┼────────┼────────┤
│ View tasks          │   ✅  │      ✅      │   ✅   │   ✅   │
│ Create tasks        │   ✅  │      ✅      │   ✅   │   ❌   │
│ Edit own tasks      │   ✅  │      ✅      │   ✅   │   ❌   │
│ Edit any task       │   ✅  │      ✅      │   ❌   │   ❌   │
│ Delete own tasks    │   ✅  │      ✅      │   ✅   │   ❌   │
│ Delete any task     │   ✅  │      ✅      │   ❌   │   ❌   │
│ Assign tasks        │   ✅  │      ✅      │   ❌   │   ❌   │
└─────────────────────┴───────┴──────────────┴────────┴────────┘

Database Schema:
────────────────

projects
├── id (owner project)
└── ownerId ──────┐
                  │
                  ▼
         users.id (owner)


project_members
├── userId ───────> users.id
├── projectId ────> projects.id
└── role (enum: 'owner' | 'collaborator' | 'member' | 'viewer')
```

## Диаграмма работы с задачами

```
┌────────────────────────────────────────────────────────────────┐
│                    Task Management Flow                         │
└────────────────────────────────────────────────────────────────┘

1. Create Task
──────────────

User Input → TaskModal → tasksAPI.createTask()
                              │
                              ▼
                    POST /api/tasks
                    {
                      title, description,
                      status, priority,
                      projectId, assigneeId
                    }
                              │
                              ▼
                    Check permissions:
                    canCreateTask(userId, projectId)
                              │
                              ├─ Personal task (no projectId): ✅
                              └─ Project task: Check role in project
                              │
                              ▼
                    Generate orderKey
                    orderKey = "n" (initial)
                              │
                              ▼
                    Prisma.task.create()
                              │
                              ▼
                    Response: Created Task
                              │
                              ▼
                    Update Context State
                              │
                              ▼
                    Re-render UI


2. Drag & Drop Task (Kanban)
─────────────────────────────

User drags task to new column
         │
         ▼
useKanbanDnD hook
         │
         ├─ Calculate new position
         │  between tasks in column
         │
         ├─ Generate new orderKey
         │  orderKey = generateOrderKey(
         │    beforeTask.orderKey,
         │    afterTask.orderKey
         │  )
         │
         ├─ Optimistic UI update
         │  (immediate visual feedback)
         │
         └─ tasksAPI.updateTask()
                   │
                   ▼
         PUT /api/tasks/:id
         {
           status: "in_progress",
           orderKey: "k"
         }
                   │
                   ▼
         Check permissions:
         canEditTask(userId, taskId)
                   │
                   ▼
         Prisma.task.update()
                   │
                   ├─ Success: Keep optimistic update
                   └─ Error: Rollback UI


3. Task Ordering System (Lexicographic Keys)
─────────────────────────────────────────────

Initial state:
┌─────────┬───────┬──────────┐
│ Task ID │Status │ OrderKey │
├─────────┼───────┼──────────┤
│  task-1 │ todo  │    "a"   │
│  task-2 │ todo  │    "n"   │
│  task-3 │ todo  │    "z"   │
└─────────┴───────┴──────────┘

Insert task between task-1 and task-2:
  beforeKey = "a"
  afterKey = "n"
  newKey = "g" (midpoint between 'a' and 'n')

Result:
┌─────────┬───────┬──────────┐
│ Task ID │Status │ OrderKey │
├─────────┼───────┼──────────┤
│  task-1 │ todo  │    "a"   │
│  task-4 │ todo  │    "g"   │ <- NEW
│  task-2 │ todo  │    "n"   │
│  task-3 │ todo  │    "z"   │
└─────────┴───────┴──────────┘

Query: SELECT * FROM tasks WHERE status = 'todo' ORDER BY orderKey

Advantages:
✅ No need to reindex all tasks
✅ Efficient for frequent reordering
✅ Works well with concurrent updates
```

## Диаграмма системы приглашений

```
┌────────────────────────────────────────────────────────────────┐
│                    Invitation System Flow                       │
└────────────────────────────────────────────────────────────────┘

Phase 1: Send Invitation
────────────────────────

Project Owner
     │
     ├─ Opens Project Members Modal
     │
     ├─ Clicks "Invite User"
     │
     ├─ Enters: email, role
     │
     └─> POST /api/projects/:projectId/invitations
              │
              ├─ Check: Owner or Collaborator?
              │
              ├─ Check: User already member?
              │
              ├─ Check: Pending invitation exists?
              │
              ├─ Generate unique token
              │   token = crypto.randomBytes(32).toString('hex')
              │
              ├─ Set expiration (7 days)
              │   expiresAt = now + 7 days
              │
              ├─ Save to database:
              │   Prisma.invitation.create({
              │     email, role, token,
              │     status: 'pending',
              │     projectId, invitedByUserId
              │   })
              │
              └─> Send email via Nodemailer
                    │
                    └─ Email body:
                       Subject: Invitation to project
                       Link: https://app.com/invite/{token}


Phase 2: Accept Invitation
───────────────────────────

User clicks email link
     │
     └─> GET /invite/:token
              │
              ├─ Parse token from URL
              │
              └─> GET /api/invitations/:token
                       │
                       ├─ Fetch invitation details
                       ├─ Check: token valid?
                       ├─ Check: not expired?
                       ├─ Check: status = 'pending'?
                       │
                       └─ Display:
                          • Project name
                          • Inviter name
                          • Role
                          • Accept/Decline buttons

User clicks "Accept"
     │
     └─> POST /api/invitations/:token/accept
              │
              ├─ Check: user authenticated?
              │  (if not, redirect to login)
              │
              ├─ Check: invitation valid?
              │
              ├─ Check: user not already member?
              │
              ├─ Transaction:
              │  ├─ Create ProjectMember
              │  │  Prisma.projectMember.create({
              │  │    userId, projectId, role
              │  │  })
              │  │
              │  └─ Update Invitation
              │     Prisma.invitation.update({
              │       status: 'accepted',
              │       acceptedAt: now
              │     })
              │
              └─> Redirect to project


Phase 3: Manage Invitations
────────────────────────────

Project Owner
     │
     └─> View pending invitations
              │
              ├─ GET /api/projects/:projectId/invitations
              │  (returns list of pending invitations)
              │
              └─ Actions:
                 ├─ Resend email
                 └─ Revoke invitation
                    DELETE /api/invitations/:id
                    (sets status = 'revoked')


Invitation Lifecycle:
─────────────────────

  pending → accepted   (user accepts)
     ↓
  expired             (7 days passed)
     ↓
  revoked             (owner cancels)
```

## Диаграмма загрузки файлов

```
┌────────────────────────────────────────────────────────────────┐
│                    File Upload System                           │
└────────────────────────────────────────────────────────────────┘

User uploads file
     │
     └─> TaskModal → File input
              │
              ├─ Select file from disk
              │
              └─> POST /api/tasks/:taskId/attachments
                   Content-Type: multipart/form-data
                        │
                        ▼
                   Multer middleware
                        │
                        ├─ Validate:
                        │  • File size < 50MB
                        │  • MIME type allowed
                        │
                        ├─ Generate unique filename:
                        │  {timestamp}-{random}-{original}
                        │  Example: 1699876543210-487625-document.pdf
                        │
                        ├─ Save to disk:
                        │  ./uploads/{filename}
                        │
                        └─ req.file available
                             │
                             ▼
                   Create Attachment record:
                   Prisma.attachment.create({
                     name: originalFilename,
                     url: `/uploads/${filename}`,
                     size: fileSize,
                     mimeType: fileMimeType,
                     taskId: taskId
                   })
                             │
                             ▼
                   Response: Attachment object
                             │
                             ▼
                   Update task in context
                             │
                             ▼
                   Display in task modal


File Access:
────────────

Browser requests file
     │
     └─> GET /uploads/{filename}
              │
              └─> Express static middleware
                   express.static('./uploads')
                        │
                        └─> Stream file to browser


File Deletion:
──────────────

User clicks delete attachment
     │
     └─> DELETE /api/tasks/:taskId/attachments/:attachmentId
              │
              ├─ Check permissions: canEditTask()
              │
              ├─ Get attachment details
              │  attachment = Prisma.attachment.findUnique()
              │
              ├─ Delete from database
              │  Prisma.attachment.delete()
              │
              └─ Delete from disk
                 fs.unlinkSync(attachment.url)


Storage Structure:
──────────────────

./uploads/
├── 1699876543210-487625-document.pdf
├── 1699876544110-923841-image.png
├── 1699876545220-156732-report.docx
└── ...

Database (attachments table):
┌──────────────────────────────────────────────────────────────┐
│ id   │ name         │ url                        │ taskId    │
├──────┼──────────────┼────────────────────────────┼───────────┤
│ uuid │ document.pdf │ /uploads/169...625-doc.pdf │ task-uuid │
└──────┴──────────────┴────────────────────────────┴───────────┘
```

## Диаграмма состояния приложения

```
┌────────────────────────────────────────────────────────────────┐
│                     App State Management                        │
└────────────────────────────────────────────────────────────────┘

AppProvider Context:
────────────────────

┌─────────────────────────────────────────────────────────────┐
│                         AppContext                           │
├─────────────────────────────────────────────────────────────┤
│  State:                                                      │
│  ├─ tasks: Task[]                                           │
│  ├─ projects: Project[]                                     │
│  ├─ categories: Category[]                                  │
│  ├─ customColumns: CustomColumn[]                           │
│  ├─ loading: boolean                                        │
│  └─ error: Error | null                                     │
│                                                              │
│  Methods:                                                    │
│  ├─ refreshTasks()                                          │
│  ├─ refreshProjects()                                       │
│  ├─ refreshCategories()                                     │
│  ├─ createTask(task)                                        │
│  ├─ updateTask(id, updates)                                 │
│  ├─ deleteTask(id)                                          │
│  ├─ createProject(project)                                  │
│  ├─ updateProject(id, updates)                              │
│  └─ deleteProject(id)                                       │
└─────────────────────────────────────────────────────────────┘


Data Flow:
──────────

Component Mount
     │
     ▼
useContext(AppContext)
     │
     ├─> Read state (tasks, projects)
     │
     └─> Call methods (createTask, updateTask)
              │
              ▼
         Context updates state
              │
              ├─ Optimistic update (immediate)
              ├─ API call (background)
              └─ Reconcile on response
              │
              ▼
         All subscribed components re-render


Polling System:
───────────────

useEffect in AppProvider:

setInterval(() => {
  if (!isPolling) return;
  
  // Fetch fresh data
  const [tasks, projects] = await Promise.all([
    tasksAPI.getTasks(),
    projectsAPI.getProjects()
  ]);
  
  // Deep comparison
  if (areArraysDifferent(currentTasks, tasks)) {
    setState({ tasks }); // Update only if changed
  }
  
  if (areArraysDifferent(currentProjects, projects)) {
    setState({ projects });
  }
}, 5000); // Every 5 seconds


Optimistic Updates:
───────────────────

Example: Update task status

1. User action:
   dragTask(taskId, "in_progress")

2. Immediate UI update:
   setTasks(tasks.map(t => 
     t.id === taskId 
       ? { ...t, status: "in_progress" }
       : t
   ))

3. API call:
   tasksAPI.updateTask(taskId, { status: "in_progress" })
     .then(updatedTask => {
       // Success: replace with server version
       setTasks(tasks.map(t => 
         t.id === taskId ? updatedTask : t
       ))
     })
     .catch(error => {
       // Error: rollback
       setTasks(originalTasks)
       toast.error("Failed to update task")
     })

4. Polling sync (5s later):
   Ensures consistency with server
```

## Резюме архитектурных решений

### ✅ Сильные стороны

1. **Четкое разделение слоев**
   - Presentation (React Components)
   - State Management (Context API)
   - API Client (Fetch wrapper)
   - Backend API (Express routes)
   - Business Logic (lib/)
   - Data Access (Prisma ORM)

2. **Безопасность**
   - JWT аутентификация с 7-дневным сроком
   - RBAC на уровне БД и API
   - Bcrypt для паролей (10 раундов)
   - Middleware цепочки для защиты endpoints

3. **Производительность**
   - Оптимистичные обновления
   - Лексикографическая сортировка (O(1) вставка)
   - Polling с умными сравнениями
   - Индексы БД на частых запросах

4. **UX**
   - Drag-and-drop с HTML5 Backend
   - Мгновенная обратная связь
   - Современный UI (Radix + Tailwind)
   - Адаптивный дизайн

### ⚠️ Области улучшения

1. **Реалтайм обновления**
   - Заменить polling на WebSocket
   - Использовать Socket.io или native WebSocket

2. **Масштабируемость**
   - Добавить пагинацию для больших списков
   - Виртуализация списков (react-window)
   - Ленивая загрузка данных

3. **Тестирование**
   - Unit тесты (Jest)
   - Integration тесты (Supertest)
   - E2E тесты (Playwright)

4. **Обработка ошибок**
   - Централизованный error handler
   - Retry логика для сетевых ошибок
   - Детальные сообщения пользователю

5. **Мониторинг**
   - Логирование (Winston/Pino)
   - Метрики производительности
   - Error tracking (Sentry)
