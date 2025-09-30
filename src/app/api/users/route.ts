import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's companies
    const userCompanies = await prisma.userCompany.findMany({
      where: { userId: session.user.id },
      include: { company: true },
    });

    const companyIds = userCompanies.map(uc => uc.companyId);

    // Get all users from these companies
    const users = await prisma.user.findMany({
      where: {
        companies: {
          some: {
            companyId: { in: companyIds },
          },
        },
      },
      include: {
        companies: {
          include: {
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      department: user.department,
      jobTitle: user.jobTitle,
      companies: user.companies
        .filter(uc => companyIds.includes(uc.companyId))
        .map(uc => ({
          id: uc.company.id,
          name: uc.company.name,
          role: uc.role,
        })),
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
