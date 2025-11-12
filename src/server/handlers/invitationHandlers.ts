/**
 * Invitation handlers - Unified token-based invitation system
 * These handlers ensure all invitation operations use token as public identifier
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { prisma } from '../db';
import * as crypto from 'crypto';
import { 
  emitInviteReceived, 
  emitInviteAccepted,
  emitProjectMemberAdded 
} from '../websocket.js';
import emailService from '../../lib/email.js';

// --- СОЗДАНИЕ ПРИГЛАШЕНИЯ (CREATE INVITATION) ---
export async function createInvitation(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;
    const { email, role } = req.body;
    const userId = req.user!.sub;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    // Validate role
    if (!['collaborator', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be collaborator, member, or viewer' 
      });
    }

    // Check if user has permission to invite (must be owner)
    const member = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (!member || member.role !== 'owner') {
      return res.status(403).json({ 
        error: 'You do not have permission to invite users to this project' 
      });
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        user: {
          email: email.toLowerCase(),
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({ 
        error: 'User is already a member of this project' 
      });
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        projectId,
        email: email.toLowerCase(),
        status: 'pending',
      },
    });

    if (existingInvitation) {
      return res.status(400).json({ 
        error: 'There is already a pending invitation for this email' 
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiration (72 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        projectId,
        email: email.toLowerCase(),
        role,
        token,
        status: 'pending',
        expiresAt,
        invitedByUserId: userId,
      },
      include: {
        project: true,
        invitedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Generate invitation link
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const invitationLink = `${appUrl}/invite/${invitation.token}`;

    // Find user by email to send notification (if they have an account)
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    // Emit WebSocket event if user exists (for real-time notification)
    if (invitedUser) {
      emitInviteReceived({
        token: invitation.token,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        projectId: invitation.projectId,
        projectName: invitation.project.name,
        link: invitationLink,
      }, invitedUser.id);
    }

    // Send invitation email
    try {
      const inviterUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      
      await emailService.sendProjectInvitationEmail(
        invitation.email,
        invitation.project.name,
        inviterUser?.name || 'Пользователь',
        invitation.role,
        invitation.token,
        invitation.expiresAt.toISOString()
      );
      
      console.log('✅ Invitation email sent to:', invitation.email);
    } catch (emailError) {
      console.error('❌ Failed to send invitation email:', emailError);
      // Не прерываем процесс, если email не отправился
    }

    // Return invitation with token (not id) as the public identifier
    res.status(201).json({
      invitation: {
        token: invitation.token, // Use token as public identifier
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        link: invitationLink,
        projectName: invitation.project.name,
      },
    });
  } catch (error: any) {
    console.error('Create invitation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create invitation' 
    });
  }
}

// --- ПОЛУЧЕНИЕ ПРИГЛАШЕНИЯ ПО ТОКЕНУ (GET INVITATION BY TOKEN) ---
export async function getInvitationByToken(req: Request, res: Response) {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        project: true,
        invitedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if expired
    const now = new Date();
    if (invitation.status === 'pending' && invitation.expiresAt < now) {
      // Update status to expired
      await prisma.invitation.update({
        where: { token },
        data: { status: 'expired' },
      });

      return res.status(410).json({ 
        error: 'Invitation has expired',
        invitation: {
          projectName: invitation.project.name,
          role: invitation.role,
          status: 'expired',
        },
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        error: `Invitation is ${invitation.status}`,
        invitation: {
          projectName: invitation.project.name,
          role: invitation.role,
          status: invitation.status,
        },
      });
    }

    res.json({
      invitation: {
        token: invitation.token, // Return token, not id
        projectId: invitation.projectId,
        projectName: invitation.project.name,
        projectColor: invitation.project.color,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        invitedBy: invitation.invitedByUser,
      },
    });
  } catch (error: any) {
    console.error('Get invitation by token error:', error);
    res.status(500).json({ error: 'Failed to get invitation' });
  }
}

// --- ПРИНЯТИЕ ПРИГЛАШЕНИЯ ПО ТОКЕНУ (ACCEPT INVITATION BY TOKEN) ---
export async function acceptInvitation(req: AuthRequest, res: Response) {
  try {
    const { token } = req.params; // Use token from URL params
    const userId = req.user!.sub;

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get invitation by token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        project: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        error: `Invitation is ${invitation.status}` 
      });
    }

    // Check if expired
    const now = new Date();
    if (invitation.expiresAt < now) {
      await prisma.invitation.update({
        where: { token },
        data: { status: 'expired' },
      });
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if email matches
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ 
        error: 'This invitation was sent to a different email address' 
      });
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: invitation.projectId,
        },
      },
    });

    if (existingMember) {
      // Update invitation status
      await prisma.invitation.update({
        where: { token },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
      return res.status(400).json({ 
        error: 'You are already a member of this project' 
      });
    }

    // Add user as project member
    const member = await prisma.projectMember.create({
      data: {
        userId,
        projectId: invitation.projectId,
        role: invitation.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Update invitation status
    await prisma.invitation.update({
      where: { token },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    // Emit WebSocket events for real-time synchronization
    emitInviteAccepted(token, invitation.projectId, userId);
    emitProjectMemberAdded(invitation.projectId, member);

    res.json({
      message: 'Invitation accepted successfully',
      project: {
        id: invitation.project.id,
        name: invitation.project.name,
        color: invitation.project.color,
      },
      member: {
        role: member.role,
      },
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to accept invitation' 
    });
  }
}
