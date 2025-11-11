/**
 * Authentication middleware
 * Handles JWT token verification and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../../lib/auth';
import { getUserRoleInProject as getUserRoleInProjectFromDB } from '../../lib/permissions';

export type UserRole = 'owner' | 'admin' | 'collaborator' | 'member' | 'viewer' | null;

export interface AuthRequest extends Request {
  user?: JwtPayload & {
    roleInProject?: UserRole;
    name?: string;
  };
}

/**
 * Middleware to authenticate requests using JWT
 * Verifies the Bearer token in the Authorization header
 */
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
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

/**
 * Middleware to check if user has access to a project
 * This middleware should be used after authenticate middleware
 * It checks if the user is a member of the project and enriches the request with role information
 */
export async function canAccessProject(req: AuthRequest, res: Response, next: NextFunction) {
  console.log('🔐 canAccessProject: Starting access check', {
    method: req.method,
    url: req.url,
    params: req.params,
  });

  // ПРОВЕРКА НА СЛУЧАЙ, ЕСЛИ AUTHENTICATE НЕ СРАБОТАЛ
  if (!req.user) {
    console.log('❌ canAccessProject: No user in request (authenticate middleware not called?)');
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 1. Get project ID and user ID - support both :projectId and :id parameters
    const projectId = req.params.projectId || req.params.id;
    const userId = req.user.sub;

    console.log('🔍 canAccessProject: Checking access', {
      userId,
      projectId,
      userEmail: req.user.email,
    });

    // 2. Basic validation - ensure projectId is provided
    if (!projectId) {
      console.log('❌ canAccessProject: No projectId provided in params');
      return res.status(400).json({ error: 'Bad Request: Project ID is required.' });
    }

    // 3. Check user's role in the project
    console.log('🔎 canAccessProject: Querying getUserRoleInProject...');
    const role = await getUserRoleInProjectFromDB(userId, projectId);
    console.log('📋 canAccessProject: Role result:', { userId, projectId, role });

    // 4. If no role found, user is not a member of the project
    if (!role) {
      console.log('❌ canAccessProject: User is not a member of this project', {
        userId,
        projectId,
      });
      return res.status(403).json({ error: 'Forbidden: You are not a member of this project.' });
    }

    // 5. Enrich request object with role information for use in route handlers
    req.user.roleInProject = role;
    console.log('✅ canAccessProject: Access granted', { userId, projectId, role });
    next();
  } catch (error: any) {
    console.error('💥 canAccessProject: Exception caught:', error);
    res.status(500).json({ error: 'Failed to check project access' });
  }
}
