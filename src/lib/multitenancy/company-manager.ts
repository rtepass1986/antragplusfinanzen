import { prisma } from '../prisma';
import { CompanyRole } from '@prisma/client';

interface CompanyCreationData {
  name: string;
  description?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  settings?: CompanySettings;
  ownerId: string;
}

interface CompanySettings {
  defaultCurrency: string;
  fiscalYearStart: number; // Month (1-12)
  timezone: string;
  language: string;
  invoiceSettings: {
    prefix: string;
    nextNumber: number;
    dueDays: number;
    lateFeesEnabled: boolean;
    lateFeesRate?: number;
  };
  approvalWorkflows: {
    enabled: boolean;
    defaultWorkflowId?: string;
    requireApprovalOver?: number;
  };
  integrations: {
    datevEnabled: boolean;
    bankingEnabled: boolean;
    emailImportEnabled: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
  };
  security: {
    mfaRequired: boolean;
    sessionTimeout: number; // minutes
    ipWhitelist?: string[];
  };
}

interface UserInvitation {
  email: string;
  role: CompanyRole;
  permissions?: string[];
  expiresAt: Date;
}

export class CompanyManager {
  
  /**
   * Creates a new company with default settings
   */
  async createCompany(data: CompanyCreationData): Promise<string> {
    const defaultSettings: CompanySettings = {
      defaultCurrency: 'EUR',
      fiscalYearStart: 1, // January
      timezone: 'Europe/Berlin',
      language: 'de',
      invoiceSettings: {
        prefix: 'INV',
        nextNumber: 1000,
        dueDays: 30,
        lateFeesEnabled: false
      },
      approvalWorkflows: {
        enabled: true,
        requireApprovalOver: 1000
      },
      integrations: {
        datevEnabled: true,
        bankingEnabled: false,
        emailImportEnabled: false
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true
      },
      security: {
        mfaRequired: false,
        sessionTimeout: 480 // 8 hours
      }
    };

    const company = await prisma.company.create({
      data: {
        name: data.name,
        description: data.description,
        taxId: data.taxId,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        settings: { ...defaultSettings, ...data.settings } as any
      }
    });

    // Add owner to company
    await prisma.userCompany.create({
      data: {
        userId: data.ownerId,
        companyId: company.id,
        role: CompanyRole.OWNER
      }
    });

    // Create default categories
    await this.createDefaultCategories(company.id);

    // Create default approval workflow
    await this.createDefaultApprovalWorkflow(company.id);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        userId: data.ownerId,
        action: 'COMPANY_CREATED',
        entity: 'Company',
        entityId: company.id,
        newValue: {
          name: company.name,
          settings: company.settings
        }
      }
    });

    return company.id;
  }

  /**
   * Switches user context to a different company
   */
  async switchCompanyContext(userId: string, companyId: string): Promise<{ success: boolean; permissions?: string[] }> {
    // Verify user has access to company
    const userCompany = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId
        }
      },
      include: {
        company: true
      }
    });

    if (!userCompany || !userCompany.isActive) {
      return { success: false };
    }

    // Get user permissions for this company
    const permissions = this.getPermissionsForRole(userCompany.role);

    // Log context switch
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'CONTEXT_SWITCH',
        entity: 'User',
        entityId: userId,
        metadata: {
          previousContext: 'N/A', // Could track previous context
          newContext: companyId,
          role: userCompany.role
        }
      }
    });

    return { success: true, permissions };
  }

  /**
   * Invites a user to join a company
   */
  async inviteUser(
    companyId: string, 
    invitedBy: string, 
    invitation: UserInvitation
  ): Promise<string> {
    // Check if inviter has permission to invite users
    const inviterRole = await this.getUserRole(invitedBy, companyId);
    if (!this.canInviteUsers(inviterRole)) {
      throw new Error('Insufficient permissions to invite users');
    }

    // Check if user already exists in company
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      include: {
        companies: {
          where: { companyId }
        }
      }
    });

    if (existingUser && existingUser.companies.length > 0) {
      throw new Error('User already exists in this company');
    }

    // Create invitation token
    const invitationToken = this.generateInvitationToken();
    
    // Store invitation (using a separate table in practice)
    const invitationRecord = await prisma.auditLog.create({
      data: {
        companyId,
        userId: invitedBy,
        action: 'USER_INVITED',
        entity: 'Invitation',
        entityId: invitationToken,
        metadata: {
          inviteeEmail: invitation.email,
          role: invitation.role,
          permissions: invitation.permissions,
          expiresAt: invitation.expiresAt.toISOString()
        }
      }
    });

    // Send invitation email (would integrate with email service)
    await this.sendInvitationEmail(invitation.email, invitationToken, companyId);

    return invitationToken;
  }

  /**
   * Accepts a company invitation
   */
  async acceptInvitation(invitationToken: string, userId: string): Promise<boolean> {
    // Find invitation
    const invitation = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_INVITED',
        entityId: invitationToken
      },
      include: {
        company: true
      }
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    const metadata = invitation.metadata as any;
    
    // Check if invitation is still valid
    if (new Date() > new Date(metadata.expiresAt)) {
      throw new Error('Invitation has expired');
    }

    // Verify email matches
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.email !== metadata.inviteeEmail) {
      throw new Error('Email does not match invitation');
    }

    // Add user to company
    await prisma.userCompany.create({
      data: {
        userId,
        companyId: invitation.companyId,
        role: metadata.role
      }
    });

    // Mark invitation as accepted
    await prisma.auditLog.create({
      data: {
        companyId: invitation.companyId,
        userId,
        action: 'INVITATION_ACCEPTED',
        entity: 'Invitation',
        entityId: invitationToken,
        metadata: {
          acceptedAt: new Date().toISOString()
        }
      }
    });

    return true;
  }

  /**
   * Updates user role in a company
   */
  async updateUserRole(
    companyId: string, 
    targetUserId: string, 
    newRole: CompanyRole,
    updatedBy: string
  ): Promise<boolean> {
    // Check permissions
    const updaterRole = await this.getUserRole(updatedBy, companyId);
    if (!this.canManageUsers(updaterRole)) {
      throw new Error('Insufficient permissions to update user roles');
    }

    // Can't change owner role
    const targetUserRole = await this.getUserRole(targetUserId, companyId);
    if (targetUserRole === CompanyRole.OWNER) {
      throw new Error('Cannot change owner role');
    }

    const oldUserCompany = await prisma.userCompany.update({
      where: {
        userId_companyId: {
          userId: targetUserId,
          companyId
        }
      },
      data: {
        role: newRole
      }
    });

    // Log role change
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: updatedBy,
        action: 'ROLE_UPDATED',
        entity: 'UserCompany',
        entityId: oldUserCompany.id,
        oldValue: { role: targetUserRole },
        newValue: { role: newRole },
        metadata: {
          targetUserId,
          updatedBy
        }
      }
    });

    return true;
  }

  /**
   * Removes user from company
   */
  async removeUser(
    companyId: string, 
    targetUserId: string, 
    removedBy: string
  ): Promise<boolean> {
    // Check permissions
    const removerRole = await this.getUserRole(removedBy, companyId);
    if (!this.canManageUsers(removerRole)) {
      throw new Error('Insufficient permissions to remove users');
    }

    // Can't remove owner
    const targetUserRole = await this.getUserRole(targetUserId, companyId);
    if (targetUserRole === CompanyRole.OWNER) {
      throw new Error('Cannot remove company owner');
    }

    // Deactivate user instead of deleting (for audit purposes)
    await prisma.userCompany.update({
      where: {
        userId_companyId: {
          userId: targetUserId,
          companyId
        }
      },
      data: {
        isActive: false
      }
    });

    // Log user removal
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: removedBy,
        action: 'USER_REMOVED',
        entity: 'UserCompany',
        entityId: targetUserId,
        metadata: {
          targetUserId,
          targetUserRole,
          removedBy
        }
      }
    });

    return true;
  }

  /**
   * Gets all companies a user belongs to
   */
  async getUserCompanies(userId: string) {
    return await prisma.userCompany.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            description: true,
            settings: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  /**
   * Gets all users in a company
   */
  async getCompanyUsers(companyId: string) {
    return await prisma.userCompany.findMany({
      where: {
        companyId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' }
      ]
    });
  }

  /**
   * Updates company settings
   */
  async updateCompanySettings(
    companyId: string, 
    settings: Partial<CompanySettings>,
    updatedBy: string
  ): Promise<boolean> {
    // Check permissions
    const userRole = await this.getUserRole(updatedBy, companyId);
    if (!this.canManageCompanySettings(userRole)) {
      throw new Error('Insufficient permissions to update company settings');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const currentSettings = company.settings as CompanySettings;
    const newSettings = { ...currentSettings, ...settings };

    await prisma.company.update({
      where: { id: companyId },
      data: {
        settings: newSettings as any
      }
    });

    // Log settings change
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: updatedBy,
        action: 'SETTINGS_UPDATED',
        entity: 'Company',
        entityId: companyId,
        oldValue: currentSettings,
        newValue: newSettings
      }
    });

    return true;
  }

  /**
   * Archives/deactivates a company
   */
  async archiveCompany(companyId: string, archivedBy: string): Promise<boolean> {
    // Only owner can archive company
    const userRole = await this.getUserRole(archivedBy, companyId);
    if (userRole !== CompanyRole.OWNER) {
      throw new Error('Only company owner can archive the company');
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        isActive: false
      }
    });

    // Log archival
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: archivedBy,
        action: 'COMPANY_ARCHIVED',
        entity: 'Company',
        entityId: companyId,
        metadata: {
          archivedAt: new Date().toISOString()
        }
      }
    });

    return true;
  }

  /**
   * Creates default categories for a new company
   */
  private async createDefaultCategories(companyId: string): Promise<void> {
    const defaultCategories = [
      // Income categories
      { name: 'Sales Revenue', type: 'INCOME', color: '#10B981' },
      { name: 'Service Revenue', type: 'INCOME', color: '#059669' },
      { name: 'Other Income', type: 'INCOME', color: '#047857' },
      
      // Expense categories
      { name: 'Office Supplies', type: 'EXPENSE', color: '#EF4444' },
      { name: 'Travel & Entertainment', type: 'EXPENSE', color: '#DC2626' },
      { name: 'Professional Services', type: 'EXPENSE', color: '#B91C1C' },
      { name: 'Utilities', type: 'EXPENSE', color: '#991B1B' },
      { name: 'Marketing', type: 'EXPENSE', color: '#7F1D1D' },
    ];

    await prisma.category.createMany({
      data: defaultCategories.map(cat => ({
        companyId,
        ...cat
      }))
    });
  }

  /**
   * Creates default approval workflow
   */
  private async createDefaultApprovalWorkflow(companyId: string): Promise<void> {
    await prisma.approvalWorkflow.create({
      data: {
        companyId,
        name: 'Default Invoice Approval',
        description: 'Standard approval process for invoices',
        conditions: [
          {
            field: 'totalAmount',
            operator: 'greater_than',
            value: 1000
          }
        ] as any,
        steps: [
          {
            id: 'step_1',
            name: 'Manager Approval',
            approvers: [], // Will be populated when managers are added
            requireAll: false
          }
        ] as any
      }
    });
  }

  /**
   * Gets user's role in a company
   */
  private async getUserRole(userId: string, companyId: string): Promise<CompanyRole | null> {
    const userCompany = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId
        }
      }
    });

    return userCompany?.role || null;
  }

  /**
   * Permission checking methods
   */
  private canInviteUsers(role: CompanyRole | null): boolean {
    return role === CompanyRole.OWNER || role === CompanyRole.ADMIN;
  }

  private canManageUsers(role: CompanyRole | null): boolean {
    return role === CompanyRole.OWNER || role === CompanyRole.ADMIN;
  }

  private canManageCompanySettings(role: CompanyRole | null): boolean {
    return role === CompanyRole.OWNER || role === CompanyRole.ADMIN;
  }

  /**
   * Gets permissions for a role
   */
  private getPermissionsForRole(role: CompanyRole): string[] {
    const permissions = {
      [CompanyRole.OWNER]: [
        'company.manage',
        'users.manage',
        'invoices.manage',
        'expenses.manage',
        'reports.view',
        'integrations.manage',
        'settings.manage'
      ],
      [CompanyRole.ADMIN]: [
        'users.invite',
        'invoices.manage',
        'expenses.manage',
        'reports.view',
        'integrations.manage',
        'settings.view'
      ],
      [CompanyRole.ACCOUNTANT]: [
        'invoices.manage',
        'expenses.manage',
        'reports.view',
        'integrations.use'
      ],
      [CompanyRole.APPROVER]: [
        'invoices.approve',
        'expenses.approve',
        'reports.view'
      ],
      [CompanyRole.EMPLOYEE]: [
        'invoices.view',
        'expenses.create',
        'reports.view'
      ],
      [CompanyRole.VIEWER]: [
        'invoices.view',
        'expenses.view',
        'reports.view'
      ]
    };

    return permissions[role] || [];
  }

  private generateInvitationToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private async sendInvitationEmail(email: string, token: string, companyId: string): Promise<void> {
    // Integration point for email service
    console.log(`Sending invitation email to ${email} with token ${token} for company ${companyId}`);
  }
}

export const companyManager = new CompanyManager();