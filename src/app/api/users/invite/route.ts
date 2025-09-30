import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role, companyId } = await request.json();

    // Validate required fields
    if (!email || !role || !companyId) {
      return NextResponse.json(
        { error: 'Email, role, and company are required' },
        { status: 400 }
      );
    }

    // Check if user has permission to invite to this company
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId: companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!userCompany) {
      return NextResponse.json(
        { error: 'You do not have permission to invite users to this company' },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    // Check if invitation already exists
    const existingInvitation = await prisma.companyInvitation.findFirst({
      where: {
        email,
        companyId,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 409 }
      );
    }

    // Create invitation
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const invitation = await prisma.companyInvitation.create({
      data: {
        companyId,
        email,
        role: role as any,
        token,
        invitedBy: session.user.id,
        invitedUserId: existingUser?.id,
        expiresAt,
      },
    });

    // TODO: Send email invitation
    // For now, we'll just return the invitation token
    // In production, you would send an email with the invitation link

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        // In development, include the token for testing
        ...(process.env.NODE_ENV === 'development' && { token }),
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
