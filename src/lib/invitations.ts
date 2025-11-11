/**
 * Invitation management utilities
 * Handles invitation creation, validation, and acceptance
 */

import crypto from 'crypto';
import prisma from '../server/db';
import { canInviteUsers } from './permissions';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * Generate a secure random token for invitation
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate expiration date (72 hours from now)
 */
export function getExpirationDate(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  return expiresAt;
}

/**
 * Check if invitation is expired
 */
export function isInvitationExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}

/**
 * Create a new invitation
 * Only project owners can create invitations
 */
export async function createInvitation(
  projectId: string,
  email: string,
  role: 'collaborator' | 'member' | 'viewer',
  invitedByUserId: string
): Promise<any> {
  // Check if user can invite
  const canInvite = await canInviteUsers(invitedByUserId, projectId);
  if (!canInvite) {
    throw new Error('You do not have permission to invite users to this project');
  }

  // Validate role (cannot invite as owner)
  if (role === 'owner') {
    throw new Error('Cannot invite users as owner. Use member management to promote existing members.');
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
    throw new Error('User is already a member of this project');
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
    throw new Error('There is already a pending invitation for this email');
  }

  // Create invitation
  const token = generateInvitationToken();
  const expiresAt = getExpirationDate();

  const invitation = await prisma.invitation.create({
    data: {
      projectId,
      email: email.toLowerCase(),
      role,
      token,
      status: 'pending',
      expiresAt,
      invitedByUserId,
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

  return invitation;
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<any | null> {
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
    return null;
  }

  // Check if expired
  if (isInvitationExpired(invitation.expiresAt) && invitation.status === 'pending') {
    // Update status to expired
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'expired' },
    });
    return { ...invitation, status: 'expired' };
  }

  return invitation;
}

/**
 * Get invitation by ID
 */
export async function getInvitationById(invitationId: string): Promise<any | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
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

  return invitation;
}

/**
 * Get all invitations for a project
 */
export async function getProjectInvitations(
  projectId: string,
  userId: string
): Promise<any[]> {
  // Check if user can view invitations (must be owner)
  const canView = await canInviteUsers(userId, projectId);
  if (!canView) {
    throw new Error('You do not have permission to view invitations');
  }

  const invitations = await prisma.invitation.findMany({
    where: { projectId },
    include: {
      invitedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Update expired invitations
  const now = new Date();
  for (const invitation of invitations) {
    if (
      invitation.status === 'pending' &&
      isInvitationExpired(invitation.expiresAt)
    ) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      invitation.status = 'expired';
    }
  }

  return invitations;
}

/**
 * Get pending invitations for a user by email
 */
export async function getUserPendingInvitations(email: string): Promise<any[]> {
  const invitations = await prisma.invitation.findMany({
    where: {
      email: email.toLowerCase(),
      status: 'pending',
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
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Filter out expired invitations
  const validInvitations = invitations.filter(
    (inv) => !isInvitationExpired(inv.expiresAt)
  );

  // Mark expired ones
  const expiredInvitations = invitations.filter((inv) =>
    isInvitationExpired(inv.expiresAt)
  );

  for (const inv of expiredInvitations) {
    await prisma.invitation.update({
      where: { id: inv.id },
      data: { status: 'expired' },
    });
  }

  return validInvitations;
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string
): Promise<any> {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Invitation is ${invitation.status}`);
  }

  if (isInvitationExpired(invitation.expiresAt)) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'expired' },
    });
    throw new Error('Invitation has expired');
  }

  // Check if email matches
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error('This invitation was sent to a different email address');
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
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });
    throw new Error('You are already a member of this project');
  }

  // Add user as project member
  const member = await prisma.projectMember.create({
    data: {
      userId,
      projectId: invitation.projectId,
      role: invitation.role,
    },
  });

  // Update invitation status
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
    },
  });

  return {
    member,
    project: invitation.project,
  };
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const invitation = await getInvitationById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check if user can revoke (must be owner)
  const canRevoke = await canInviteUsers(userId, invitation.projectId);
  if (!canRevoke) {
    throw new Error('You do not have permission to revoke this invitation');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Can only revoke pending invitations');
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'revoked' },
  });
}

/**
 * Resend an invitation (creates new token)
 */
export async function resendInvitation(
  invitationId: string,
  userId: string
): Promise<any> {
  const invitation = await getInvitationById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check if user can resend (must be owner)
  const canResend = await canInviteUsers(userId, invitation.projectId);
  if (!canResend) {
    throw new Error('You do not have permission to resend this invitation');
  }

  if (invitation.status !== 'pending' && invitation.status !== 'expired') {
    throw new Error('Can only resend pending or expired invitations');
  }

  // Generate new token and expiration
  const newToken = generateInvitationToken();
  const newExpiresAt = getExpirationDate();

  const updatedInvitation = await prisma.invitation.update({
    where: { id: invitationId },
    data: {
      token: newToken,
      expiresAt: newExpiresAt,
      status: 'pending',
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

  return updatedInvitation;
}
