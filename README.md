# Task Manager Application

A modern task management application with Kanban boards, project management, and real-time updates.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- npm or yarn

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Managertaskfin1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your settings (defaults work for local development)
   ```

4. **Start Postgres database**
   ```bash
   npm run docker:up
   ```

5. **Generate Prisma client and run migrations**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

6. **Seed the database**
   ```bash
   npm run prisma:seed
   ```
   This creates an admin user with credentials from your .env file (default: admin@example.com / admin123)

7. **Start the development servers**
   ```bash
   # Option 1: Start both frontend and backend together
   npm run dev:all
   
   # Option 2: Start them separately in different terminals
   npm run dev:server  # Backend API on http://localhost:3001
   npm run dev          # Frontend on http://localhost:5173
   ```

8. **Open your browser**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### Default Admin Credentials

- **Email**: admin@example.com
- **Password**: admin123

(Configure these in .env file before running seed)

## 📁 Project Structure

```
.
├── prisma/              # Database schema and migrations
│   ├── schema.prisma    # Prisma schema
│   └── seed.ts          # Database seeding script
├── src/
│   ├── server/          # Backend Express API
│   │   ├── index.ts     # Main server file
│   │   └── kv_store.ts  # KV store implementation
│   ├── lib/             # Shared libraries
│   │   ├── prisma.ts    # Prisma client
│   │   └── auth.ts      # JWT authentication
│   ├── utils/           # Frontend utilities
│   │   └── api-client.tsx  # API client for frontend
│   ├── components/      # React components
│   └── ...
├── uploads/             # File uploads directory
├── docker-compose.yml   # Docker setup for Postgres
└── package.json
```

## 🔧 Available Scripts

- `npm run dev` - Start frontend development server
- `npm run dev:server` - Start backend API server
- `npm run dev:all` - Start both frontend and backend
- `npm run build` - Build frontend for production
- `npm run docker:up` - Start Postgres in Docker
- `npm run docker:down` - Stop Docker services
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database with initial data

## 📚 Documentation

- [Deployment Guide](src/DEPLOYMENT.md) - Complete deployment instructions
- [Quick Start Guide](src/QUICK_START.md) - Quick setup instructions

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication (7 day expiry)
- Protected API endpoints require valid JWT token
- Files stored locally in uploads/ directory

## 🛠️ Technology Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI components

**Backend:**
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- Multer for file uploads

## 📝 License

See [LICENSE](src/LICENSE) for details.
