import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword, generateToken, verifyToken, JwtPayload } from '../lib/auth';
import * as kv from './kv_store';
import emailService from '../lib/email';

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
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

// ========== AUTH MIDDLEWARE ==========

interface AuthRequest extends Request {
  user?: JwtPayload;
}

async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyToken(token);
    
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ========== PERMISSION HELPERS ==========

type UserRole = 'owner' | 'admin' | 'collaborator' | 'member' | 'viewer' | null;

/**
 * Get user's role in a project
 */
async function getUserRoleInProject(userId: string, projectId: string): Promise<UserRole> {
  try {
    // Check if user owns the project
    const ownerProjects = await kv.get(`projects:${userId}`) || [];
    const ownedProject = ownerProjects.find((p: any) => p.id === projectId);
    if (ownedProject) {
      return 'owner';
    }
    
    // Check if user is a member of shared project
    const sharedProjects = await kv.get(`shared_projects:${userId}`) || [];
    const sharedRef = sharedProjects.find((ref: any) => ref.projectId === projectId);
    if (sharedRef) {
      return sharedRef.role || 'member';
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if user can edit task
 */
async function canEditTask(userId: string, task: any): Promise<boolean> {
  // Personal tasks - only owner can edit
  if (!task.projectId) {
    return task.userId === userId;
  }
  
  const role = await getUserRoleInProject(userId, task.projectId);
  
  // Owner and Collaborator can edit any task
  if (role === 'owner' || role === 'collaborator') {
    return true;
  }
  
  // Member can edit if assigned or created
  if (role === 'member') {
    return task.userId === userId || task.assigneeId === userId;
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
    return task.userId === userId;
  }
  
  const role = await getUserRoleInProject(userId, task.projectId);
  
  // Owner and Collaborator can delete any task
  if (role === 'owner' || role === 'collaborator') {
    return true;
  }
  
  // Member can delete if assigned or created
  if (role === 'member') {
    return task.userId === userId || task.assigneeId === userId;
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
    return task.userId === userId;
  }
  
  const role = await getUserRoleInProject(userId, task.projectId);
  
  // All roles can view tasks in projects they're part of
  return role !== null;
}

// ========== HEALTH CHECK ==========

// Health check endpoint (both /health and /api/health for compatibility)
const healthHandler = (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ========== AUTH ENDPOINTS ==========

/**
 * POST /api/auth/signup
 * Register a new user
 */
app.post('/api/auth/signup', async (req: Request, res: Response) => {
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
 */
app.post('/api/auth/signin', async (req: Request, res: Response) => {
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
app.get('/api/auth/me', authenticate, async (req: AuthRequest, res: Response) => {
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
 */
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
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
 */
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
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

// ========== FILE UPLOAD ENDPOINTS ==========

/**
 * POST /api/upload-avatar
 * Upload user avatar
 */
app.post('/api/upload-avatar', authenticate, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
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
 * Upload task attachment
 */
app.post('/api/upload-attachment', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const attachmentId = `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store attachment metadata in KV store
    const attachment = {
      id: attachmentId,
      taskId,
      name: req.file.originalname, // Changed from 'filename' to 'name' for UI consistency
      filename: req.file.originalname, // Keep for backward compatibility
      url: fileUrl,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    // Get existing attachments for this task
    const taskAttachmentsKey = `task_attachments:${taskId}`;
    const existingAttachments = (await kv.get(taskAttachmentsKey)) || [];
    existingAttachments.push(attachment);
    await kv.set(taskAttachmentsKey, existingAttachments);

    res.json({
      attachment,
      message: 'Attachment uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

/**
 * POST /api/upload-project-attachment
 * Upload project attachment
 */
app.post('/api/upload-project-attachment', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
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

// ========== KV STORE ENDPOINTS ==========

/**
 * GET /api/kv/:key
 * Get value by key
 */
app.get('/api/kv/:key', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const value = await kv.get(key);
    
    res.json({ key, value });
  } catch (error: any) {
    console.error('KV get error:', error);
    res.status(500).json({ error: 'Failed to get value' });
  }
});

/**
 * POST /api/kv/:key
 * Set value by key
 */
app.post('/api/kv/:key', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await kv.set(key, value);
    
    res.json({ key, value, message: 'Value set successfully' });
  } catch (error: any) {
    console.error('KV set error:', error);
    res.status(500).json({ error: 'Failed to set value' });
  }
});

/**
 * DELETE /api/kv/:key
 * Delete value by key
 */
app.delete('/api/kv/:key', authenticate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    await kv.del(key);
    
    res.json({ message: 'Value deleted successfully' });
  } catch (error: any) {
    console.error('KV delete error:', error);
    res.status(500).json({ error: 'Failed to delete value' });
  }
});

/**
 * GET /api/kv-prefix/:prefix
 * Get all values with keys starting with prefix
 */
app.get('/api/kv-prefix/:prefix', authenticate, async (req: Request, res: Response) => {
  try {
    const { prefix } = req.params;
    const values = await kv.getByPrefix(prefix);
    
    res.json({ prefix, values });
  } catch (error: any) {
    console.error('KV get by prefix error:', error);
    res.status(500).json({ error: 'Failed to get values' });
  }
});

// ========== PROJECT INVITATION EMAIL ==========

/**
 * POST /api/invitations/send-email
 * Send project invitation email
 */
app.post('/api/invitations/send-email', authenticate, async (req: AuthRequest, res: Response) => {
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

/**
 * GET /api/invitations/:invitationId
 * Get invitation details by ID (for invite page)
 */
app.get('/api/invitations/:invitationId', async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    
    // Get all pending invitations
    const allInvitations = await kv.get('pending_invitations') || [];
    
    // Find the specific invitation
    const invitation = allInvitations.find((inv: any) => inv.id === invitationId);
    
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
    
    // Get project name
    let projectName = 'Unknown Project';
    try {
      const ownerProjects = await kv.get(`projects:${invitation.projectOwnerId}`) || [];
      const project = ownerProjects.find((p: any) => p.id === invitation.projectId);
      if (project) {
        projectName = project.name;
      }
    } catch (error) {
      console.error('Failed to fetch project name:', error);
    }
    
    res.json({
      invitation: {
        ...invitation,
        projectName,
      },
    });
  } catch (error: any) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to get invitation' });
  }
});

// ========== TASK PERMISSIONS VALIDATION ==========

/**
 * POST /api/tasks/validate-permission
 * Validate if user has permission to perform action on task
 */
app.post('/api/tasks/validate-permission', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, action } = req.body; // action: 'view', 'edit', 'delete'
    const userId = req.user!.sub;
    
    if (!taskId || !action) {
      return res.status(400).json({ error: 'Task ID and action are required' });
    }
    
    // Get task from KV store
    const tasks = await kv.get(`tasks:${userId}`) || [];
    let task = tasks.find((t: any) => t.id === taskId);
    
    // If not in user's tasks, check shared projects
    if (!task) {
      const sharedProjects = await kv.get(`shared_projects:${userId}`) || [];
      
      for (const ref of sharedProjects) {
        // Get tasks from project owner
        const ownerTasks = await kv.get(`tasks:${ref.ownerId}`) || [];
        task = ownerTasks.find((t: any) => t.id === taskId && t.projectId === ref.projectId);
        if (task) break;
      }
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found', hasPermission: false });
    }
    
    let hasPermission = false;
    
    switch (action) {
      case 'view':
        hasPermission = await canViewTask(userId, task);
        break;
      case 'edit':
        hasPermission = await canEditTask(userId, task);
        break;
      case 'delete':
        hasPermission = await canDeleteTask(userId, task);
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
 * Batch check permissions for multiple tasks
 */
app.post('/api/tasks/check-permissions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { taskIds, action } = req.body;
    const userId = req.user!.sub;
    
    if (!taskIds || !Array.isArray(taskIds) || !action) {
      return res.status(400).json({ error: 'Task IDs array and action are required' });
    }
    
    const results: Record<string, boolean> = {};
    
    // Get user's tasks
    const userTasks = await kv.get(`tasks:${userId}`) || [];
    
    // Get shared project tasks
    const sharedProjects = await kv.get(`shared_projects:${userId}`) || [];
    let sharedTasks: any[] = [];
    
    for (const ref of sharedProjects) {
      const ownerTasks = await kv.get(`tasks:${ref.ownerId}`) || [];
      sharedTasks = sharedTasks.concat(
        ownerTasks.filter((t: any) => t.projectId === ref.projectId)
      );
    }
    
    const allAccessibleTasks = [...userTasks, ...sharedTasks];
    
    // Check permission for each task
    for (const taskId of taskIds) {
      const task = allAccessibleTasks.find((t: any) => t.id === taskId);
      
      if (!task) {
        results[taskId] = false;
        continue;
      }
      
      let hasPermission = false;
      
      switch (action) {
        case 'view':
          hasPermission = await canViewTask(userId, task);
          break;
        case 'edit':
          hasPermission = await canEditTask(userId, task);
          break;
        case 'delete':
          hasPermission = await canDeleteTask(userId, task);
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
