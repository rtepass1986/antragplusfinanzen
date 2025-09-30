/**
 * MULTI-COMPANY MANAGEMENT TESTS
 * Tests tenant isolation and company switching functionality
 */

import { MultiCompanyManager } from '../src/lib/multi-company/manager';
import { prisma } from '../src/lib/prisma';

jest.mock('../src/lib/prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('🏢 Multi-Company Management', () => {
  let multiCompanyManager: MultiCompanyManager;

  beforeEach(() => {
    multiCompanyManager = new MultiCompanyManager();
    jest.clearAllMocks();
  });

  describe('Tenant Isolation', () => {
    test('should isolate data between companies', async () => {
      const mockUser = {
        id: 'user-1',
        companies: [
          { companyId: 'comp-1', role: 'ADMIN' },
          { companyId: 'comp-2', role: 'VIEWER' }
        ]
      };

      const mockCompany1Invoices = [
        { id: 'inv-1', companyId: 'comp-1', invoiceNumber: 'INV-001' },
        { id: 'inv-2', companyId: 'comp-1', invoiceNumber: 'INV-002' }
      ];

      const mockCompany2Invoices = [
        { id: 'inv-3', companyId: 'comp-2', invoiceNumber: 'INV-003' }
      ];

      mockPrisma.invoice.findMany
        .mockResolvedValueOnce(mockCompany1Invoices)
        .mockResolvedValueOnce(mockCompany2Invoices);

      const comp1Invoices = await multiCompanyManager.getCompanyInvoices('comp-1', 'user-1');
      const comp2Invoices = await multiCompanyManager.getCompanyInvoices('comp-2', 'user-1');

      expect(comp1Invoices).toHaveLength(2);
      expect(comp2Invoices).toHaveLength(1);
      expect(comp1Invoices[0].companyId).toBe('comp-1');
      expect(comp2Invoices[0].companyId).toBe('comp-2');
    });

    test('should prevent cross-company data access', async () => {
      mockPrisma.userCompany.findUnique.mockResolvedValue(null);

      await expect(
        multiCompanyManager.getCompanyInvoices('unauthorized-comp', 'user-1')
      ).rejects.toThrow('Access denied to company');

      expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    });

    test('should validate user permissions for company operations', async () => {
      const mockUserCompany = {
        userId: 'user-1',
        companyId: 'comp-1',
        role: 'VIEWER',
        isActive: true
      };

      mockPrisma.userCompany.findUnique.mockResolvedValue(mockUserCompany);

      const hasWriteAccess = await multiCompanyManager.hasWritePermission('user-1', 'comp-1');
      const hasReadAccess = await multiCompanyManager.hasReadPermission('user-1', 'comp-1');

      expect(hasWriteAccess).toBe(false);
      expect(hasReadAccess).toBe(true);
    });
  });

  describe('Company Creation and Setup', () => {
    test('should create new company with owner', async () => {
      const mockCompany = {
        id: 'new-comp',
        name: 'New Company LLC',
        taxId: 'DE123456789',
        settings: {
          defaultCurrency: 'EUR',
          fiscalYearStart: 1,
          timezone: 'Europe/Berlin'
        }
      };

      const mockUserCompany = {
        userId: 'user-1',
        companyId: 'new-comp',
        role: 'OWNER',
        isActive: true
      };

      mockPrisma.company.create.mockResolvedValue(mockCompany);
      mockPrisma.userCompany.create.mockResolvedValue(mockUserCompany);
      mockPrisma.category.createMany.mockResolvedValue({ count: 10 });

      const result = await multiCompanyManager.createCompany({
        name: 'New Company LLC',
        taxId: 'DE123456789',
        currency: 'EUR',
        ownerId: 'user-1'
      });

      expect(result.id).toBe('new-comp');
      expect(mockPrisma.userCompany.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          companyId: 'new-comp',
          role: 'OWNER',
          isActive: true
        }
      });
      expect(mockPrisma.category.createMany).toHaveBeenCalled(); // Default categories
    });

    test('should initialize company with default settings', async () => {
      const defaultSettings = {
        defaultCurrency: 'EUR',
        fiscalYearStart: 1,
        timezone: 'Europe/Berlin',
        invoiceNumberFormat: 'INV-{YYYY}-{####}',
        paymentTerms: 30,
        vatRate: 19
      };

      mockPrisma.company.create.mockResolvedValue({
        id: 'comp-1',
        settings: defaultSettings
      });

      await multiCompanyManager.createCompany({
        name: 'Test Company',
        ownerId: 'user-1'
      });

      expect(mockPrisma.company.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          settings: expect.objectContaining(defaultSettings)
        })
      });
    });

    test('should set up default approval workflows', async () => {
      const mockWorkflows = [
        {
          name: 'Low Value Auto-Approval',
          conditions: [{ field: 'totalAmount', operator: 'less_than', value: 500 }],
          steps: [{ name: 'Auto Approve', autoApprove: true }]
        },
        {
          name: 'Standard Approval',
          conditions: [{ field: 'totalAmount', operator: 'greater_than', value: 500 }],
          steps: [{ name: 'Manager Approval', approvers: [] }]
        }
      ];

      mockPrisma.approvalWorkflow.createMany.mockResolvedValue({ count: 2 });

      await multiCompanyManager.setupDefaultWorkflows('comp-1');

      expect(mockPrisma.approvalWorkflow.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Low Value Auto-Approval',
            companyId: 'comp-1'
          })
        ])
      });
    });
  });

  describe('User Invitation and Management', () => {
    test('should invite user to company', async () => {
      const mockInvitation = {
        id: 'inv-1',
        email: 'newuser@example.com',
        companyId: 'comp-1',
        invitedBy: 'user-1',
        role: 'ACCOUNTANT',
        token: 'secure-token-123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      mockPrisma.invitation.create.mockResolvedValue(mockInvitation);

      const result = await multiCompanyManager.inviteUser({
        email: 'newuser@example.com',
        companyId: 'comp-1',
        role: 'ACCOUNTANT',
        invitedBy: 'user-1'
      });

      expect(result.token).toBe('secure-token-123');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.invitation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newuser@example.com',
          role: 'ACCOUNTANT'
        })
      });
    });

    test('should accept invitation and create user company relationship', async () => {
      const mockInvitation = {
        id: 'inv-1',
        email: 'newuser@example.com',
        companyId: 'comp-1',
        role: 'ACCOUNTANT',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isUsed: false
      };

      const mockUserCompany = {
        userId: 'user-2',
        companyId: 'comp-1',
        role: 'ACCOUNTANT',
        isActive: true
      };

      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.userCompany.create.mockResolvedValue(mockUserCompany);
      mockPrisma.invitation.update.mockResolvedValue({
        ...mockInvitation,
        isUsed: true
      });

      const result = await multiCompanyManager.acceptInvitation('secure-token-123', 'user-2');

      expect(result.success).toBe(true);
      expect(mockPrisma.userCompany.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-2',
          companyId: 'comp-1',
          role: 'ACCOUNTANT',
          isActive: true
        }
      });
    });

    test('should reject expired invitations', async () => {
      const mockExpiredInvitation = {
        id: 'inv-1',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        isUsed: false
      };

      mockPrisma.invitation.findUnique.mockResolvedValue(mockExpiredInvitation);

      await expect(
        multiCompanyManager.acceptInvitation('expired-token', 'user-2')
      ).rejects.toThrow('Invitation has expired');
    });
  });

  describe('Company Switching', () => {
    test('should switch user context between companies', async () => {
      const mockUserCompanies = [
        { companyId: 'comp-1', role: 'ADMIN', isActive: true },
        { companyId: 'comp-2', role: 'VIEWER', isActive: true }
      ];

      mockPrisma.userCompany.findMany.mockResolvedValue(mockUserCompanies);

      const availableCompanies = await multiCompanyManager.getUserCompanies('user-1');
      
      expect(availableCompanies).toHaveLength(2);
      expect(availableCompanies[0].companyId).toBe('comp-1');
      expect(availableCompanies[1].companyId).toBe('comp-2');
    });

    test('should validate company access on context switch', async () => {
      const mockUserCompany = {
        userId: 'user-1',
        companyId: 'comp-1',
        role: 'ADMIN',
        isActive: true
      };

      mockPrisma.userCompany.findUnique.mockResolvedValue(mockUserCompany);

      const result = await multiCompanyManager.switchCompanyContext('user-1', 'comp-1');

      expect(result.success).toBe(true);
      expect(result.companyId).toBe('comp-1');
      expect(result.role).toBe('ADMIN');
    });

    test('should maintain session state across company switches', async () => {
      const sessionData = {
        userId: 'user-1',
        currentCompany: 'comp-1',
        companies: ['comp-1', 'comp-2']
      };

      const updatedSession = await multiCompanyManager.updateSessionContext(
        sessionData,
        'comp-2'
      );

      expect(updatedSession.currentCompany).toBe('comp-2');
      expect(updatedSession.companies).toContain('comp-2');
    });
  });

  describe('Role-Based Access Control', () => {
    test('should enforce role permissions correctly', async () => {
      const testCases = [
        { role: 'OWNER', canManageUsers: true, canViewReports: true, canApproveInvoices: true },
        { role: 'ADMIN', canManageUsers: true, canViewReports: true, canApproveInvoices: true },
        { role: 'ACCOUNTANT', canManageUsers: false, canViewReports: true, canApproveInvoices: true },
        { role: 'APPROVER', canManageUsers: false, canViewReports: false, canApproveInvoices: true },
        { role: 'EMPLOYEE', canManageUsers: false, canViewReports: false, canApproveInvoices: false },
        { role: 'VIEWER', canManageUsers: false, canViewReports: true, canApproveInvoices: false }
      ];

      for (const testCase of testCases) {
        const permissions = multiCompanyManager.getRolePermissions(testCase.role);
        
        expect(permissions.canManageUsers).toBe(testCase.canManageUsers);
        expect(permissions.canViewReports).toBe(testCase.canViewReports);
        expect(permissions.canApproveInvoices).toBe(testCase.canApproveInvoices);
      }
    });

    test('should check specific permission for user action', async () => {
      mockPrisma.userCompany.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'comp-1',
        role: 'ACCOUNTANT'
      });

      const canCreateInvoice = await multiCompanyManager.hasPermission(
        'user-1',
        'comp-1',
        'CREATE_INVOICE'
      );

      const canDeleteCompany = await multiCompanyManager.hasPermission(
        'user-1',
        'comp-1',
        'DELETE_COMPANY'
      );

      expect(canCreateInvoice).toBe(true);
      expect(canDeleteCompany).toBe(false);
    });
  });

  describe('Data Migration and Consolidation', () => {
    test('should merge companies while preserving data integrity', async () => {
      const sourceCompanyData = {
        invoices: [{ id: 'inv-1', companyId: 'source-comp' }],
        users: [{ id: 'user-1', role: 'ADMIN' }],
        workflows: [{ id: 'wf-1', companyId: 'source-comp' }]
      };

      mockPrisma.invoice.findMany.mockResolvedValue(sourceCompanyData.invoices);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.userCompany.updateMany.mockResolvedValue({ count: 1 });

      const result = await multiCompanyManager.mergeCompanies(
        'source-comp',
        'target-comp',
        'user-admin'
      );

      expect(result.success).toBe(true);
      expect(result.migratedRecords.invoices).toBe(1);
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'source-comp' },
        data: { companyId: 'target-comp' }
      });
    });

    test('should export company data for backup', async () => {
      const mockCompanyData = {
        company: { id: 'comp-1', name: 'Test Company' },
        invoices: [{ id: 'inv-1', invoiceNumber: 'INV-001' }],
        users: [{ id: 'user-1', role: 'ADMIN' }]
      };

      mockPrisma.company.findUnique.mockResolvedValue(mockCompanyData.company);
      mockPrisma.invoice.findMany.mockResolvedValue(mockCompanyData.invoices);
      mockPrisma.userCompany.findMany.mockResolvedValue(mockCompanyData.users);

      const exportData = await multiCompanyManager.exportCompanyData('comp-1');

      expect(exportData.company.name).toBe('Test Company');
      expect(exportData.invoices).toHaveLength(1);
      expect(exportData.users).toHaveLength(1);
      expect(exportData.exportedAt).toBeInstanceOf(Date);
    });
  });
});

export default {};