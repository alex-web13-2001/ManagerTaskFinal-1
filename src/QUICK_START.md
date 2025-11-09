# 🚀 Quick Start Guide

Get the Task Manager application running locally in 5 minutes!

---

## ⚡ 5 Quick Steps

### 1️⃣ Prerequisites

Make sure you have installed:
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop)

### 2️⃣ Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd Managertaskfin1

# Install dependencies
npm install
```

### 3️⃣ Setup Database

```bash
# Copy environment variables
cp .env.example .env

# Start PostgreSQL in Docker
npm run docker:up

# Setup database (generate client, run migrations, seed data)
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

This will create an admin user:
- **Email**: admin@example.com
- **Password**: admin123

### 4️⃣ Start the Application

```bash
# Start both frontend and backend
npm run dev:all
```

Or start them separately in different terminals:

```bash
# Terminal 1 - Backend API
npm run dev:server

# Terminal 2 - Frontend
npm run dev
```

### 5️⃣ Open and Login

1. Open your browser to **http://localhost:5173**
2. Click "Sign In"
3. Use the admin credentials:
   - Email: `admin@example.com`
   - Password: `admin123`

🎉 **You're ready to go!**

---

## 📝 What You Can Do

After logging in, you can:

✅ Create new projects
✅ Add tasks to projects
✅ Organize tasks in Kanban view
✅ View tasks in table format
✅ Upload attachments to tasks
✅ Update your profile and avatar
✅ Manage project members
✅ Create custom task columns

---

## 🛠️ Useful Commands

### Development

```bash
npm run dev              # Start frontend only
npm run dev:server       # Start backend only
npm run dev:all          # Start both frontend and backend
npm run build            # Build frontend for production
```

### Database

```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Create/apply migrations
npm run prisma:seed      # Seed database with admin user
npx prisma studio        # Open database GUI
```

### Docker

```bash
npm run docker:up        # Start PostgreSQL
npm run docker:down      # Stop PostgreSQL
docker ps                # Check running containers
```

---

## 🔍 Testing the Application

### Create Your First Task

1. **Create a Project**
   - Click "New Project" button
   - Enter project name and description
   - Choose a color
   - Click "Create"

2. **Add a Task**
   - Open your project
   - Click "Add Task"
   - Fill in task details
   - Set priority and status
   - Click "Create Task"

3. **Try Kanban View**
   - Switch to Kanban view
   - Drag and drop tasks between columns
   - Watch tasks update in real-time

4. **Upload an Attachment**
   - Open a task
   - Click "Add Attachment"
   - Select a file
   - See it appear in the task

---

## 📊 Application URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React application |
| Backend API | http://localhost:3001 | Express server |
| Health Check | http://localhost:3001/health | API status |
| Database GUI | Run `npx prisma studio` | Prisma Studio |

---

## 🐛 Common Issues

### Port 3001 is already in use

```bash
# Find and kill the process
lsof -i :3001
kill -9 <PID>
```

### Docker not starting

```bash
# Check Docker is running
docker ps

# Restart Docker Desktop and try again
npm run docker:down
npm run docker:up
```

### Database connection error

```bash
# Make sure Postgres is running
docker ps

# Check .env DATABASE_URL is correct
cat .env | grep DATABASE_URL

# Try restarting database
npm run docker:down
npm run docker:up
```

### Prisma errors

```bash
# Regenerate Prisma Client
rm -rf node_modules/.prisma
npm run prisma:generate

# Reset database if needed (CAUTION: Deletes all data)
npx prisma migrate reset
```

---

## 🔄 Stopping the Application

### Stop Development Servers

Press `Ctrl+C` in each terminal running a dev server

### Stop Database

```bash
npm run docker:down
```

### Cleanup Everything

```bash
# Stop Docker containers
npm run docker:down

# Remove Docker volumes (deletes database data)
docker-compose down -v

# Clean node_modules
rm -rf node_modules
rm -rf node_modules/.prisma
```

---

## 📚 Next Steps

- **Explore Features**: Try all the task management features
- **Read Docs**: Check out [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- **Customize**: Modify the code to fit your needs
- **Contribute**: Submit issues and pull requests

---

## 💡 Tips

### Using Different Credentials

Edit `.env` before running `npm run prisma:seed`:

```env
ADMIN_EMAIL="your-email@example.com"
ADMIN_PASSWORD="your-secure-password"
ADMIN_NAME="Your Name"
```

### Running on Different Ports

Edit `.env`:

```env
PORT=4000                          # Backend port
VITE_API_BASE_URL="http://localhost:4000"  # Tell frontend where backend is
```

Then restart the servers.

### Viewing Database

```bash
# Open Prisma Studio
npx prisma studio
```

This opens a web interface to browse your database at http://localhost:5555

---

## 🎯 Ready for Production?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete production deployment instructions including:

- Production server setup
- Nginx configuration  
- SSL certificates
- PM2 process management
- Database backups
- Monitoring

---

**Happy Task Managing! 🚀**
