import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Find the invitation
    const invitation = await prisma.companyInvitation.findUnique({
      where: { token: params.token },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invitation is no longer valid' },
        { status: 400 }
      );
    }

    // Update invitation status to declined
    await prisma.companyInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
      },
    });

    return NextResponse.json({
      message: 'Invitation declined successfully',
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
