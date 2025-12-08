import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { createServer } from 'http';
import prisma from './db';
import { hashPassword, comparePassword, generateToken } from '../lib/auth';
import emailService from '../lib/email';
import invitationRoutes from './routes/invitations.js';
import { 
  getUserRoleInProject as getUserRoleInProjectFromDB,
  canEditTask as canEditTaskFromDB,
  canDeleteTask as canDeleteTaskFromDB,
  canViewTask as canViewTaskFromDB,
  canCreateTask as canCreateTaskFromDB
} from '../lib/permissions';
import { authenticate, canAccessProject, AuthRequest, UserRole } from './middleware/auth.js';
import { webhookHandler } from './handlers/webhookHandler.js';
import { createProject } from './handlers/projectHandlers.js';
import { authRateLimiter, uploadRateLimiter, passwordResetRateLimiter } from './middleware/rateLimiter.js';
import { 
  initializeWebSocket, 
  emitTaskCreated, 
  emitTaskUpdated, 
  emitTaskDeleted,
  emitTaskMoved,
  emitInviteReceived,
  emitInviteAccepted,
  emitInviteRejected,
  emitProjectUpdated,
  emitProjectMemberAdded,
  emitProjectMemberRemoved,
  emitCommentAdded,
  emitUserSettingsUpdated
} from './websocket.js';
import { startRecurringTaskProcessor } from './recurringTaskProcessor.js';
import { 
  initializeTelegramBot, 
  sendTaskAssignedNotification,
  sendTaskCommentNotification,
  sendDailyTasksDigest
} from './telegram-bot.js';
import cron from 'node-cron';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS must be the first middleware to ensure headers are set for all responses
app.use(cors());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
// FIX Problem #3: Handle Cyrillic filenames properly
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Decode filename to handle Cyrillic characters properly
    // Express/multer uses latin1 encoding by default, so we need to convert
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // Generate unique prefix to avoid filename collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    
    // Combine unique prefix with decoded original filename
    cb(null, uniqueSuffix + '-' + decodedName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * Generate full file URL with API base URL
 * Supports both local development and production
 */
function getFullFileUrl(relativePath: string): string {
  const API_BASE_URL = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3001';
  // Remove leading slash if present
  const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  return `${API_BASE_URL}/${cleanPath}`;
}

// ========== PERMISSION HELPERS ==========
// Auth middleware moved to ./middleware/auth.ts

/**
 * Get user's role in a project
 * Uses Prisma to query database directly as single source of truth
 */
async function getUserRoleInProject(userId: string, projectId: string): Promise<UserRole> {
  return await getUserRoleInProjectFromDB(userId, projectId);
}

/**
 * Check if user can edit task
 */
/**
 * Check if user can edit task
 */
async function canEditTask(userId: string, task: any): Promise<boolean> {
  // Personal tasks - only owner can edit
  if (!task.projectId) {
    const creatorId = task.creatorId || task.userId;
    return creatorId === userId;
  }
  
  const role = await getUserRoleInProject(userId, task.projectId);
  
  // Owner and Collaborator can edit any task
  if (role === 'owner' || role === 'collaborator') {
    return true;
  }
  
  // Member can edit if assigned or created
  if (role === 'member') {
    const creatorId = task.creatorId || task.userId;
    return creatorId === userId || task.assigneeId === userId;
  }
  
  // Viewer cannot edit
  return false;
}

/**
 * Check if user can delete task
 */
async function canDeleteTask(userId: string, task: any): Promise<boolean> {
  // Personal tasks - only owner can delete
  if (!task.projectId) {
    const creatorId = task.creatorId || task.userId;
    return creatorId === userId;
  }
  
  const role = await getUserRoleInProject(userId, task.projectId);
  
  // Owner and Collaborator can delete any task
  if (role === 'owner' || role === 'collaborator') {
    return true;
  }
  
  // Member cannot delete tasks
  if (role === 'member') {
    return false;
  }
  
  // Viewer cannot delete
  return false;
}

/**
 * Check if user can view task
 */
async function canViewTask(userId: string, task: any): Promise<boolean> {
  // Personal tasks - only owner can view
  if (!task.projectId) {
    const creatorId = task.creatorId || task.userId;
    return creatorId === userId;
  }
  
  const role = await getUserRoleInProject(userId, task.projectId);
  
  if (!role) {
    return false;
  }
  
  // Member can only view their own tasks (created or assigned)
  if (role === 'member') {
    const creatorId = task.creatorId || task.userId;
    return creatorId === userId || task.assigneeId === userId;
  }
  
  // All other roles can view all tasks in projects they're part of
  return true;
}

/**
 * Handle Prisma errors and return appropriate HTTP responses
 * P2002 - Unique constraint failed
 * P2025 - Record not found
 */
function handlePrismaError(error: any, res: Response, defaultMessage: string) {
  if (error.code === 'P2002') {
    // Unique constraint violation
    const field = error.meta?.target?.[0] || 'field';
    return res.status(409).json({ 
      error: `${field} already exists`, 
      code: 'CONFLICT' 
    });
  } else if (error.code === 'P2025') {
    // Record not found
    return res.status(404).json({ 
      error: 'Record not found', 
      code: 'NOT_FOUND' 
    });
  }
  
  // Default error
  return res.status(500).json({ error: defaultMessage });
}

/**
 * Transform project from database format to API response format
 * Maps field names for frontend compatibility (e.g., ownerId -> userId)
 * Ensures all nested arrays are present even if empty
 */
function transformProjectForResponse(project: any): any {
  return {
    ...project,
    // Map ownerId to userId for frontend compatibility
    userId: project.ownerId,
    // Format date fields as ISO strings
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
    updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
    archivedAt: project.archivedAt ? (project.archivedAt instanceof Date ? project.archivedAt.toISOString() : project.archivedAt) : undefined,
    // Ensure categoriesDetails is always an array (even if empty)
    categoriesDetails: project.categoriesDetails || [],
    // Ensure members is always an array (even if empty)
    members: project.members || [],
    // Ensure links is always an array (even if empty)
    links: Array.isArray(project.links) ? project.links : [],
    // Ensure attachments is always an array (even if empty)
    attachments: Array.isArray(project.attachments) ? project.attachments : [],
  };
}

/**
 * Transform task from database format to API response format
 * Maps field names for frontend compatibility (e.g., dueDate -> deadline, category -> categoryId)
 * Ensures all nested arrays are present even if empty
 */
function transformTaskForResponse(task: any): any {
  return {
    ...task,
    // Map creatorId to userId for frontend compatibility
    userId: task.creatorId,
    // Map dueDate to deadline for frontend compatibility
    deadline: task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate) : undefined,
    // Map category to categoryId for frontend compatibility
    categoryId: task.category,
    // Format date fields as ISO strings
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
    lastCompleted: task.lastCompleted ? (task.lastCompleted instanceof Date ? task.lastCompleted.toISOString() : task.lastCompleted) : undefined,
    // Ensure tags is always an array (even if empty)
    tags: Array.isArray(task.tags) ? task.tags : [],
    // Ensure attachments is always an array (even if empty)
    attachments: task.attachments ? task.attachments.map((att: any) => ({
      id: att.id,
      name: att.name,
      url: att.url,
      size: att.size,
      mimeType: att.mimeType,
      createdAt: att.createdAt instanceof Date ? att.createdAt.toISOString() : att.createdAt,
    })) : [],
    // Ensure comments is always an array (even if empty)
    comments: task.comments ? task.comments.map((comment: any) => ({
      id: comment.id,
      text: comment.text,
      createdBy: comment.createdBy,
      createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt,
      user: comment.user,
    })) : [],
  };
}

/**
 * Auto-add new tags to project or personal tags dictionary
 * Helper function to avoid code duplication
 */
async function autoAddTagsToDictionary(
  tags: string[],
  projectId: string | null,
  userId: string
): Promise<void> {
  if (!Array.isArray(tags) || tags.length === 0) {
    return;
  }

  try {
    if (projectId) {
      // Add tags to project dictionary
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { tags: true },
      });
      
      if (project) {
        const currentTags = project.tags || [];
        const newTags = tags.filter(tag => {
          const tagLower = tag.toLowerCase();
          return !currentTags.some(t => t.toLowerCase() === tagLower);
        });
        
        if (newTags.length > 0) {
          await prisma.project.update({
            where: { id: projectId },
            data: {
              tags: [...currentTags, ...newTags],
            },
          });
        }
      }
    } else {
      // Add tags to personal tags dictionary
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { personalTags: true },
      });
      
      if (user) {
        const currentTags = user.personalTags || [];
        const newTags = tags.filter(tag => {
          const tagLower = tag.toLowerCase();
          return !currentTags.some(t => t.toLowerCase() === tagLower);
        });
        
        if (newTags.length > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              personalTags: [...currentTags, ...newTags],
            },
          });
        }
      }
    }
  } catch (error) {
    // Log error but don't fail the operation
    console.error('Failed to auto-add tags to dictionary:', error);
  }
}

// ========== HEALTH CHECK (PUBLIC) ==========

// Health check endpoint (both /health and /api/health for compatibility)
const healthHandler = async (_req: Request, res: Response) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed - database connection error:', error);
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed'
    });
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ========== PUBLIC WEBHOOKS ==========
// Webhooks must be placed BEFORE authentication middleware
// They are public endpoints that external services call

/**
 * POST /api/webhooks/generic
 * Generic webhook handler for future integrations
 */
app.post('/api/webhooks/generic', webhookHandler);

// ========== PUBLIC INVITATION ENDPOINTS ==========
// These endpoints need to be public so users can view/accept invitations before logging in

/**
 * GET /api/invitations/:token
 * Get invitation details by token (for invite page)
 * Note: This endpoint is public (no authentication) since users need to view invitations before logging in
 */
app.get('/api/invitations/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    // Get invitation from database by token
    const invitation = await prisma.invitation.findUnique({
      where: { token: token },
      include: {
        project: {
          select: { name: true, id: true, color: true },
        },
      },
    });
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    // Check if expired
    const isExpired = new Date(invitation.expiresAt) < new Date();
    
    if (isExpired) {
      return res.status(410).json({ error: 'Invitation has expired', invitation });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation is ${invitation.status}`, invitation });
    }
    
    res.json({
      invitation: {
        id: invitation.id,
        token: invitation.token,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        projectId: invitation.projectId,
        projectName: invitation.project.name,
        projectColor: invitation.project.color,
      },
    });
  } catch (error: any) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to get invitation' });
  }
});

// ========== PROTECTED API ROUTES ==========
// Create a separate router for all protected API endpoints
const apiRouter = express.Router();

// Apply authentication middleware to all routes in apiRouter
apiRouter.use(authenticate);

// ========== AUTH ENDPOINTS (PUBLIC - NO AUTH REQUIRED) ==========
// These must be placed outside apiRouter since users aren't authenticated yet

/**
 * POST /api/auth/signup
 * Register a new user
 * Rate limited to prevent abuse
 */
app.post('/api/auth/signup', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким e-mail уже существует' });
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: false, // НЕ активирован сразу
        emailVerificationToken,
      },
    });

    // Send welcome email with verification token
    emailService.sendWelcomeEmail(user.email, user.name, emailVerificationToken).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    // НЕ генерировать JWT! Вернуть информационное сообщение:
    res.status(201).json({
      message: 'Регистрация успешна. Проверьте почту для активации аккаунта.',
      email: user.email,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle Prisma errors
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ error: 'Пользователь с таким e-mail уже существует' });
    }
    
    res.status(500).json({ error: 'Не удалось создать пользователя' });
  }
});

/**
 * POST /api/auth/signin
 * Sign in a user
 * Rate limited to prevent brute force attacks
 */
app.post('/api/auth/signin', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Необходимо указать email и пароль' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Проверяем, активирован ли email
    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Пожалуйста, подтвердите ваш email перед входом. Проверьте письмо.' 
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  } catch (error: any) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Ошибка входа в систему' });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify user email with token
 */
app.get('/api/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Токен не предоставлен' });
    }
    
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token as string }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Неверная ссылка активации' });
    }
    
    // Активируем пользователя
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
      }
    });
    
    // Генерируем токен авторизации
    const authToken = generateToken(user.id, user.email);
    
    res.json({
      message: 'Email подтвержден!',
      user: { id: user.id, email: user.email, name: user.name },
      token: authToken,
    });
  } catch (error) {
    console.error('Ошибка верификации email:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
apiRouter.get('/auth/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 * Rate limited to prevent abuse
 */
app.post('/api/auth/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success (security: don't reveal if email exists)
    if (!user) {
      console.log('Password reset requested for non-existent email:', email);
      return res.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires,
      },
    });

    // Send password reset email
    await emailService.sendPasswordResetEmail(user.email, resetToken);

    res.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.' 
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 * Rate limited to prevent abuse
 */
app.post('/api/auth/reset-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: {
          gt: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    // Send confirmation email
    emailService.sendPasswordChangedEmail(user.email, user.name).catch(err => {
      console.error('Failed to send password changed email:', err);
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ========== PROJECT CRUD ENDPOINTS (PROTECTED) ==========

/**
 * POST /api/projects
 * Create a new project (any authenticated user can create)
 */
apiRouter.post('/projects', createProject);

/**
 * GET /api/projects
 * Get all projects accessible to the user (owned + member of)
 */
apiRouter.get('/projects', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    // Get all projects where user is owner
    const ownedProjects = await prisma.project.findMany({
      where: {
        ownerId: userId,
        archived: false,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Get all projects where user is a member
    const memberProjects = await prisma.project.findMany({
      where: {
        archived: false,
        members: {
          some: {
            userId: userId,
          },
        },
        ownerId: {
          not: userId, // Exclude owned projects (already fetched above)
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Combine all projects
    const allProjects = [...ownedProjects, ...memberProjects];
    
    // Enrich projects with full category objects
    const enrichedProjects = await Promise.all(
      allProjects.map(async (project) => {
        if (project.availableCategories && Array.isArray(project.availableCategories) && project.availableCategories.length > 0) {
          // Fetch the owner's categories
          const categories = await prisma.category.findMany({
            where: {
              userId: project.ownerId,
              id: { in: project.availableCategories as string[] },
            },
          });
          
          return {
            ...project,
            categoriesDetails: categories, // Add full category objects
          };
        }
        return {
          ...project,
          categoriesDetails: [], // Empty array if no categories
        };
      })
    );
    
    // Transform all projects for API response (ownerId -> userId mapping)
    const transformedProjects = enrichedProjects.map(transformProjectForResponse);
    
    res.json(transformedProjects);
  } catch (error: any) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/archived
 * Get all archived projects accessible to the user (owned + member of)
 */
apiRouter.get('/projects/archived', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    // Get all archived projects where user is owner
    const ownedProjects = await prisma.project.findMany({
      where: {
        ownerId: userId,
        archived: true,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Get all archived projects where user is a member
    const memberProjects = await prisma.project.findMany({
      where: {
        archived: true,
        members: {
          some: {
            userId: userId,
          },
        },
        ownerId: {
          not: userId, // Exclude owned projects (already fetched above)
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Combine all archived projects
    const allArchivedProjects = [...ownedProjects, ...memberProjects];
    
    // Enrich projects with full category objects
    const enrichedProjects = await Promise.all(
      allArchivedProjects.map(async (project) => {
        if (project.availableCategories && Array.isArray(project.availableCategories) && project.availableCategories.length > 0) {
          // Fetch the owner's categories
          const categories = await prisma.category.findMany({
            where: {
              userId: project.ownerId,
              id: { in: project.availableCategories as string[] },
            },
          });
          
          return {
            ...project,
            categoriesDetails: categories, // Add full category objects
          };
        }
        return {
          ...project,
          categoriesDetails: [], // Empty array if no categories
        };
      })
    );
    
    // Transform all projects for API response (ownerId -> userId mapping)
    const transformedProjects = enrichedProjects.map(transformProjectForResponse);
    
    res.json(transformedProjects);
  } catch (error: any) {
    console.error('Get archived projects error:', error);
    res.status(500).json({ error: 'Failed to fetch archived projects' });
  }
});

/**
 * GET /api/projects/:id
 * Get a specific project by ID
 */
apiRouter.get('/projects/:id', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Transform project for API response (ownerId -> userId mapping)
    const transformedProject = transformProjectForResponse(project);

    res.json(transformedProject);
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * PATCH /api/projects/:id
 * Update a project (only Owner and Collaborator can edit)
 */
apiRouter.patch('/projects/:id', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const role = req.user!.roleInProject!; // Role is already checked by canAccessProject middleware

    // Check edit permission
    if (role !== 'owner' && role !== 'collaborator') {
      return res.status(403).json({ error: 'You do not have permission to edit this project' });
    }

    // FIX Problem #4 & #5: Support links, availableCategories, and attachments fields for project updates
    const { name, description, color, archived, links, availableCategories, attachments } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (archived !== undefined && role === 'owner') updateData.archived = archived; // Only owner can archive
    if (links !== undefined) updateData.links = links; // Store links as JSON
    // Only owner can modify available categories for the project
    if (availableCategories !== undefined && role === 'owner') {
      updateData.availableCategories = Array.isArray(availableCategories) ? availableCategories : [];
    }
    // Support attachments updates (for file deletion)
    if (attachments !== undefined) {
      updateData.attachments = Array.isArray(attachments) ? attachments : [];
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Transform project for API response (ownerId -> userId mapping)
    const transformedProject = transformProjectForResponse(updatedProject);

    // Emit WebSocket event for real-time synchronization
    emitProjectUpdated(transformedProject);

    res.json(transformedProject);
  } catch (error: any) {
    console.error('Update project error:', error);
    return handlePrismaError(error, res, 'Failed to update project');
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (only Owner can delete)
 * Rate limited to prevent abuse of file system operations
 */
apiRouter.delete('/projects/:id', uploadRateLimiter, canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const role = req.user!.roleInProject!; // Role is already checked by canAccessProject middleware

    // Check delete permission
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can delete the project' });
    }

    // Get project with attachments and all tasks with their attachments
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        attachments: true,
        tasks: { include: { attachments: true } }
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete project attachment files
    if (project.attachments && Array.isArray(project.attachments)) {
      const attachments = project.attachments as any[];
      for (const attachment of attachments) {
        if (attachment.url) {
          try {
            const filename = path.basename(new URL(attachment.url).pathname);
            const filePath = path.join(uploadsDir, path.basename(filename));
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted project file: ${filename}`);
            }
          } catch (fileError) {
            console.error('Failed to delete project file:', fileError);
            // Continue with deletion process
          }
        }
      }
    }

    // Delete task attachment files
    if (project.tasks && project.tasks.length > 0) {
      for (const task of project.tasks) {
        if (task.attachments && task.attachments.length > 0) {
          for (const attachment of task.attachments) {
            if (attachment.url) {
              try {
                const filename = path.basename(new URL(attachment.url).pathname);
                const filePath = path.join(uploadsDir, path.basename(filename));
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  console.log(`🗑️ Deleted task file: ${filename}`);
                }
              } catch (fileError) {
                console.error('Failed to delete task file:', fileError);
                // Continue with deletion process
              }
            }
          }
        }
      }
    }

    // Delete project (members and tasks will be cascade deleted from database)
    await prisma.project.delete({
      where: { id: projectId },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return handlePrismaError(error, res, 'Failed to delete project');
  }
});

/**
 * PATCH /api/projects/:id/archive
 * Archive a project (only Owner can archive)
 * FIX Problem #5: Add dedicated archive endpoint
 */
apiRouter.patch('/projects/:id/archive', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const role = req.user!.roleInProject!;

    // Check permission - only owner can archive
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can archive the project' });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { archived: true },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Transform project for API response (ownerId -> userId mapping)
    const transformedProject = transformProjectForResponse(updatedProject);

    // Emit WebSocket event for real-time synchronization
    emitProjectUpdated(transformedProject);

    console.log(`📦 Project archived: ${projectId}`);
    res.json(transformedProject);
  } catch (error: any) {
    console.error('Archive project error:', error);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

/**
 * PATCH /api/projects/:id/unarchive
 * Unarchive a project (only Owner can unarchive)
 * FIX Problem #5: Add dedicated unarchive endpoint
 */
apiRouter.patch('/projects/:id/unarchive', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const role = req.user!.roleInProject!;

    // Check permission - only owner can unarchive
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can unarchive the project' });
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { archived: false },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Transform project for API response (ownerId -> userId mapping)
    const transformedProject = transformProjectForResponse(updatedProject);

    // Emit WebSocket event for real-time synchronization
    emitProjectUpdated(transformedProject);

    console.log(`📦 Project unarchived: ${projectId}`);
    res.json(transformedProject);
  } catch (error: any) {
    console.error('Unarchive project error:', error);
    res.status(500).json({ error: 'Failed to unarchive project' });
  }
});

/**
 * GET /api/projects/:projectId/tasks
 * Get all tasks in a project (filtered by role)
 */
apiRouter.get('/projects/:projectId/tasks', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { projectId } = req.params;
    const role = req.user!.roleInProject!; // Role is already checked by canAccessProject middleware

    // Build query based on role
    const whereClause: any = { projectId };

    // Member can only see their own tasks
    if (role === 'member') {
      whereClause.OR = [
        { assigneeId: userId },
        { creatorId: userId },
      ];
    }

    // Fetch tasks
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
      orderBy: [
        { status: 'asc' },
        { orderKey: 'asc' },
      ],
    });

    // Transform tasks for response (field mapping for frontend compatibility)
    res.json(tasks.map(transformTaskForResponse));
  } catch (error: any) {
    console.error('Get project tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch project tasks' });
  }
});

/**
 * GET /api/projects/:projectId/members
 * Get all members of a project
 * FIX Problem #2: Include project owner even if not in ProjectMember table
 */
apiRouter.get('/projects/:projectId/members', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Fetch project with owner information
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if owner is already in members list
    const ownerInMembers = project.members.find(
      (m) => m.userId === project.ownerId && m.role === 'owner'
    );

    // If owner is not in members, create a synthetic member entry
    let allMembers = [...project.members];
    if (!ownerInMembers) {
      allMembers = [
        {
          id: `owner_${project.ownerId}`,
          userId: project.ownerId,
          projectId: project.id,
          role: 'owner',
          addedAt: project.createdAt,
          user: project.owner,
        } as any,
        ...project.members,
      ];
    }

    res.json(allMembers);
  } catch (error: any) {
    console.error('Get project members error:', error);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

/**
 * PATCH /api/projects/:projectId/members/:memberId
 * Update member role in project (Owner only)
 */
apiRouter.patch('/projects/:projectId/members/:memberId', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user!.sub;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Validate role
    if (!['owner', 'collaborator', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user is owner
    const userRole = await getUserRoleInProject(userId, projectId);
    if (userRole !== 'owner') {
      return res.status(403).json({ error: 'Only project owner can update member roles' });
    }

    // Check if member exists
    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.projectId !== projectId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Prevent changing the last owner
    if (member.role === 'owner' && role !== 'owner') {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot change role of the last owner' });
      }
    }

    // Update member role
    const updatedMember = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: role as any },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Emit WebSocket event for real-time synchronization
    emitProjectMemberAdded(projectId, updatedMember);

    res.json(updatedMember);
  } catch (error: any) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

/**
 * DELETE /api/projects/:projectId/members/:memberId
 * Remove member from project (Owner only)
 */
apiRouter.delete('/projects/:projectId/members/:memberId', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, memberId } = req.params;
    const userId = req.user!.sub;

    // Check if user is owner
    const userRole = await getUserRoleInProject(userId, projectId);
    if (userRole !== 'owner') {
      return res.status(403).json({ error: 'Only project owner can remove members' });
    }

    // Check if member exists
    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.projectId !== projectId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Prevent removing the last owner
    if (member.role === 'owner') {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last owner' });
      }
    }

    // Remove member
    await prisma.projectMember.delete({
      where: { id: memberId },
    });

    // Emit WebSocket event for real-time synchronization
    emitProjectMemberRemoved(projectId, memberId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

/**
 * POST /api/projects/:projectId/leave
 * Allow a member to leave a project
 * FIX Problem #6: Add endpoint for members to leave projects
 */
apiRouter.post('/projects/:projectId/leave', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.sub;

    // Get user's membership in the project
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });

    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this project' });
    }

    // If user is owner, check if they're the only owner
    if (membership.role === 'owner') {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: 'owner' },
      });
      
      if (ownerCount <= 1) {
        return res.status(400).json({ 
          error: 'Cannot leave: You are the only owner. Please transfer ownership first or delete the project.' 
        });
      }
    }

    // Unassign user from all tasks in this project
    await prisma.task.updateMany({
      where: { 
        projectId,
        assigneeId: userId,
      },
      data: { assigneeId: null },
    });

    // Remove user from project members
    await prisma.projectMember.delete({
      where: { id: membership.id },
    });

    // Emit WebSocket event for real-time synchronization
    emitProjectMemberRemoved(projectId, membership.id);

    console.log(`👋 User ${userId} left project ${projectId}`);
    res.json({ success: true, message: 'Successfully left the project' });
  } catch (error: any) {
    console.error('Leave project error:', error);
    res.status(500).json({ error: 'Failed to leave project' });
  }
});

/**
 * POST /api/projects/:id/transfer-ownership
 * Transfer project ownership to another member
 * FIX Problem #6: Add endpoint to transfer ownership before leaving
 */
apiRouter.post('/projects/:id/transfer-ownership', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.sub;
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return res.status(400).json({ error: 'newOwnerId is required' });
    }

    // Verify current user is owner
    const currentUserRole = await getUserRoleInProject(userId, projectId);
    if (currentUserRole !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can transfer ownership' });
    }

    // Verify new owner is a member of the project
    const newOwnerMembership = await prisma.projectMember.findFirst({
      where: { projectId, userId: newOwnerId },
    });

    if (!newOwnerMembership) {
      return res.status(400).json({ error: 'New owner must be a member of the project' });
    }

    // Get current owner membership
    const currentOwnerMembership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });

    if (!currentOwnerMembership) {
      return res.status(404).json({ error: 'Current owner membership not found' });
    }

    // Update in a transaction
    await prisma.$transaction([
      // Change new owner's role to owner
      prisma.projectMember.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'owner' },
      }),
      // Change current owner's role to collaborator
      prisma.projectMember.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'collaborator' },
      }),
      // Update project owner
      prisma.project.update({
        where: { id: projectId },
        data: { ownerId: newOwnerId },
      }),
    ]);

    // Fetch updated project
    const updatedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Transform project for API response (ownerId -> userId mapping)
    const transformedProject = updatedProject ? transformProjectForResponse(updatedProject) : null;

    // Emit WebSocket event for real-time synchronization
    if (transformedProject) {
      emitProjectUpdated(transformedProject);
    }

    console.log(`👑 Ownership transferred from ${userId} to ${newOwnerId} for project ${projectId}`);
    res.json({ success: true, message: 'Ownership transferred successfully', project: transformedProject });
  } catch (error: any) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

/**
 * GET /api/projects/:projectId/categories
 * Get categories available for a specific project
 * FIX Problem #3: Returns owner's categories that are assigned to this project
 * Members see these categories and can use them for tasks
 */
apiRouter.get('/projects/:projectId/categories', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Get project with owner and available categories
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        ownerId: true,
        availableCategories: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get owner's categories (not current user's categories!)
    const ownerCategories = await prisma.category.findMany({
      where: { userId: project.ownerId },
    });

    // Filter owner's categories by project's availableCategories
    const projectCategories = ownerCategories.filter((cat) => 
      Array.isArray(project.availableCategories) && 
      project.availableCategories.includes(cat.id)
    );

    res.json(projectCategories);
  } catch (error: any) {
    console.error('Get project categories error:', error);
    res.status(500).json({ error: 'Failed to fetch project categories' });
  }
});

// ========== INVITATION ROUTES (PROTECTED) ==========
// Mount invitation routes (handles /api/invitations/* and /api/projects/:projectId/invitations)
apiRouter.use('/invitations', invitationRoutes);
apiRouter.use('/projects', invitationRoutes);

// ========== FILE UPLOAD ENDPOINTS (PROTECTED) ==========

/**
 * PATCH /api/profile
 * Update user profile (name, etc)
 */
apiRouter.patch('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/upload-avatar
 * Upload user avatar
 * Rate limited to prevent abuse
 */
apiRouter.post('/upload-avatar', uploadRateLimiter, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user!.sub;
    const avatarUrl = getFullFileUrl(`uploads/${req.file.filename}`);

    // Delete old avatar file if exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (existingUser?.avatarUrl && existingUser.avatarUrl.startsWith('/uploads/')) {
      const oldFilePath = path.join(uploadsDir, path.basename(existingUser.avatarUrl));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update user avatar
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    res.json({
      avatarUrl: user.avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

/**
 * DELETE /api/avatar
 * Delete user avatar
 */
apiRouter.delete('/avatar', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    // Get current avatar
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // Delete file if exists
    if (existingUser?.avatarUrl && existingUser.avatarUrl.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(existingUser.avatarUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove avatar from database
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    res.json({
      success: true,
      message: 'Avatar deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete avatar error:', error);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

/**
 * POST /api/upload-attachment
 * Upload task attachment(s) - SUPPORTS MULTIPLE FILES
 * Rate limited to prevent abuse
 */
apiRouter.post('/upload-attachment', uploadRateLimiter, upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { taskId } = req.body;
    const userId = req.user!.sub;

    if (!taskId) {
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Check if task exists and user has permission to edit it
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ error: 'Task not found' });
    }

    const canEdit = await canEditTaskFromDB(userId, taskId);
    if (!canEdit) {
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(403).json({ error: 'You do not have permission to add attachments to this task' });
    }

    // Create attachments for all uploaded files
    const attachments = await Promise.all(
      files.map(async (file) => {
        const fileUrl = getFullFileUrl(`uploads/${file.filename}`);
        const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        return await prisma.attachment.create({
          data: {
            taskId,
            name: decodedFileName,
            url: fileUrl,
            size: file.size,
            mimeType: file.mimetype,
          },
        });
      })
    );

    // Fetch the updated task with attachments to emit via WebSocket
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        attachments: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Emit WebSocket event so other clients see the new attachments immediately
    if (updatedTask) {
      emitTaskUpdated(updatedTask, updatedTask.projectId || undefined);
      console.log(`📤 WebSocket: Emitted task:updated after attachment upload for task ${taskId}`);
    }

    res.json({
      attachments,
      message: `${attachments.length} file(s) uploaded successfully`,
    });
  } catch (error: any) {
    console.error('Upload attachment error:', error);
    // Clean up files if they exist
    const files = req.files as Express.Multer.File[];
    if (files) {
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ error: 'Failed to upload attachments' });
  }
});

/**
 * POST /api/upload-project-attachment
 * Upload project attachment
 * Rate limited to prevent abuse
 */
/**
 * POST /api/upload-project-attachment
 * Upload project attachment and save to database
 * Rate limited to prevent abuse
 */
apiRouter.post('/upload-project-attachment', uploadRateLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId } = req.body;
    if (!projectId) {
      // Clean up uploaded file - path is validated by multer storage config
      const safeFilePath = path.join(uploadsDir, path.basename(req.file.path));
      if (fs.existsSync(safeFilePath)) {
        fs.unlinkSync(safeFilePath);
      }
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const userId = req.user!.sub;

    // Check if user has permission to add attachments to this project
    const userRole = await getUserRoleInProject(userId, projectId);
    if (!userRole || userRole === 'viewer') {
      // Clean up uploaded file - path is validated by multer storage config
      const safeFilePath = path.join(uploadsDir, path.basename(req.file.path));
      if (fs.existsSync(safeFilePath)) {
        fs.unlinkSync(safeFilePath);
      }
      return res.status(403).json({ error: 'You do not have permission to add attachments to this project' });
    }

    const fileUrl = getFullFileUrl(`uploads/${req.file.filename}`);
    const decodedFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Save attachment to database using Prisma
    // Note: You'll need to add ProjectAttachment model to your Prisma schema
    // For now, we'll store it in project's attachments JSON field
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { attachments: true },
    });

    if (!project) {
      // Clean up uploaded file - path is validated by multer storage config
      const safeFilePath = path.join(uploadsDir, path.basename(req.file.path));
      if (fs.existsSync(safeFilePath)) {
        fs.unlinkSync(safeFilePath);
      }
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create attachment object
    const attachment = {
      id: `proj_attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: decodedFileName,
      size: req.file.size,
      sizeFormatted: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      url: fileUrl,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
    };

    // Get existing attachments or initialize empty array
    const existingAttachments = (project.attachments as any[]) || [];
    
    // Add new attachment
    const updatedAttachments = [...existingAttachments, attachment];

    // Update project with new attachment
    await prisma.project.update({
      where: { id: projectId },
      data: { attachments: updatedAttachments },
    });

    res.json({
      attachment,
      message: 'Project attachment uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload project attachment error:', error);
    // Clean up file if error occurred - path is validated by multer storage config
    if (req.file) {
      const safeFilePath = path.join(uploadsDir, path.basename(req.file.path));
      if (fs.existsSync(safeFilePath)) {
        fs.unlinkSync(safeFilePath);
      }
    }
    res.status(500).json({ error: 'Failed to upload project attachment' });
  }
});

/**
 * GET /api/download/:filename
 * Download file with proper headers
 * Fixes issue with corrupted Word/PDF files
 * Rate limited to prevent abuse
 */
apiRouter.get('/download/:filename', uploadRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Security: prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(uploadsDir, sanitizedFilename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Decode filename for proper display (handle Cyrillic)
    const originalName = sanitizedFilename.replace(/^\d+-\d+-/, ''); // Remove timestamp prefix
    
    // Set proper headers for download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * DELETE /api/projects/:projectId/attachments/:attachmentId
 * Delete project attachment
 * Rate limited to prevent abuse
 */
apiRouter.delete('/projects/:projectId/attachments/:attachmentId', uploadRateLimiter, canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, attachmentId } = req.params;
    const userId = req.user!.sub;

    // Check permission
    const userRole = await getUserRoleInProject(userId, projectId);
    if (!userRole || (userRole !== 'owner' && userRole !== 'collaborator')) {
      return res.status(403).json({ error: 'Only Owner and Collaborator can delete attachments' });
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { attachments: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingAttachments = (project.attachments as any[]) || [];
    const attachmentToDelete = existingAttachments.find((a: any) => a.id === attachmentId);

    if (!attachmentToDelete) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete file from filesystem
    if (attachmentToDelete.url) {
      try {
        const filename = path.basename(new URL(attachmentToDelete.url).pathname);
        const filePath = path.join(uploadsDir, path.basename(filename));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted file: ${filename}`);
        }
      } catch (fileError) {
        console.error('Failed to delete file:', fileError);
        // Continue with database update even if file deletion fails
      }
    }

    // Remove attachment from array
    const updatedAttachments = existingAttachments.filter((a: any) => a.id !== attachmentId);

    // Update project
    await prisma.project.update({
      where: { id: projectId },
      data: { attachments: updatedAttachments },
    });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error: any) {
    console.error('Delete project attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// ========== USER SETTINGS ENDPOINTS (PROTECTED) ==========

/**
 * GET /api/users/:userId/custom_columns
 * Get custom status columns for a user
 */
apiRouter.get('/users/:userId/custom_columns', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Ensure user is requesting their own data
    if (req.user!.sub !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get custom columns from Prisma
    const columns = await prisma.customColumn.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    
    // Map 'name' field to 'title' for frontend compatibility
    const mappedColumns = columns.map(col => ({
      id: col.id,
      title: col.name,
      color: col.color,
      order: col.order,
    }));
    
    res.json(mappedColumns);
  } catch (error: any) {
    console.error('Get custom columns error:', error);
    res.status(500).json({ error: 'Failed to fetch custom columns' });
  }
});

/**
 * POST /api/users/:userId/custom_columns
 * Save custom status columns for a user
 */
apiRouter.post('/users/:userId/custom_columns', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { columns } = req.body;
    
    // Ensure user is updating their own data
    if (req.user!.sub !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete existing columns and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all existing columns for this user
      await tx.customColumn.deleteMany({
        where: { userId },
      });

      // Create new columns
      if (Array.isArray(columns) && columns.length > 0) {
        await tx.customColumn.createMany({
          data: columns.map((col: any, index: number) => ({
            id: col.id,
            name: col.title || col.name,  // Support both title and name for backward compatibility
            color: col.color || null,
            order: col.order !== undefined ? col.order : index,
            userId,
          })),
        });
      }
    });

    // Fetch and return the updated columns
    const updatedColumns = await prisma.customColumn.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    
    // Emit WebSocket event so other tabs/clients see the updated custom columns immediately
    emitUserSettingsUpdated(userId, { 
      customColumns: updatedColumns.map(col => ({
        id: col.id,
        title: col.name,
        color: col.color,
        order: col.order,
      }))
    });
    console.log(`📤 WebSocket: Emitted user:settings_updated for custom columns for user ${userId}`);
    
    res.json(updatedColumns);
  } catch (error: any) {
    console.error('Save custom columns error:', error);
    res.status(500).json({ error: 'Failed to save custom columns' });
  }
});

/**
 * GET /api/users/:userId/categories
 * Get task categories for a user
 */
apiRouter.get('/users/:userId/categories', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Ensure user is requesting their own data
    if (req.user!.sub !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get categories from Prisma
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    
    res.json(categories);
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/users/:userId/categories
 * Save task categories for a user
 */
apiRouter.post('/users/:userId/categories', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { categories } = req.body;
    
    // Ensure user is updating their own data
    if (req.user!.sub !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete existing categories and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all existing categories for this user
      await tx.category.deleteMany({
        where: { userId },
      });

      // Create new categories
      if (Array.isArray(categories) && categories.length > 0) {
        await tx.category.createMany({
          data: categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            color: cat.color || '#3b82f6',
            userId,
          })),
          skipDuplicates: true, // Skip if duplicate userId+name
        });
      }
    });

    // Fetch and return the updated categories
    const updatedCategories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    
    // Emit WebSocket event so other tabs/clients see the updated categories immediately
    emitUserSettingsUpdated(userId, { 
      categories: updatedCategories 
    });
    console.log(`📤 WebSocket: Emitted user:settings_updated for categories for user ${userId}`);
    
    res.json(updatedCategories);
  } catch (error: any) {
    console.error('Save categories error:', error);
    res.status(500).json({ error: 'Failed to save categories' });
  }
});

/**
 * GET /api/my/pending_invitations
 * Get pending invitations for the current user
 */
apiRouter.get('/my/pending_invitations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find pending invitations by email
    const invitations = await prisma.invitation.findMany({
      where: {
        email: user.email,
        status: 'pending',
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    res.json(invitations);
  } catch (error: any) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch pending invitations' });
  }
});

// ========== TAGS DICTIONARY ENDPOINTS (PROTECTED) ==========

/**
 * GET /api/projects/:projectId/tags
 * Get tags dictionary for a project
 */
apiRouter.get('/projects/:projectId/tags', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { tags: true },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project.tags || []);
  } catch (error: any) {
    console.error('Get project tags error:', error);
    res.status(500).json({ error: 'Failed to fetch project tags' });
  }
});

/**
 * POST /api/projects/:projectId/tags
 * Add a tag to project's tags dictionary
 */
apiRouter.post('/projects/:projectId/tags', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { tag } = req.body;
    
    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({ error: 'Tag is required and must be a string' });
    }
    
    // Validate tag
    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      return res.status(400).json({ error: 'Tag cannot be empty' });
    }
    
    if (trimmedTag.length > 30) {
      return res.status(400).json({ error: 'Tag must be 30 characters or less' });
    }
    
    // Get current project tags
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { tags: true },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const currentTags = project.tags || [];
    
    // Check for duplicate (case-insensitive)
    const tagLower = trimmedTag.toLowerCase();
    const isDuplicate = currentTags.some(t => t.toLowerCase() === tagLower);
    
    if (isDuplicate) {
      return res.status(409).json({ error: 'Tag already exists in project' });
    }
    
    // Add tag
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        tags: [...currentTags, trimmedTag],
      },
      select: { tags: true },
    });
    
    // Emit WebSocket event
    const { emitProjectTagsUpdated } = await import('./websocket');
    emitProjectTagsUpdated(projectId, updatedProject.tags);
    
    res.json(updatedProject.tags);
  } catch (error: any) {
    console.error('Add project tag error:', error);
    res.status(500).json({ error: 'Failed to add tag to project' });
  }
});

/**
 * DELETE /api/projects/:projectId/tags
 * Remove a tag from project's tags dictionary
 * Note: Does NOT remove the tag from existing tasks
 */
apiRouter.delete('/projects/:projectId/tags', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { tag } = req.body;
    
    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({ error: 'Tag is required' });
    }
    
    // Get current project tags
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { tags: true },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const currentTags = project.tags || [];
    
    // Remove tag (case-insensitive match for consistency with add logic)
    const tagLower = tag.toLowerCase();
    const updatedTags = currentTags.filter(t => t.toLowerCase() !== tagLower);
    
    // Update project
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        tags: updatedTags,
      },
      select: { tags: true },
    });
    
    // Emit WebSocket event
    const { emitProjectTagsUpdated } = await import('./websocket');
    emitProjectTagsUpdated(projectId, updatedProject.tags);
    
    res.json(updatedProject.tags);
  } catch (error: any) {
    console.error('Delete project tag error:', error);
    res.status(500).json({ error: 'Failed to delete tag from project' });
  }
});

/**
 * GET /api/users/me/tags
 * Get personal tags dictionary for the current user
 */
apiRouter.get('/users/me/tags', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalTags: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.personalTags || []);
  } catch (error: any) {
    console.error('Get personal tags error:', error);
    res.status(500).json({ error: 'Failed to fetch personal tags' });
  }
});

/**
 * POST /api/users/me/tags
 * Add a tag to user's personal tags dictionary
 */
apiRouter.post('/users/me/tags', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { tag } = req.body;
    
    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({ error: 'Tag is required and must be a string' });
    }
    
    // Validate tag
    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      return res.status(400).json({ error: 'Tag cannot be empty' });
    }
    
    if (trimmedTag.length > 30) {
      return res.status(400).json({ error: 'Tag must be 30 characters or less' });
    }
    
    // Get current personal tags
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalTags: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentTags = user.personalTags || [];
    
    // Check for duplicate (case-insensitive)
    const tagLower = trimmedTag.toLowerCase();
    const isDuplicate = currentTags.some(t => t.toLowerCase() === tagLower);
    
    if (isDuplicate) {
      return res.status(409).json({ error: 'Tag already exists in personal tags' });
    }
    
    // Add tag
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        personalTags: [...currentTags, trimmedTag],
      },
      select: { personalTags: true },
    });
    
    // Emit WebSocket event
    const { emitPersonalTagsUpdated } = await import('./websocket');
    emitPersonalTagsUpdated(userId, updatedUser.personalTags);
    
    res.json(updatedUser.personalTags);
  } catch (error: any) {
    console.error('Add personal tag error:', error);
    res.status(500).json({ error: 'Failed to add personal tag' });
  }
});

/**
 * DELETE /api/users/me/tags
 * Remove a tag from user's personal tags dictionary
 * Note: Does NOT remove the tag from existing tasks
 */
apiRouter.delete('/users/me/tags', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { tag } = req.body;
    
    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({ error: 'Tag is required' });
    }
    
    // Get current personal tags
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalTags: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentTags = user.personalTags || [];
    
    // Remove tag (case-insensitive match for consistency with add logic)
    const tagLower = tag.toLowerCase();
    const updatedTags = currentTags.filter(t => t.toLowerCase() !== tagLower);
    
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        personalTags: updatedTags,
      },
      select: { personalTags: true },
    });
    
    // Emit WebSocket event
    const { emitPersonalTagsUpdated } = await import('./websocket');
    emitPersonalTagsUpdated(userId, updatedUser.personalTags);
    
    res.json(updatedUser.personalTags);
  } catch (error: any) {
    console.error('Delete personal tag error:', error);
    res.status(500).json({ error: 'Failed to delete personal tag' });
  }
});

// ========== TASK CRUD ENDPOINTS (PRISMA-BASED) (PROTECTED) ==========

/**
 * GET /api/tasks
 * Get all tasks accessible to the user (personal + project tasks based on role)
 */
apiRouter.get('/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    // Get all tasks where user is creator or assignee
    const personalTasks = await prisma.task.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { assigneeId: userId },
        ],
      },
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
      orderBy: [
        { status: 'asc' },
        { orderKey: 'asc' },
      ],
    });

    // Get project memberships with roles
    const projectMemberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true, role: true },
    });

    // Build role map for efficient lookup
    const roleMap = new Map<string, string>();
    projectMemberships.forEach(m => roleMap.set(m.projectId, m.role));

    // Get project IDs and separate by role
    const projectIds = projectMemberships.map((m) => m.projectId);
    const memberProjectIds = projectMemberships.filter(m => m.role === 'member').map(m => m.projectId);
    const otherProjectIds = projectMemberships.filter(m => m.role !== 'member').map(m => m.projectId);

    // For 'member' role projects, only fetch tasks where user is creator or assignee
    const memberProjectTasks = memberProjectIds.length > 0 ? await prisma.task.findMany({
      where: {
        projectId: { in: memberProjectIds },
        OR: [
          { creatorId: userId },
          { assigneeId: userId },
        ],
      },
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
      orderBy: [
        { status: 'asc' },
        { orderKey: 'asc' },
      ],
    }) : [];

    // For other roles (owner, collaborator, viewer), fetch all tasks
    const otherProjectTasks = otherProjectIds.length > 0 ? await prisma.task.findMany({
      where: {
        projectId: { in: otherProjectIds },
      },
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
      orderBy: [
        { status: 'asc' },
        { orderKey: 'asc' },
      ],
    }) : [];

    // Combine project tasks
    const filteredProjectTasks = [...memberProjectTasks, ...otherProjectTasks];

    // Combine and deduplicate
    const allTasks = [...personalTasks, ...filteredProjectTasks];
    const uniqueTasks = Array.from(
      new Map(allTasks.map((task) => [task.id, task])).values()
    );

    // Transform tasks for API response (field mapping for frontend compatibility)
    const transformedTasks = uniqueTasks.map(transformTaskForResponse);

    res.json(transformedTasks);
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/tasks/:taskId
 * Get a specific task by ID with access control
 * User has access if:
 * - They are the creator
 * - They are the assignee
 * - Task is in a project where they are a member
 * - Task is personal (no project) AND they are the creator
 */
apiRouter.get('/tasks/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.sub;

    // Find task with all necessary relations
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: {
          select: { 
            id: true, 
            name: true, 
            color: true,
            ownerId: true,
          },
        },
        attachments: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
    });

    // Task not found
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access permissions
    let hasAccess = false;

    // User is creator or assignee
    if (task.creatorId === userId || task.assigneeId === userId) {
      hasAccess = true;
    }

    // Task is in a project - check if user is a member
    if (task.projectId && !hasAccess) {
      const membership = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId: task.projectId,
          },
        },
      });

      if (membership || task.project?.ownerId === userId) {
        hasAccess = true;
      }
    }

    // Task is personal - only creator can access
    if (!task.projectId && task.creatorId !== userId) {
      hasAccess = false;
    }

    // Deny access if no permission found
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Transform task for response
    const transformedTask = transformTaskForResponse(task);
    
    res.json(transformedTask);
  } catch (error: any) {
    console.error('Get task by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

/**
 * POST /api/tasks
 * Create a new task with permission validation
 * Handles all task fields including tags, deadline, category, etc.
 */
apiRouter.post('/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    // Extract all possible fields from request body
    const { 
      title, 
      description, 
      status, 
      priority, 
      category, 
      categoryId, // Support both category and categoryId
      tags, 
      dueDate, 
      deadline, // Support both dueDate and deadline (frontend compatibility)
      projectId, 
      assigneeId, 
      orderKey,
      version,
      isRecurring,
      recurrencePattern
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Check permissions
    const canCreate = await canCreateTaskFromDB(userId, projectId || null, assigneeId);
    if (!canCreate) {
      return res.status(403).json({ 
        error: 'You do not have permission to create this task. Members can only create tasks assigned to themselves.' 
      });
    }

    // Resolve dueDate - support both dueDate and deadline fields
    const dueDateValue = dueDate || deadline;

    // Create task in database with all supported fields
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        category: categoryId || category || null, // Prefer categoryId over category
        tags: Array.isArray(tags) ? tags : [],
        dueDate: dueDateValue ? new Date(dueDateValue) : null,
        projectId: projectId || null,
        creatorId: userId,
        assigneeId: assigneeId || null,
        orderKey: orderKey || 'n',
        version: version || 1,
        isRecurring: isRecurring || false,
        recurrencePattern: recurrencePattern || null,
      },
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
    });

    // Auto-add new tags to project/personal tags dictionary
    await autoAddTagsToDictionary(tags || [], projectId, userId);

    // Emit WebSocket event for real-time synchronization
    const transformedTask = transformTaskForResponse(task);
    emitTaskCreated(transformedTask, task.projectId || undefined);

    // Send Telegram notification if task is assigned to someone else
    if (task.assigneeId && task.assigneeId !== userId) {
      await sendTaskAssignedNotification(task.assigneeId, {
        id: task.id,
        title: task.title,
        description: task.description || undefined,
        priority: task.priority,
        projectName: task.project?.name,
        assignerName: task.creator.name,
      });
    }

    // Transform task for response (field mapping for frontend compatibility)
    res.status(201).json(transformedTask);
  } catch (error: any) {
    console.error('Create task error:', error);
    return handlePrismaError(error, res, 'Failed to create task');
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task with permission validation
 * Handles all task fields including tags, deadline, category, etc.
 * Supports setting fields to null/empty values
 */
apiRouter.patch('/tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const taskId = req.params.id;

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check edit permission
    const canEdit = await canEditTaskFromDB(userId, taskId);
    if (!canEdit) {
      return res.status(403).json({ 
        error: 'You do not have permission to edit this task.' 
      });
    }

    // FIX Problem #2: Check task:assign permission if assigneeId is being changed
    // const { assigneeId } = req.body; // DUPLICATE - assigneeId is extracted below on line 2390
    const assigneeId = req.body.assigneeId; // Extract assigneeId early for permission check
    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId) {
      // User is trying to change the assignee
      if (existingTask.projectId) {
        // Get user's role in the project
        const role = await getUserRoleInProjectFromDB(userId, existingTask.projectId);
        
        // If not owner/collaborator, check task:assign permission
        if (role !== 'owner' && role !== 'collaborator') {
          // Import hasRolePermission at the top of the file if needed
          const { hasRolePermission } = await import('../lib/rbac.js');
          const hasAssignPermission = role ? hasRolePermission(role as any, 'task:assign') : false;
          
          if (!hasAssignPermission) {
            return res.status(403).json({ 
              error: 'You do not have permission to assign tasks to others.' 
            });
          }
        }
      }
    }

    // Extract all possible update fields from request body
    const { 
      title, 
      description, 
      status, 
      priority, 
      category, 
      categoryId, // Support both category and categoryId
      tags, 
      dueDate, 
      deadline, // Support both dueDate and deadline (frontend compatibility)
      // assigneeId, // Already extracted above for permission check
      orderKey, 
      version,
      isRecurring,
      recurrencePattern 
    } = req.body;
    
    // Build update data object - only include fields that are explicitly provided
    const updateData: any = {};
    
    // Required/always-present fields
    if (title !== undefined) updateData.title = title;
    
    // Optional string fields - support explicit null to clear
    if (description !== undefined) updateData.description = description || null;
    
    // Status and priority - use defaults if empty string provided
    if (status !== undefined) updateData.status = status || 'todo';
    if (priority !== undefined) updateData.priority = priority || 'medium';
    
    // Handle both category and categoryId for backward compatibility
    // Prefer categoryId over category if both are present
    if (categoryId !== undefined) {
      updateData.category = categoryId || null;
    } else if (category !== undefined) {
      updateData.category = category || null;
    }
    
    // Tags - ensure it's an array
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : [];
    }
    
    // Date fields - support both dueDate and deadline, prefer dueDate
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    } else if (deadline !== undefined) {
      updateData.dueDate = deadline ? new Date(deadline) : null;
    }
    
    // Assignee - support explicit null to unassign
    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId || null;
    }
    
    // Recurring task fields
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurrencePattern !== undefined) updateData.recurrencePattern = recurrencePattern || null;
    
    // Track when recurring task is completed
    if (status === 'done' && existingTask.isRecurring && existingTask.status !== 'done') {
      updateData.lastCompleted = new Date();
    }
    
    // Ordering and versioning
    if (orderKey !== undefined) updateData.orderKey = orderKey;
    if (version !== undefined) updateData.version = version;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        attachments: true,
      },
    });

    // Auto-add new tags to project/personal tags dictionary
    if (tags !== undefined && Array.isArray(tags)) {
      await autoAddTagsToDictionary(tags, updatedTask.projectId, userId);
    }

    // Emit WebSocket event for real-time synchronization
    const transformedTask = transformTaskForResponse(updatedTask);
    emitTaskUpdated(transformedTask, updatedTask.projectId || undefined);
    
    // If status changed, also emit task:moved for drag-and-drop visualization
    if (status !== undefined && status !== existingTask.status) {
      emitTaskMoved(taskId, existingTask.status, status, updatedTask.projectId || undefined);
    }

    // Send Telegram notification if assignee changed and task is assigned to someone else
    if (assigneeId !== undefined && 
        assigneeId !== existingTask.assigneeId && 
        assigneeId && 
        assigneeId !== userId) {
      await sendTaskAssignedNotification(assigneeId, {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description || undefined,
        priority: updatedTask.priority,
        projectName: updatedTask.project?.name,
        assignerName: req.user!.name,
      });
    }

    // Transform task for response (field mapping for frontend compatibility)
    res.json(transformedTask);
  } catch (error: any) {
    console.error('Update task error:', error);
    return handlePrismaError(error, res, 'Failed to update task');
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task with permission validation
 * Rate limited to prevent abuse of file system operations
 */
apiRouter.delete('/tasks/:id', uploadRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const taskId = req.params.id;

    // Check if task exists and get its attachments
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { attachments: true },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check delete permission
    const canDelete = await canDeleteTaskFromDB(userId, taskId);
    if (!canDelete) {
      return res.status(403).json({ 
        error: 'You do not have permission to delete this task. Only Owner and Collaborator can delete tasks.' 
      });
    }

    // Delete physical files before deleting task
    if (existingTask.attachments && existingTask.attachments.length > 0) {
      for (const attachment of existingTask.attachments) {
        if (attachment.url) {
          try {
            const filename = path.basename(new URL(attachment.url).pathname);
            const filePath = path.join(uploadsDir, path.basename(filename));
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted file: ${filename}`);
            }
          } catch (fileError) {
            console.error('Failed to delete file:', fileError);
            // Continue with deletion process even if file deletion fails
          }
        }
      }
    }

    // Delete task (attachments will be cascade deleted from database)
    await prisma.task.delete({
      where: { id: taskId },
    });

    // Emit WebSocket event for real-time synchronization
    emitTaskDeleted(taskId, existingTask.projectId || undefined);

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Delete task error:', error);
    return handlePrismaError(error, res, 'Failed to delete task');
  }
});

/**
 * DELETE /api/tasks/:taskId/attachments/:attachmentId
 * Delete task attachment
 * Rate limited to prevent abuse
 */
apiRouter.delete('/tasks/:taskId/attachments/:attachmentId', uploadRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, attachmentId } = req.params;
    const userId = req.user!.sub;

    // Check permission
    const canEdit = await canEditTaskFromDB(userId, taskId);
    if (!canEdit) {
      return res.status(403).json({ error: 'Only Owner and Collaborator can delete attachments' });
    }

    // Get attachment from database
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Verify attachment belongs to this task
    if (attachment.taskId !== taskId) {
      return res.status(400).json({ error: 'Attachment does not belong to this task' });
    }

    // Delete physical file from filesystem
    if (attachment.url) {
      try {
        const filename = path.basename(new URL(attachment.url).pathname);
        const filePath = path.join(uploadsDir, path.basename(filename));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted file: ${filename}`);
        }
      } catch (fileError) {
        console.error('Failed to delete file:', fileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete attachment record from database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Fetch the updated task to emit via WebSocket
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        attachments: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Emit WebSocket event so other clients see the attachment removal immediately
    if (updatedTask) {
      emitTaskUpdated(updatedTask, updatedTask.projectId || undefined);
      console.log(`📤 WebSocket: Emitted task:updated after attachment deletion for task ${taskId}`);
    }

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error: any) {
    console.error('Delete task attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

/**
 * POST /api/tasks/:id/comments
 * Add comment to task with WebSocket real-time updates
 */
apiRouter.post('/tasks/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user!.sub;

    // Validate comment text
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Текст комментария не может быть пустым' });
    }

    // Check if task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    // Check access: task creator, assignee, or project member
    const isCreator = task.creatorId === userId;
    const isAssignee = task.assigneeId === userId;
    const isProjectMember = task.project?.members.length > 0;
    const isProjectOwner = task.project?.ownerId === userId;

    if (!isCreator && !isAssignee && !isProjectMember && !isProjectOwner) {
      return res.status(403).json({ error: 'Нет доступа к этой задаче' });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        text: text.trim(),
        taskId: id,
        createdBy: userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    // Emit WebSocket event for real-time updates (only for project tasks)
    if (task.projectId) {
      const commentData = {
        id: comment.id,
        text: comment.text,
        createdBy: comment.createdBy,
        createdAt: comment.createdAt.toISOString(),
        user: comment.user
      };
      emitCommentAdded(id, commentData, task.projectId);
    }

    // Send Telegram notification
    await sendTaskCommentNotification(
      {
        id: task.id,
        title: task.title,
        creatorId: task.creatorId,
        assigneeId: task.assigneeId,
        project: task.project ? { name: task.project.name } : null,
      },
      comment
    );

    console.log(`💬 Comment added to task ${id} by user ${userId}`);
    res.json({
      comment: {
        id: comment.id,
        text: comment.text,
        createdBy: comment.createdBy,
        createdAt: comment.createdAt.toISOString(),
        user: comment.user
      }
    });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Ошибка при добавлении комментария' });
  }
});

// ========== PROJECT INVITATION EMAIL (PROTECTED) ==========


// ========== TASK PERMISSIONS VALIDATION (PROTECTED) ==========

/**
 * POST /api/tasks/validate-permission
 * Validate if user has permission to perform action on task - REFACTORED TO USE PRISMA
 */
apiRouter.post('/tasks/validate-permission', async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, action } = req.body; // action: 'view', 'edit', 'delete'
    const userId = req.user!.sub;
    
    if (!taskId || !action) {
      return res.status(400).json({ error: 'Task ID and action are required' });
    }
    
    // Get task from database
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
        attachments: true,
      },
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found', hasPermission: false });
    }
    
    let hasPermission = false;
    
    switch (action) {
      case 'view':
        hasPermission = await canViewTaskFromDB(userId, taskId);
        break;
      case 'edit':
        hasPermission = await canEditTaskFromDB(userId, taskId);
        break;
      case 'delete':
        hasPermission = await canDeleteTaskFromDB(userId, taskId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json({
      taskId,
      action,
      hasPermission,
      task: hasPermission ? task : undefined, // Only return task if user can view it
    });
  } catch (error: any) {
    console.error('Validate task permission error:', error);
    res.status(500).json({ error: 'Failed to validate permission' });
  }
});

/**
 * POST /api/tasks/check-permissions
 * Batch check permissions for multiple tasks - REFACTORED TO USE PRISMA
 */
apiRouter.post('/tasks/check-permissions', async (req: AuthRequest, res: Response) => {
  try {
    const { taskIds, action } = req.body;
    const userId = req.user!.sub;
    
    if (!taskIds || !Array.isArray(taskIds) || !action) {
      return res.status(400).json({ error: 'Task IDs array and action are required' });
    }
    
    const results: Record<string, boolean> = {};
    
    // Get all tasks from database
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
      },
    });
    
    // Check permission for each task
    for (const taskId of taskIds) {
      const task = tasks.find((t) => t.id === taskId);
      
      if (!task) {
        results[taskId] = false;
        continue;
      }
      
      let hasPermission = false;
      
      switch (action) {
        case 'view':
          hasPermission = await canViewTaskFromDB(userId, taskId);
          break;
        case 'edit':
          hasPermission = await canEditTaskFromDB(userId, taskId);
          break;
        case 'delete':
          hasPermission = await canDeleteTaskFromDB(userId, taskId);
          break;
      }
      
      results[taskId] = hasPermission;
    }
    
    res.json({ results });
  } catch (error: any) {
    console.error('Check permissions error:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

// ========== TELEGRAM BOT ENDPOINTS ==========

/**
 * POST /api/telegram/generate-link-token
 * Generate a token for linking Telegram account
 */
apiRouter.post('/telegram/generate-link-token', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    // Check if account is already linked
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramUsername: true },
    });
    
    if (user?.telegramChatId) {
      return res.json({
        linked: true,
        username: user.telegramUsername,
      });
    }
    
    // Delete any existing token for this user
    await prisma.telegramLinkToken.deleteMany({
      where: { userId },
    });
    
    // Generate new token (format: LINK-ABC123)
    const token = `LINK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await prisma.telegramLinkToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
    
    res.json({
      linked: false,
      token,
      expiresAt,
    });
  } catch (error) {
    console.error('Generate link token error:', error);
    res.status(500).json({ error: 'Failed to generate link token' });
  }
});

/**
 * GET /api/telegram/status
 * Get Telegram connection status
 */
apiRouter.get('/telegram/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
      },
    });
    
    res.json({
      linked: !!user?.telegramChatId,
      username: user?.telegramUsername,
      linkedAt: user?.telegramLinkedAt,
    });
  } catch (error) {
    console.error('Get Telegram status error:', error);
    res.status(500).json({ error: 'Failed to get Telegram status' });
  }
});

/**
 * POST /api/telegram/unlink
 * Unlink Telegram account
 */
apiRouter.post('/telegram/unlink', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Unlink Telegram error:', error);
    res.status(500).json({ error: 'Failed to unlink Telegram' });
  }
});

// ========== MOUNT API ROUTER ==========
// Mount all protected routes under /api
app.use('/api', apiRouter);

// ========== ERROR HANDLER ==========

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========

// ESM module entry point check - robust version that works with PM2 and tsx
// This handles cases where process.argv[1] might be relative or have path inconsistencies
function isMainModule(): boolean {
  try {
    // Convert import.meta.url to file path
    const currentFilePath = fileURLToPath(import.meta.url);
    
    // Resolve the entry point file path (handles relative paths, symlinks, etc.)
    const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
    
    // Compare resolved absolute paths
    return currentFilePath === entryFilePath;
  } catch (error) {
    // If there's any error in path resolution, assume we should start the server
    // This ensures the server starts even if path comparison fails
    console.warn('Could not determine if module is main, defaulting to starting server');
    return true;
  }
}

if (isMainModule()) {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  initializeWebSocket(httpServer);
  
  // Initialize Telegram bot
  initializeTelegramBot();
  
  // Initialize daily digest cron job (runs at 06:00 UTC = 09:00 Moscow time)
  cron.schedule('0 6 * * *', () => {
    console.log('⏰ Running daily tasks digest cron job...');
    sendDailyTasksDigest();
  });
  console.log('⏰ Daily digest cron job initialized (06:00 UTC / 09:00 Moscow time)');
  
  // Start listening
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready`);
    console.log(`📁 Serving uploads from: ${uploadsDir}`);
    
    // Start recurring task processor (runs every hour)
    startRecurringTaskProcessor(60);
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Error: Port ${PORT} is already in use`);
      console.error('Please check if another process is using this port or set a different PORT in environment variables');
    } else if (error.code === 'EACCES') {
      console.error(`❌ Error: Permission denied to bind to port ${PORT}`);
      console.error('Try using a port number above 1024 or run with appropriate permissions');
    } else {
      console.error(`❌ Server error:`, error);
    }
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

export default app;
