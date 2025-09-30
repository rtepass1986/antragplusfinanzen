import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();

    // Verify the user ID matches the session
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the invitation
    const invitation = await prisma.companyInvitation.findUnique({
      where: { token: params.token },
      include: {
        company: true,
      },
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

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if user already belongs to this company
    const existingMembership = await prisma.userCompany.findFirst({
      where: {
        userId: userId,
        companyId: invitation.companyId,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of this company' },
        { status: 400 }
      );
    }

    // Accept the invitation in a transaction
    const result = await prisma.$transaction(async tx => {
      // Create user-company relationship
      const userCompany = await tx.userCompany.create({
        data: {
          userId: userId,
          companyId: invitation.companyId,
          role: invitation.role as any,
          isActive: true,
          invitedAt: invitation.createdAt,
          invitedBy: invitation.invitedBy,
        },
      });

      // Update invitation status
      const updatedInvitation = await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: userId,
        },
      });

      // Grant default permissions based on role
      const permissions = await tx.permission.findMany({
        where: {
          OR: [
            { resource: 'invoices' },
            { resource: 'users' },
            { resource: 'reports' },
            { resource: 'settings' },
            { resource: 'company' },
          ],
        },
      });

      // Grant permissions based on role
      const rolePermissions = {
        OWNER: permissions,
        ADMIN: permissions.filter(
          p =>
            !['company_delete', 'users_delete'].includes(
              `${p.resource}_${p.action}`
            )
        ),
        ACCOUNTANT: permissions.filter(p =>
          ['invoices', 'reports', 'bank'].includes(p.resource)
        ),
        APPROVER: permissions.filter(p =>
          ['invoices_read', 'invoices_approve'].includes(
            `${p.resource}_${p.action}`
          )
        ),
        EMPLOYEE: permissions.filter(p =>
          ['invoices_create', 'invoices_read'].includes(
            `${p.resource}_${p.action}`
          )
        ),
        VIEWER: permissions.filter(p =>
          ['invoices_read', 'reports_read'].includes(
            `${p.resource}_${p.action}`
          )
        ),
      };

      const userPermissions =
        rolePermissions[invitation.role as keyof typeof rolePermissions] || [];

      for (const permission of userPermissions) {
        await tx.userPermission.create({
          data: {
            userId: userId,
            companyId: invitation.companyId,
            permissionId: permission.id,
            granted: true,
            grantedBy: invitation.invitedBy,
          },
        });
      }

      // Log the action
      await tx.auditLog.create({
        data: {
          companyId: invitation.companyId,
          userId: userId,
          action: 'USER_JOINED_COMPANY',
          entity: 'UserCompany',
          entityId: userCompany.id,
          newValue: {
            role: invitation.role,
            isActive: true,
          },
        },
      });

      return { userCompany, updatedInvitation };
    });

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
      },
      role: invitation.role,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
