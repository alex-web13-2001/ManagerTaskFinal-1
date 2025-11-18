import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Extended socket interface with user information
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

// WebSocket event types
export interface WebSocketEvents {
  // Task events
  'task:created': (data: { task: any; projectId?: string }) => void;
  'task:updated': (data: { task: any; projectId?: string }) => void;
  'task:deleted': (data: { taskId: string; projectId?: string }) => void;
  'task:moved': (data: { taskId: string; fromStatus: string; toStatus: string; projectId?: string }) => void;
  
  // Invitation events
  'invite:received': (data: { invitation: any; userId: string }) => void;
  'invite:accepted': (data: { invitationId: string; projectId: string; userId: string }) => void;
  'invite:rejected': (data: { invitationId: string; projectId: string; userId: string }) => void;
  
  // Notification events
  'notification:new': (data: { notification: any; userId: string }) => void;
  
  // User status events
  'user:online': (data: { userId: string; userName: string; projectId?: string }) => void;
  'user:offline': (data: { userId: string; projectId?: string }) => void;
  'user:dragging': (data: { userId: string; taskId: string; projectId?: string }) => void;
  
  // Project events
  'project:updated': (data: { project: any; projectId: string }) => void;
  'project:member_added': (data: { projectId: string; member: any }) => void;
  'project:member_removed': (data: { projectId: string; memberId: string }) => void;
  
  // User settings events
  'user:settings_updated': (data: { userId: string; settings: any }) => void;
}

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  console.log('🔌 Initializing WebSocket server...');
  
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        console.log('❌ WebSocket auth failed: No token provided');
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Attach user info to socket
      socket.userId = decoded.sub;
      socket.userEmail = decoded.email;
      socket.userName = decoded.name || decoded.email;
      
      console.log(`✅ WebSocket authenticated: ${socket.userName} (${socket.userId})`);
      next();
    } catch (error) {
      console.error('❌ WebSocket auth error:', error);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const userName = socket.userName!;
    
    console.log(`🔗 Client connected: ${userName} (${userId})`);

    // Join user's personal room (for notifications, invitations)
    socket.join(`user:${userId}`);
    console.log(`📥 User ${userName} joined personal room: user:${userId}`);

    // Handle joining project rooms
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`📥 User ${userName} joined project room: project:${projectId}`);
      
      // Notify others in the project that user is online
      socket.to(`project:${projectId}`).emit('user:online', {
        userId,
        userName,
        projectId,
      });
    });

    // Handle leaving project rooms
    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`📤 User ${userName} left project room: project:${projectId}`);
      
      // Notify others in the project that user is offline
      socket.to(`project:${projectId}`).emit('user:offline', {
        userId,
        projectId,
      });
    });

    // Handle drag state broadcasts
    socket.on('user:dragging', (data: { taskId: string; projectId?: string; isDragging: boolean }) => {
      const room = data.projectId ? `project:${data.projectId}` : null;
      if (room) {
        socket.to(room).emit('user:dragging', {
          userId,
          taskId: data.taskId,
          isDragging: data.isDragging,
          projectId: data.projectId,
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${userName} (${userId})`);
      
      // Notify all rooms that user went offline
      // The socket.io library automatically removes socket from all rooms on disconnect
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${userName}:`, error);
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
}

/**
 * Get the socket.io instance
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit task created event
 */
export function emitTaskCreated(task: any, projectId?: string) {
  if (!io) return;
  
  const room = projectId ? `project:${projectId}` : null;
  const event = 'task:created';
  const data = { task, projectId };
  
  if (room) {
    io.to(room).emit(event, data);
    console.log(`📤 Emitted ${event} to room ${room}`);
  }
}

/**
 * Emit task updated event
 */
export function emitTaskUpdated(task: any, projectId?: string) {
  if (!io) return;
  
  const room = projectId ? `project:${projectId}` : null;
  const event = 'task:updated';
  const data = { task, projectId };
  
  if (room) {
    io.to(room).emit(event, data);
    console.log(`📤 Emitted ${event} to room ${room}`);
  }
}

/**
 * Emit task deleted event
 */
export function emitTaskDeleted(taskId: string, projectId?: string) {
  if (!io) return;
  
  const room = projectId ? `project:${projectId}` : null;
  const event = 'task:deleted';
  const data = { taskId, projectId };
  
  if (room) {
    io.to(room).emit(event, data);
    console.log(`📤 Emitted ${event} to room ${room}`);
  }
}

/**
 * Emit task moved event (for drag-and-drop)
 */
export function emitTaskMoved(taskId: string, fromStatus: string, toStatus: string, projectId?: string) {
  if (!io) return;
  
  const room = projectId ? `project:${projectId}` : null;
  const event = 'task:moved';
  const data = { taskId, fromStatus, toStatus, projectId };
  
  if (room) {
    io.to(room).emit(event, data);
    console.log(`📤 Emitted ${event} to room ${room}`);
  }
}

/**
 * Emit invitation received event
 */
export function emitInviteReceived(invitation: any, userId: string) {
  if (!io) return;
  
  const room = `user:${userId}`;
  const event = 'invite:received';
  const data = { invitation, userId };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit invitation accepted event
 */
export function emitInviteAccepted(invitationId: string, projectId: string, userId: string) {
  if (!io) return;
  
  const room = `project:${projectId}`;
  const event = 'invite:accepted';
  const data = { invitationId, projectId, userId };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit invitation rejected event
 */
export function emitInviteRejected(invitationId: string, projectId: string, userId: string) {
  if (!io) return;
  
  const room = `project:${projectId}`;
  const event = 'invite:rejected';
  const data = { invitationId, projectId, userId };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit notification event
 */
export function emitNotification(notification: any, userId: string) {
  if (!io) return;
  
  const room = `user:${userId}`;
  const event = 'notification:new';
  const data = { notification, userId };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit project updated event
 */
export function emitProjectUpdated(project: any) {
  if (!io) return;
  
  const room = `project:${project.id}`;
  const event = 'project:updated';
  const data = { project, projectId: project.id };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit project member added event
 */
export function emitProjectMemberAdded(projectId: string, member: any) {
  if (!io) return;
  
  const room = `project:${projectId}`;
  const event = 'project:member_added';
  const data = { projectId, member };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit project member removed event
 */
export function emitProjectMemberRemoved(projectId: string, memberId: string) {
  if (!io) return;
  
  const room = `project:${projectId}`;
  const event = 'project:member_removed';
  const data = { projectId, memberId };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

/**
 * Emit comment added event
 */
export function emitCommentAdded(taskId: string, comment: any, projectId?: string) {
  const io = getIO();
  if (!io) return;

  const event = {
    taskId,
    comment,
    timestamp: new Date().toISOString()
  };

  if (projectId) {
    // Broadcast to project room
    io.to(`project:${projectId}`).emit('comment:added', event);
    console.log(`📡 [WebSocket] Broadcasted comment:added to project:${projectId}`);
  } else {
    // Broadcast globally for personal tasks
    io.emit('comment:added', event);
    console.log(`📡 [WebSocket] Broadcasted comment:added globally`);
  }
}

/**
 * Emit user settings updated event
 * This is used for custom columns, categories, and other user preferences
 */
export function emitUserSettingsUpdated(userId: string, settings: any) {
  if (!io) return;
  
  const room = `user:${userId}`;
  const event = 'user:settings_updated';
  const data = { userId, settings };
  
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to room ${room}`);
}

export default {
  initializeWebSocket,
  getIO,
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskDeleted,
  emitTaskMoved,
  emitInviteReceived,
  emitInviteAccepted,
  emitInviteRejected,
  emitNotification,
  emitProjectUpdated,
  emitProjectMemberAdded,
  emitProjectMemberRemoved,
  emitCommentAdded,
  emitUserSettingsUpdated,
};
