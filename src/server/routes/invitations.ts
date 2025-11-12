/**
 * Invitation endpoints for access control system
 * These endpoints handle project invitations using token-based identification
 */

import { Router, Request, Response } from 'express';
import { AuthRequest } from '../types';
import {
  createInvitation as createInvitationHandler,
  getInvitationByToken as getInvitationByTokenHandler,
  acceptInvitation as acceptInvitationHandler,
} from '../handlers/invitationHandlers';
import {
  getProjectInvitations,
  getUserPendingInvitations,
  revokeInvitation,
  resendInvitation,
} from '../../lib/invitations';
import emailService from '../../lib/email';
import prisma from '../db';

const router = Router();

/**
 * POST /api/projects/:projectId/invitations
 * Create a new invitation (Owner only)
 * Uses unified handler that returns token as public identifier
 */
router.post('/:projectId/invitations', createInvitationHandler);

/**
 * GET /api/projects/:projectId/invitations
 * Get all invitations for a project (Owner only)
 */
router.get('/:projectId/invitations', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.sub;

    const invitations = await getProjectInvitations(projectId, userId);

    // Add invitation links
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const invitationsWithLinks = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      acceptedAt: inv.acceptedAt,
      invitedBy: inv.invitedByUser,
      link: inv.status === 'pending' ? `${appUrl}/invite?token=${inv.token}` : null,
    }));

    res.json({ invitations: invitationsWithLinks });
  } catch (error: any) {
    console.error('Get invitations error:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({ 
      error: error.message || 'Failed to get invitations' 
    });
  }
});

/**
 * GET /api/invitations/my-invitations
 * Get pending invitations for current user
 */
router.get('/my-invitations', async (req: AuthRequest, res: Response) => {
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

    const invitations = await getUserPendingInvitations(user.email);

    res.json({ invitations });
  } catch (error: any) {
    console.error('Get my invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

/**
 * GET /api/invitations/token/:token
 * Get invitation details by token (for invite acceptance page)
 * Uses unified handler
 */
router.get('/token/:token', getInvitationByTokenHandler);

/**
 * POST /api/invitations/:token/accept
 * Accept an invitation using token (unified approach)
 * Uses unified handler with token from URL params
 */
router.post('/:token/accept', acceptInvitationHandler);

/**
 * DELETE /api/invitations/:invitationId
 * Revoke an invitation (Owner only)
 */
router.delete('/:invitationId', async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user!.sub;

    await revokeInvitation(invitationId, userId);

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error: any) {
    console.error('Revoke invitation error:', error);
    res.status(error.message.includes('permission') ? 403 : 400).json({ 
      error: error.message || 'Failed to revoke invitation' 
    });
  }
});

/**
 * POST /api/invitations/:invitationId/resend
 * Resend an invitation (Owner only)
 */
router.post('/:invitationId/resend', async (req: AuthRequest, res: Response) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user!.sub;

    const invitation = await resendInvitation(invitationId, userId);

    // Generate new invitation link
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const invitationLink = `${appUrl}/invite?token=${invitation.token}`;

    // Send new invitation email
    try {
      await emailService.sendProjectInvitationEmail(
        invitation.email,
        invitation.project.name,
        invitation.invitedByUser?.name || 'A team member',
        invitation.role,
        invitation.token,
        invitation.expiresAt.toISOString()
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
    }

    res.json({
      message: 'Invitation resent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        link: invitationLink,
      },
    });
  } catch (error: any) {
    console.error('Resend invitation error:', error);
    res.status(error.message.includes('permission') ? 403 : 400).json({ 
      error: error.message || 'Failed to resend invitation' 
    });
  }
});

export default router;
