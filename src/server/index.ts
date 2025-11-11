import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
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
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

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

// ========== HEALTH CHECK (PUBLIC) ==========

// Health check endpoint (both /health and /api/health for compatibility)
const healthHandler = (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Send welcome email (async, don't wait for it)
    emailService.sendWelcomeEmail(user.email, user.name).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    // Generate token
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle unique constraint violation (in case of race condition)
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ error: 'Пользователь с таким e-mail уже существует' });
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
    await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

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

    // Combine and return all projects
    const allProjects = [...ownedProjects, ...memberProjects];
    res.json(allProjects);
  } catch (error: any) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
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

    res.json(project);
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

    const { name, description, color, archived } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (archived !== undefined && role === 'owner') updateData.archived = archived; // Only owner can archive

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

    res.json(updatedProject);
  } catch (error: any) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (only Owner can delete)
 */
apiRouter.delete('/projects/:id', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const role = req.user!.roleInProject!; // Role is already checked by canAccessProject middleware

    // Check delete permission
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can delete the project' });
    }

    // Delete project (members and tasks will be cascade deleted)
    await prisma.project.delete({
      where: { id: projectId },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
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

    res.json(tasks);
  } catch (error: any) {
    console.error('Get project tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch project tasks' });
  }
});

/**
 * GET /api/projects/:projectId/members
 * Get all members of a project
 */
apiRouter.get('/projects/:projectId/members', canAccessProject, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Fetch project members
    const members = await prisma.projectMember.findMany({
      where: { projectId: projectId },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
      },
    });

    res.json(members);
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

    res.json({ success: true });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ========== INVITATION ROUTES (PROTECTED) ==========
// Mount invitation routes (handles /api/invitations/* and /api/projects/:projectId/invitations)
apiRouter.use('/invitations', invitationRoutes);
apiRouter.use('/projects', invitationRoutes);

// ========== FILE UPLOAD ENDPOINTS (PROTECTED) ==========

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
    const avatarUrl = `/uploads/${req.file.filename}`;

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
 * POST /api/upload-attachment
 * Upload task attachment - REFACTORED TO USE PRISMA
 * Rate limited to prevent abuse
 */
apiRouter.post('/upload-attachment', uploadRateLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { taskId } = req.body;
    const userId = req.user!.sub;

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Check if task exists and user has permission to edit it
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Task not found' });
    }

    const canEdit = await canEditTaskFromDB(userId, taskId);
    if (!canEdit) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'You do not have permission to add attachments to this task' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Create attachment in database using Prisma
    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        name: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    res.json({
      attachment,
      message: 'Attachment uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload attachment error:', error);
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

/**
 * POST /api/upload-project-attachment
 * Upload project attachment
 * Rate limited to prevent abuse
 */
apiRouter.post('/upload-project-attachment', uploadRateLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const attachmentId = `proj_attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Return attachment metadata
    const attachment = {
      id: attachmentId,
      name: req.file.originalname,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      url: fileUrl,
      uploadedAt: new Date().toISOString(),
    };

    res.json({
      attachment,
      message: 'Project attachment uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload project attachment error:', error);
    res.status(500).json({ error: 'Failed to upload project attachment' });
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

    // Use KV store for now (temporary until added to Prisma schema)
    const kvStore = await import('./kv_store.js');
    const columns = await kvStore.get(`custom_columns:${userId}`) || [];
    
    res.json(columns);
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

    // Use KV store for now (temporary until added to Prisma schema)
    const kvStore = await import('./kv_store.js');
    await kvStore.set(`custom_columns:${userId}`, columns);
    
    res.json(columns);
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

    // Use KV store for now (temporary until added to Prisma schema)
    const kvStore = await import('./kv_store.js');
    const categories = await kvStore.get(`categories:${userId}`) || [];
    
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

    // Use KV store for now (temporary until added to Prisma schema)
    const kvStore = await import('./kv_store.js');
    await kvStore.set(`categories:${userId}`, categories);
    
    res.json(categories);
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

    // Get project memberships
    const projectMemberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true, role: true },
    });

    // Get tasks from projects where user is a member
    const projectIds = projectMemberships.map((m) => m.projectId);
    const projectTasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
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

    // Filter project tasks based on role (Member only sees their own)
    const filteredProjectTasks = await Promise.all(
      projectTasks.map(async (task) => {
        if (task.projectId) {
          const role = await getUserRoleInProject(userId, task.projectId);
          if (role === 'member') {
            // Member can only see tasks assigned to them or created by them
            if (task.creatorId === userId || task.assigneeId === userId) {
              return task;
            }
            return null;
          }
        }
        return task;
      })
    );

    // Combine and deduplicate
    const allTasks = [...personalTasks, ...filteredProjectTasks.filter(Boolean)];
    const uniqueTasks = Array.from(
      new Map(allTasks.map((task) => [task.id, task])).values()
    );

    res.json(uniqueTasks);
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/tasks
 * Create a new task with permission validation
 */
apiRouter.post('/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { title, description, status, priority, category, tags, dueDate, projectId, assigneeId, orderKey } = req.body;

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

    // Create task in database
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        category: category || null,
        tags: tags || [],
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
        creatorId: userId,
        assigneeId: assigneeId || null,
        orderKey: orderKey || 'n',
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

    res.status(201).json(task);
  } catch (error: any) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task with permission validation
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

    // Update task
    const { title, description, status, priority, category, categoryId, tags, dueDate, assigneeId, orderKey, version } = req.body;
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    // Handle both category and categoryId for backward compatibility
    if (category !== undefined) updateData.category = category;
    if (categoryId !== undefined) updateData.category = categoryId;
    if (tags !== undefined) updateData.tags = tags;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
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

    res.json(updatedTask);
  } catch (error: any) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task with permission validation
 */
apiRouter.delete('/tasks/:id', async (req: AuthRequest, res: Response) => {
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

    // Check delete permission
    const canDelete = await canDeleteTaskFromDB(userId, taskId);
    if (!canDelete) {
      return res.status(403).json({ 
        error: 'You do not have permission to delete this task. Only Owner and Collaborator can delete tasks.' 
      });
    }

    // Delete task (attachments will be cascade deleted)
    await prisma.task.delete({
      where: { id: taskId },
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ========== PROJECT INVITATION EMAIL (PROTECTED) ==========

/**
 * POST /api/invitations/send-email
 * Send project invitation email
 */
apiRouter.post('/invitations/send-email', async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId, email, projectName, role, expiresAt } = req.body;
    
    if (!invitationId || !email || !projectName || !role || !expiresAt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const inviterName = req.user?.name || 'Пользователь';
    
    // Send email
    const sent = await emailService.sendProjectInvitationEmail(
      email,
      projectName,
      inviterName,
      role,
      invitationId,
      expiresAt
    );
    
    if (!sent) {
      console.warn('Email not sent (service not configured), but invitation created');
    }
    
    res.json({ 
      message: sent ? 'Invitation email sent successfully' : 'Invitation created (email service not configured)',
      emailSent: sent 
    });
  } catch (error: any) {
    console.error('Send invitation email error:', error);
    res.status(500).json({ error: 'Failed to send invitation email' });
  }
});

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
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving uploads from: ${uploadsDir}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
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
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

export default app;
