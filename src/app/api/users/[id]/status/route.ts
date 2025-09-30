import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isActive } = await request.json();
    const userId = params.id;

    // Check if user has permission to modify this user
    // Get all companies where the current user is admin/owner
    const userCompanies = await prisma.userCompany.findMany({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { companyId: true },
    });

    const companyIds = userCompanies.map(uc => uc.companyId);

    // Check if the target user belongs to any of these companies
    const targetUserCompany = await prisma.userCompany.findFirst({
      where: {
        userId: userId,
        companyId: { in: companyIds },
      },
    });

    if (!targetUserCompany) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this user' },
        { status: 403 }
      );
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        companyId: targetUserCompany.companyId,
        userId: session.user.id,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity: 'User',
        entityId: userId,
        newValue: { isActive },
      },
    });

    return NextResponse.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: updatedUser.id,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
