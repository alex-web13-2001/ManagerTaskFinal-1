# Анализ структуры кода Task Manager Application

## Общий обзор

Task Manager - это современное веб-приложение для управления задачами с Kanban-досками, управлением проектами и обновлениями в реальном времени.

## Архитектура приложения

### Стек технологий

#### Frontend
- **React 18** - основная библиотека UI
- **TypeScript** - типизация кода
- **Vite 6.3.5** - инструмент сборки и dev-сервер
- **Tailwind CSS** - утилитарные CSS-классы
- **Radix UI** - компоненты UI с доступностью
- **React DnD** - drag-and-drop функциональность
- **Framer Motion** - анимации

#### Backend
- **Node.js + Express 4.18.2** - веб-сервер
- **TypeScript** - типизация серверного кода
- **Prisma 6.19.0** - ORM для работы с БД
- **PostgreSQL** - реляционная база данных
- **JWT (jsonwebtoken 9.0.2)** - аутентификация
- **bcryptjs 2.4.3** - хеширование паролей
- **Multer** - загрузка файлов
- **Nodemailer 6.9.7** - отправка email

## Структура проекта

```
ManagerTaskFinal-1/
├── prisma/                      # База данных и миграции
│   ├── schema.prisma           # Схема БД
│   └── seed.ts                 # Скрипт для заполнения БД
├── src/
│   ├── server/                 # Backend (Express API)
│   │   ├── index.ts           # Главный файл сервера
│   │   ├── routes/            # API маршруты
│   │   │   └── invitations.ts
│   │   ├── types.ts           # TypeScript типы
│   │   └── kv_store.ts        # Key-Value хранилище
│   ├── lib/                    # Общие библиотеки
│   │   ├── prisma.ts          # Клиент Prisma
│   │   ├── auth.ts            # JWT аутентификация
│   │   ├── permissions.ts     # RBAC система
│   │   ├── email.ts           # Email сервис
│   │   ├── invitations.ts     # Логика приглашений
│   │   └── migrate.ts         # Миграции
│   ├── components/             # React компоненты
│   │   ├── ui/                # Базовые UI компоненты
│   │   ├── auth-screen.tsx    # Экран входа/регистрации
│   │   ├── dashboard-view.tsx # Главная панель
│   │   ├── projects-view.tsx  # Список проектов
│   │   ├── tasks-view.tsx     # Список задач
│   │   ├── kanban-board.tsx   # Kanban доска
│   │   ├── task-modal.tsx     # Модальное окно задачи
│   │   └── ...                # Другие компоненты
│   ├── contexts/               # React контексты
│   │   └── app-context.tsx    # Глобальное состояние
│   ├── hooks/                  # Custom React hooks
│   │   └── useKanbanDnD.ts    # Hook для drag-and-drop
│   ├── utils/                  # Утилиты
│   │   ├── api-client.tsx     # API клиент
│   │   ├── orderKey.ts        # Сортировка задач
│   │   └── supabase/          # Legacy Supabase код
│   ├── styles/                 # Стили
│   │   └── globals.css        # Глобальные стили
│   ├── App.tsx                 # Главный компонент приложения
│   └── main.tsx                # Точка входа
├── uploads/                     # Загруженные файлы
├── docker-compose.yml           # Docker для PostgreSQL
├── package.json                 # Зависимости и скрипты
├── tsconfig.json                # TypeScript конфигурация
├── vite.config.ts               # Vite конфигурация
└── README.md                    # Документация

```

## Модель данных (Prisma Schema)

### Основные модели

#### 1. User (Пользователь)
```prisma
model User {
  id                     String    @id @default(uuid())
  email                  String    @unique
  password               String    // bcrypt хеш
  name                   String
  avatarUrl              String?
  emailVerified          Boolean   @default(false)
  emailVerificationToken String?
  resetPasswordToken     String?
  resetPasswordExpires   DateTime?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
  
  // Связи
  ownedProjects          Project[] @relation("ProjectOwner")
  projectMemberships     ProjectMember[]
  createdTasks           Task[]    @relation("TaskCreator")
  assignedTasks          Task[]    @relation("TaskAssignee")
  receivedInvitations    Invitation[]
}
```

**Назначение**: Хранение данных пользователей с аутентификацией

**Ключевые поля**:
- `password` - хеш bcrypt пароля
- `avatarUrl` - URL изображения профиля
- `emailVerified` - флаг подтверждения email

#### 2. Project (Проект)
```prisma
model Project {
  id          String    @id @default(uuid())
  name        String
  description String?
  color       String    @default("#3b82f6")
  icon        String?
  archived    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Связи
  ownerId     String
  owner       User      @relation("ProjectOwner")
  members     ProjectMember[]
  tasks       Task[]
  invitations Invitation[]
}
```

**Назначение**: Контейнер для группировки задач и управления доступом

**Ключевые особенности**:
- Поддержка архивирования
- Настройка цвета и иконки
- Владелец проекта + участники

#### 3. ProjectMember (Участник проекта)
```prisma
model ProjectMember {
  id        String   @id @default(uuid())
  role      String   // 'owner', 'collaborator', 'member', 'viewer'
  addedAt   DateTime @default(now())
  
  userId    String
  user      User
  projectId String
  project   Project
  
  @@unique([userId, projectId])
}
```

**Назначение**: Реализация RBAC (Role-Based Access Control)

**Роли**:
- `owner` - полный доступ, удаление проекта
- `collaborator` - редактирование проекта и задач
- `member` - создание и редактирование своих задач
- `viewer` - только чтение

#### 4. Task (Задача)
```prisma
model Task {
  id          String    @id @default(uuid())
  title       String
  description String?
  status      String    @default("todo") // 'todo', 'in_progress', 'done'
  priority    String    @default("medium") // 'low', 'medium', 'high'
  category    String?
  tags        String[]  @default([])
  dueDate     DateTime?
  orderKey    String?   @default("n") // Лексикографический ключ для сортировки
  version     Int       @default(1) // Для оптимистичной конкурентности
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  projectId   String?
  project     Project?
  creatorId   String
  creator     User
  assigneeId  String?
  assignee    User?
  attachments Attachment[]
}
```

**Назначение**: Основная сущность - задача

**Ключевые особенности**:
- `orderKey` - лексикографическая сортировка без переиндексации
- `version` - оптимистичная конкурентность
- Может быть личной (без `projectId`) или проектной
- Поддержка тегов, приоритетов, категорий

#### 5. Attachment (Вложение)
```prisma
model Attachment {
  id        String   @id @default(uuid())
  name      String   // Имя файла
  url       String   // Путь к файлу
  size      Int      // Размер в байтах
  mimeType  String   // MIME тип
  createdAt DateTime @default(now())
  
  taskId    String
  task      Task
}
```

**Назначение**: Хранение метаданных файлов, прикрепленных к задачам

#### 6. Invitation (Приглашение)
```prisma
model Invitation {
  id               String    @id @default(uuid())
  email            String
  role             String    // 'collaborator', 'member', 'viewer'
  token            String    @unique
  status           String    @default("pending") // 'pending', 'accepted', 'expired', 'revoked'
  expiresAt        DateTime
  createdAt        DateTime  @default(now())
  acceptedAt       DateTime?
  
  projectId        String
  project          Project
  invitedByUserId  String?
  invitedByUser    User?
}
```

**Назначение**: Приглашение пользователей в проекты по email

#### 7. KvStore (Key-Value хранилище)
```prisma
model KvStore {
  key       String   @id
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Назначение**: Простое хранилище для настроек приложения (замена Supabase KV)

## Backend архитектура

### Структура сервера (src/server/index.ts)

Основные компоненты:

#### 1. Middleware
```typescript
- cors() - Cross-Origin Resource Sharing
- express.json() - Парсинг JSON
- express.urlencoded() - Парсинг URL-encoded данных
- authenticate() - JWT верификация
- canAccessProject() - Проверка доступа к проекту
```

#### 2. Аутентификация (src/lib/auth.ts)

```typescript
// Основные функции
- hashPassword(password: string): Promise<string>
- comparePassword(password: string, hash: string): Promise<boolean>
- generateToken(userId: string, email: string): string
- verifyToken(token: string): JwtPayload

// JWT Payload
interface JwtPayload {
  sub: string;      // user id
  email: string;
  iat?: number;
  exp?: number;
}
```

**Срок жизни токена**: 7 дней

#### 3. Система разрешений (src/lib/permissions.ts)

```typescript
type UserRole = 'owner' | 'collaborator' | 'member' | 'viewer';

// Основные функции
- getUserRoleInProject(userId, projectId): Promise<UserRole | null>
- canViewProject(userId, projectId): Promise<boolean>
- canEditProject(userId, projectId): Promise<boolean>
- canDeleteProject(userId, projectId): Promise<boolean>
- canCreateTask(userId, projectId): Promise<boolean>
- canEditTask(userId, taskId): Promise<boolean>
- canDeleteTask(userId, taskId): Promise<boolean>
```

**Матрица разрешений**:

| Действие | Owner | Collaborator | Member | Viewer |
|----------|-------|--------------|---------|--------|
| Просмотр проекта | ✅ | ✅ | ✅ | ✅ |
| Редактирование проекта | ✅ | ✅ | ❌ | ❌ |
| Удаление проекта | ✅ | ❌ | ❌ | ❌ |
| Архивирование проекта | ✅ | ❌ | ❌ | ❌ |
| Создание задач | ✅ | ✅ | ✅ | ❌ |
| Редактирование своих задач | ✅ | ✅ | ✅ | ❌ |
| Редактирование чужих задач | ✅ | ✅ | ❌ | ❌ |
| Удаление задач | ✅ | ✅ | (свои) | ❌ |

#### 4. API Endpoints

**Аутентификация**:
- `POST /api/auth/signup` - Регистрация
- `POST /api/auth/signin` - Вход
- `POST /api/auth/signout` - Выход
- `GET /api/auth/me` - Текущий пользователь

**Проекты**:
- `GET /api/projects` - Список проектов
- `POST /api/projects` - Создание проекта
- `GET /api/projects/:id` - Детали проекта
- `PUT /api/projects/:id` - Обновление проекта
- `DELETE /api/projects/:id` - Удаление проекта
- `PATCH /api/projects/:id/archive` - Архивирование

**Задачи**:
- `GET /api/tasks` - Список задач
- `POST /api/tasks` - Создание задачи
- `GET /api/tasks/:id` - Детали задачи
- `PUT /api/tasks/:id` - Обновление задачи
- `DELETE /api/tasks/:id` - Удаление задачи
- `POST /api/tasks/:id/attachments` - Загрузка вложения
- `DELETE /api/tasks/:taskId/attachments/:attachmentId` - Удаление вложения

**Участники проекта**:
- `GET /api/projects/:projectId/members` - Список участников
- `POST /api/projects/:projectId/members` - Добавление участника
- `DELETE /api/projects/:projectId/members/:memberId` - Удаление участника
- `PATCH /api/projects/:projectId/members/:memberId/role` - Изменение роли

**Приглашения**:
- `POST /api/projects/:projectId/invitations` - Отправка приглашения
- `GET /api/invitations/:token` - Получение приглашения по токену
- `POST /api/invitations/:token/accept` - Принятие приглашения
- `DELETE /api/invitations/:id` - Отмена приглашения

#### 5. Загрузка файлов

**Конфигурация Multer**:
```typescript
- Директория: ./uploads/
- Максимальный размер: 50MB
- Именование: timestamp-random-originalname
```

**Хранение**:
- Файлы хранятся локально в папке `uploads/`
- Метаданные в БД (таблица `Attachment`)
- Публичный доступ через `/uploads/` endpoint

## Frontend архитектура

### Главный компонент (App.tsx)

**Основные состояния**:
```typescript
- isAuthenticated: boolean      // Статус аутентификации
- currentView: View             // Текущая страница
- isCreateTaskOpen: boolean     // Модальное окно создания задачи
- currentProject: string        // Текущий проект
- selectedProjectId: string     // Выбранный проект
```

**Виды (Views)**:
- `dashboard` - Главная панель
- `dashboard-calendar` - Календарь дашборда
- `tasks` - Список всех задач
- `projects` - Список проектов
- `project-calendar` - Календарь проекта
- `categories` - Категории
- `archive` - Архив
- `profile` - Профиль
- `invite` - Страница принятия приглашения

### Контекст приложения (app-context.tsx)

**Глобальное состояние**:
```typescript
interface AppContextType {
  tasks: Task[];
  projects: Project[];
  categories: Category[];
  customColumns: CustomColumn[];
  loading: boolean;
  error: Error | null;
  
  // Методы для обновления данных
  refreshTasks: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  // ...
}
```

**Функции**:
- Централизованное управление состоянием
- Автоматическое обновление данных (polling)
- Кеширование и оптимизация запросов
- Обработка ошибок

### API клиент (utils/api-client.tsx)

**Управление токенами**:
```typescript
- getAuthToken(): string | null
- setAuthToken(token: string): void
- clearAuthToken(): void
- getUserIdFromToken(): string | null
```

**API объекты**:
```typescript
- authAPI: { signIn, signUp, signOut, getCurrentUser, onAuthStateChange }
- tasksAPI: { getTasks, createTask, updateTask, deleteTask, ... }
- projectsAPI: { getProjects, createProject, updateProject, ... }
- teamAPI: { getMembers, addMember, removeMember, ... }
- categoriesAPI: { getCategories, createCategory, ... }
```

### Ключевые компоненты

#### 1. Kanban Board (kanban-board.tsx)

**Функциональность**:
- Drag-and-drop задач между колонками
- Лексикографическая сортировка (orderKey)
- Оптимистичное обновление UI
- Реалтайм синхронизация

**Технологии**:
- React DnD (HTML5 Backend)
- Custom hook `useKanbanDnD`

#### 2. Task Modal (task-modal.tsx)

**Режимы**:
- `create` - Создание новой задачи
- `edit` - Редактирование существующей задачи

**Функциональность**:
- Форма с валидацией
- Выбор проекта, приоритета, статуса
- Загрузка вложений
- Назначение исполнителя

#### 3. Project Detail View (project-detail-view.tsx)

**Секции**:
- Kanban доска задач проекта
- Календарь проекта
- Список участников
- Настройки проекта

#### 4. Auth Screen (auth-screen.tsx)

**Функциональность**:
- Вход/регистрация
- Валидация email и пароля
- Обработка ошибок

### Система сортировки задач (orderKey.ts)

**Алгоритм лексикографической сортировки**:

```typescript
// Генерация ключа между двумя позициями
function generateOrderKey(
  beforeKey: string | null,
  afterKey: string | null
): string

// Примеры:
// Между null и "n": "g"
// Между "g" и "n": "k"
// Между "k" и "n": "l"
```

**Преимущества**:
- Не требует переиндексации всех записей
- Поддержка вставки в любую позицию
- Эффективно для Drag-and-Drop

### Drag-and-Drop система (useKanbanDnD.ts)

**Hook управления DnD**:
```typescript
function useKanbanDnD(
  tasks: Task[],
  onTaskMove: (taskId: string, newStatus: string, newOrderKey: string) => void
)
```

**Функции**:
- Отслеживание перетаскивания
- Расчет новой позиции (orderKey)
- Оптимистичное обновление
- Откат при ошибке

## Система безопасности

### 1. Аутентификация

**JWT токены**:
- Срок действия: 7 дней
- Хранение: localStorage
- Передача: Authorization header (`Bearer <token>`)
- Верификация: на каждом защищенном endpoint

### 2. Авторизация (RBAC)

**Проверки на уровне сервера**:
```typescript
// Middleware цепочка для защищенных endpoints
authenticate -> canAccessProject -> endpoint handler
```

**Проверки на уровне клиента**:
```typescript
// Компоненты проверяют права перед отображением UI
if (canEdit) {
  return <EditButton />
}
```

### 3. Валидация данных

**Backend**:
- Валидация входных данных
- Проверка принадлежности ресурсов
- Очистка пользовательского ввода

**Frontend**:
- Валидация форм (react-hook-form)
- Проверка типов (TypeScript)

### 4. Защита паролей

```typescript
// Хеширование bcrypt с солью (10 раундов)
const hash = await bcrypt.hash(password, 10);

// Сравнение без утечки времени
const isValid = await bcrypt.compare(password, hash);
```

## Производительность и оптимизация

### 1. Polling система

**Автоматическое обновление данных**:
```typescript
// В app-context.tsx
useEffect(() => {
  const interval = setInterval(() => {
    refreshTasks();
    refreshProjects();
  }, 5000); // Каждые 5 секунд
  
  return () => clearInterval(interval);
}, []);
```

### 2. Оптимистичные обновления

**Паттерн**:
1. Немедленное обновление UI
2. Отправка запроса на сервер
3. Откат при ошибке
4. Синхронизация с сервером

### 3. Кеширование

**React Query паттерн** (частично реализован):
- Кеш в контексте приложения
- Инвалидация кеша при изменениях
- Предотвращение дублирующих запросов

### 4. Ленивая загрузка

**Code splitting**:
- Vite автоматически разделяет код
- Динамические импорты для больших компонентов

## Потоки данных

### 1. Создание задачи

```
User -> TaskModal (UI)
  -> tasksAPI.createTask()
  -> POST /api/tasks (Backend)
  -> Prisma.task.create()
  -> Response
  -> Update Context State
  -> Re-render Kanban
```

### 2. Перетаскивание задачи

```
User drags task
  -> useKanbanDnD hook
  -> Calculate new orderKey
  -> Optimistic UI update
  -> tasksAPI.updateTask()
  -> PUT /api/tasks/:id
  -> Prisma.task.update()
  -> Polling sync (5 sec)
```

### 3. Приглашение в проект

```
Owner -> Invite User (UI)
  -> POST /api/projects/:id/invitations
  -> Create Invitation record
  -> Send email (Nodemailer)
  -> User clicks link
  -> GET /api/invitations/:token
  -> Display invitation details
  -> POST /api/invitations/:token/accept
  -> Create ProjectMember
  -> Update Invitation status
```

## Проблемы и технический долг

### 1. Legacy код Supabase

**Проблема**: Остались файлы и импорты из предыдущей версии с Supabase
**Расположение**: `src/utils/supabase/`
**Решение**: Постепенная миграция на новый API клиент

### 2. Polling вместо WebSocket

**Проблема**: Обновления через polling каждые 5 секунд
**Недостаток**: Задержка + лишние запросы
**Решение**: Внедрить WebSocket для реалтайм обновлений

### 3. Отсутствие тестов

**Проблема**: Нет unit/integration тестов
**Риск**: Сложно рефакторить без регрессий
**Решение**: Добавить Jest + React Testing Library

### 4. Обработка ошибок

**Проблема**: Неполная обработка ошибок сети
**Проявление**: Пользователь не всегда видит причину ошибки
**Решение**: Централизованная обработка с понятными сообщениями

### 5. Масштабируемость

**Проблема**: Загрузка всех задач/проектов сразу
**Ограничение**: Замедление при большом количестве данных
**Решение**: Пагинация + виртуализация списков

## Развертывание

### Локальная разработка

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск PostgreSQL
npm run docker:up

# 3. Миграции БД
npm run prisma:generate
npm run prisma:migrate

# 4. Заполнение тестовыми данными
npm run prisma:seed

# 5. Запуск dev серверов
npm run dev:all
```

### Продакшн

**Требования**:
- Node.js 18+
- PostgreSQL 14+
- Nginx (reverse proxy)
- PM2 (process manager)

**Переменные окружения**:
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="your-secret-key"
PORT=3001
VITE_API_BASE_URL="https://api.example.com"
```

## Заключение

Task Manager - это полнофункциональное приложение для управления задачами с современным стеком технологий. Основные сильные стороны:

✅ **Современные технологии**: React 18, TypeScript, Prisma, Vite
✅ **Безопасность**: JWT аутентификация, RBAC, bcrypt
✅ **UX**: Drag-and-drop, оптимистичные обновления, реалтайм
✅ **Архитектура**: Четкое разделение frontend/backend, модульная структура

Области для улучшения:

⚠️ Добавить WebSocket для реалтайм обновлений
⚠️ Внедрить автоматизированное тестирование
⚠️ Улучшить обработку ошибок
⚠️ Оптимизировать производительность для больших наборов данных
⚠️ Завершить миграцию от Supabase

Общая оценка кода: **Хорошо структурированный, готовый к продакшну проект с некоторыми возможностями для оптимизации.**
