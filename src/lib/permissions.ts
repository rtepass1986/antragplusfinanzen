import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './prisma';

export interface Permission {
  resource: string;
  action: string;
}

export const PERMISSIONS = {
  // Invoice permissions
  INVOICES_CREATE: { resource: 'invoices', action: 'create' },
  INVOICES_READ: { resource: 'invoices', action: 'read' },
  INVOICES_UPDATE: { resource: 'invoices', action: 'update' },
  INVOICES_DELETE: { resource: 'invoices', action: 'delete' },
  INVOICES_APPROVE: { resource: 'invoices', action: 'approve' },

  // User permissions
  USERS_CREATE: { resource: 'users', action: 'create' },
  USERS_READ: { resource: 'users', action: 'read' },
  USERS_UPDATE: { resource: 'users', action: 'update' },
  USERS_DELETE: { resource: 'users', action: 'delete' },
  USERS_INVITE: { resource: 'users', action: 'invite' },

  // Company permissions
  COMPANY_READ: { resource: 'company', action: 'read' },
  COMPANY_UPDATE: { resource: 'company', action: 'update' },
  COMPANY_DELETE: { resource: 'company', action: 'delete' },

  // Reports permissions
  REPORTS_READ: { resource: 'reports', action: 'read' },
  REPORTS_EXPORT: { resource: 'reports', action: 'export' },

  // Settings permissions
  SETTINGS_READ: { resource: 'settings', action: 'read' },
  SETTINGS_UPDATE: { resource: 'settings', action: 'update' },

  // Bank permissions
  BANK_READ: { resource: 'bank', action: 'read' },
  BANK_UPDATE: { resource: 'bank', action: 'update' },

  // Projects permissions
  PROJECTS_CREATE: { resource: 'projects', action: 'create' },
  PROJECTS_READ: { resource: 'projects', action: 'read' },
  PROJECTS_UPDATE: { resource: 'projects', action: 'update' },
  PROJECTS_DELETE: { resource: 'projects', action: 'delete' },
} as const;

export const ROLE_PERMISSIONS = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_UPDATE,
    PERMISSIONS.INVOICES_DELETE,
    PERMISSIONS.INVOICES_APPROVE,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.BANK_READ,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.PROJECTS_DELETE,
  ],
  ACCOUNTANT: [
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_UPDATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.BANK_READ,
    PERMISSIONS.PROJECTS_READ,
  ],
  APPROVER: [
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_APPROVE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.PROJECTS_READ,
  ],
  EMPLOYEE: [
    PERMISSIONS.INVOICES_CREATE,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.PROJECTS_READ,
  ],
  VIEWER: [
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.PROJECTS_READ,
  ],
} as const;

export async function hasPermission(
  userId: string,
  companyId: string,
  permission: Permission
): Promise<boolean> {
  try {
    // Check if user has direct permission
    const directPermission = await prisma.userPermission.findFirst({
      where: {
        userId,
        companyId,
        permission: {
          resource: permission.resource,
          action: permission.action,
        },
        granted: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (directPermission) {
      return true;
    }

    // Check role-based permissions
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        companyId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    for (const userRole of userRoles) {
      const hasRolePermission = userRole.role.rolePermissions.some(
        (rp) =>
          rp.granted &&
          rp.permission.resource === permission.resource &&
          rp.permission.action === permission.action
      );

      if (hasRolePermission) {
        return true;
      }
    }

    // Check company role permissions
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (userCompany) {
      const rolePermissions = ROLE_PERMISSIONS[userCompany.role as keyof typeof ROLE_PERMISSIONS] || [];
      return rolePermissions.some(
        (p) => p.resource === permission.resource && p.action === permission.action
      );
    }

    return false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

export async function requirePermission(
  userId: string,
  companyId: string,
  permission: Permission
): Promise<void> {
  const hasAccess = await hasPermission(userId, companyId, permission);
  if (!hasAccess) {
    throw new Error('Insufficient permissions');
  }
}

export async function getUserPermissions(
  userId: string,
  companyId: string
): Promise<Permission[]> {
  try {
    const permissions: Permission[] = [];

    // Get direct permissions
    const directPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        companyId,
        granted: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        permission: true,
      },
    });

    permissions.push(
      ...directPermissions.map((dp) => ({
        resource: dp.permission.resource,
        action: dp.permission.action,
      }))
    );

    // Get role-based permissions
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        companyId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    for (const userRole of userRoles) {
      const rolePermissions = userRole.role.rolePermissions
        .filter((rp) => rp.granted)
        .map((rp) => ({
          resource: rp.permission.resource,
          action: rp.permission.action,
        }));

      permissions.push(...rolePermissions);
    }

    // Get company role permissions
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId,
        companyId,
      },
    });

    if (userCompany) {
      const rolePermissions = ROLE_PERMISSIONS[userCompany.role as keyof typeof ROLE_PERMISSIONS] || [];
      permissions.push(...rolePermissions);
    }

    // Remove duplicates
    const uniquePermissions = permissions.filter(
      (permission, index, self) =>
        index ===
        self.findIndex(
          (p) => p.resource === permission.resource && p.action === permission.action
        )
    );

    return uniquePermissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

export async function initializePermissions() {
  try {
    // Create all permissions
    for (const permission of Object.values(PERMISSIONS)) {
      await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permission.resource,
            action: permission.action,
          },
        },
        update: {},
        create: {
          name: `${permission.resource}_${permission.action}`.toUpperCase(),
          description: `${permission.action} ${permission.resource}`,
          resource: permission.resource,
          action: permission.action,
        },
      });
    }

    // Create default roles
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: `Default ${roleName.toLowerCase()} role`,
          isSystem: true,
        },
      });

      // Assign permissions to role
      for (const permission of permissions) {
        const permissionRecord = await prisma.permission.findFirst({
          where: {
            resource: permission.resource,
            action: permission.action,
          },
        });

        if (permissionRecord) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permissionRecord.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permissionRecord.id,
              granted: true,
            },
          });
        }
      }
    }

    console.log('Permissions and roles initialized successfully');
  } catch (error) {
    console.error('Error initializing permissions:', error);
  }
}
