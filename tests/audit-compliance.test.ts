/**
 * AUDIT & COMPLIANCE SYSTEM TESTS
 * Tests audit trails, GoBD compliance, and data integrity
 */

import { AuditEngine } from '../src/lib/audit/engine';
import { ComplianceManager } from '../src/lib/compliance/manager';
import { prisma } from '../src/lib/prisma';
import { createHash } from 'crypto';

jest.mock('../src/lib/prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('📋 Audit & Compliance System', () => {
  let auditEngine: AuditEngine;
  let complianceManager: ComplianceManager;

  beforeEach(() => {
    auditEngine = new AuditEngine();
    complianceManager = new ComplianceManager();
    jest.clearAllMocks();
  });

  describe('Audit Trail Generation', () => {
    test('should create audit log for invoice operations', async () => {
      const mockInvoiceData = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        companyId: 'comp-1'
      };

      const mockAuditLog = {
        id: 'audit-1',
        entityId: 'inv-1',
        entityType: 'INVOICE',
        action: 'CREATE',
        userId: 'user-1',
        companyId: 'comp-1',
        timestamp: new Date(),
        oldValues: null,
        newValues: mockInvoiceData,
        ipAddress: '192.168.1.1',
        userAgent: 'test-browser'
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await auditEngine.logAction({
        entityId: 'inv-1',
        entityType: 'INVOICE',
        action: 'CREATE',
        userId: 'user-1',
        companyId: 'comp-1',
        newValues: mockInvoiceData,
        ipAddress: '192.168.1.1',
        userAgent: 'test-browser'
      });

      expect(result.id).toBe('audit-1');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'INVOICE',
          action: 'CREATE',
          newValues: mockInvoiceData
        })
      });
    });

    test('should track field-level changes in updates', async () => {
      const oldInvoice = {
        id: 'inv-1',
        totalAmount: 1000,
        status: 'PENDING'
      };

      const newInvoice = {
        id: 'inv-1',
        totalAmount: 1200,
        status: 'APPROVED'
      };

      const mockAuditLog = {
        id: 'audit-2',
        entityId: 'inv-1',
        entityType: 'INVOICE',
        action: 'UPDATE',
        oldValues: oldInvoice,
        newValues: newInvoice,
        fieldChanges: [
          { field: 'totalAmount', oldValue: 1000, newValue: 1200 },
          { field: 'status', oldValue: 'PENDING', newValue: 'APPROVED' }
        ]
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await auditEngine.logAction({
        entityId: 'inv-1',
        entityType: 'INVOICE',
        action: 'UPDATE',
        userId: 'user-1',
        companyId: 'comp-1',
        oldValues: oldInvoice,
        newValues: newInvoice
      });

      expect(result.fieldChanges).toHaveLength(2);
      expect(result.fieldChanges[0]).toEqual({
        field: 'totalAmount',
        oldValue: 1000,
        newValue: 1200
      });
    });

    test('should create immutable audit entries', async () => {
      const auditData = {
        entityId: 'inv-1',
        action: 'CREATE',
        timestamp: new Date(),
        userId: 'user-1'
      };

      const hash = createHash('sha256')
        .update(JSON.stringify(auditData))
        .digest('hex');

      const mockAuditLog = {
        ...auditData,
        id: 'audit-1',
        hash: hash
      };

      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await auditEngine.logAction(auditData);

      expect(result.hash).toBe(hash);
      expect(result.hash).toHaveLength(64); // SHA-256 hex length
    });

    test('should detect audit log tampering', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          data: { action: 'CREATE', entityId: 'inv-1' },
          hash: createHash('sha256').update('original-data').digest('hex')
        },
        {
          id: 'audit-2',
          data: { action: 'UPDATE', entityId: 'inv-1' },
          hash: createHash('sha256').update('tampered-data').digest('hex') // Wrong hash
        }
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const integrity = await auditEngine.verifyAuditIntegrity('comp-1');

      expect(integrity.isValid).toBe(false);
      expect(integrity.tamperedEntries).toHaveLength(1);
      expect(integrity.tamperedEntries[0]).toBe('audit-2');
    });
  });

  describe('GoBD Compliance', () => {
    test('should validate document completeness for GoBD', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendor: 'Test Vendor',
        totalAmount: 1000,
        invoiceDate: new Date('2024-01-15'),
        vatAmount: 190,
        netAmount: 810,
        lineItems: [
          { description: 'Service', amount: 810, vatRate: 19 }
        ],
        originalDocument: 'base64-pdf-data',
        processedAt: new Date()
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const compliance = await complianceManager.validateGoBDCompliance('inv-1');

      expect(compliance.isCompliant).toBe(true);
      expect(compliance.requirements.completeness).toBe(true);
      expect(compliance.requirements.authenticity).toBe(true);
      expect(compliance.requirements.integrity).toBe(true);
      expect(compliance.requirements.timeliness).toBe(true);
    });

    test('should identify GoBD violations', async () => {
      const nonCompliantInvoice = {
        id: 'inv-2',
        invoiceNumber: '', // Missing required field
        vendor: 'Test Vendor',
        totalAmount: 1000,
        invoiceDate: null, // Missing date
        originalDocument: null, // Missing original
        lineItems: [] // Missing line items
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(nonCompliantInvoice);

      const compliance = await complianceManager.validateGoBDCompliance('inv-2');

      expect(compliance.isCompliant).toBe(false);
      expect(compliance.violations).toContain('MISSING_INVOICE_NUMBER');
      expect(compliance.violations).toContain('MISSING_DATE');
      expect(compliance.violations).toContain('MISSING_ORIGINAL_DOCUMENT');
      expect(compliance.violations).toContain('MISSING_LINE_ITEMS');
    });

    test('should enforce retention periods', async () => {
      const oldInvoice = {
        id: 'inv-old',
        createdAt: new Date('2014-01-01'), // 10+ years old
        companyId: 'comp-1',
        isArchived: false
      };

      const recentInvoice = {
        id: 'inv-recent',
        createdAt: new Date('2022-01-01'), // Recent
        companyId: 'comp-1',
        isArchived: false
      };

      mockPrisma.invoice.findMany.mockResolvedValue([oldInvoice, recentInvoice]);

      const retentionCheck = await complianceManager.checkRetentionCompliance('comp-1');

      expect(retentionCheck.eligibleForArchival).toContain('inv-old');
      expect(retentionCheck.mustRetain).toContain('inv-recent');
      expect(retentionCheck.totalDocuments).toBe(2);
    });

    test('should generate compliance reports', async () => {
      const mockComplianceData = {
        totalInvoices: 1000,
        compliantInvoices: 950,
        violations: [
          { type: 'MISSING_VAT_ID', count: 30 },
          { type: 'INVALID_FORMAT', count: 20 }
        ],
        auditTrailIntegrity: true,
        retentionCompliance: 95.5
      };

      mockPrisma.invoice.count.mockResolvedValue(1000);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const report = await complianceManager.generateComplianceReport('comp-1', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      expect(report.complianceScore).toBeGreaterThan(90);
      expect(report.totalDocuments).toBe(1000);
      expect(report.violationsSummary).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Data Protection & Privacy', () => {
    test('should handle GDPR data deletion requests', async () => {
      const mockUserData = {
        id: 'user-1',
        email: 'user@example.com',
        personalData: {
          name: 'John Doe',
          address: '123 Main St',
          phone: '+1234567890'
        }
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUserData);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUserData,
        personalData: null,
        email: 'anonymized@deleted.user'
      });

      const result = await complianceManager.processDataDeletionRequest('user-1');

      expect(result.success).toBe(true);
      expect(result.deletedFields).toContain('personalData');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          email: expect.stringMatching(/anonymized/)
        })
      });
    });

    test('should anonymize sensitive data in exports', async () => {
      const mockSensitiveData = [
        {
          id: 'inv-1',
          vendor: 'John Doe Consulting',
          vendorEmail: 'john@example.com',
          bankAccount: 'DE89370400440532013000',
          amount: 1000
        }
      ];

      const anonymizedData = await complianceManager.anonymizeForExport(mockSensitiveData);

      expect(anonymizedData[0].vendor).toMatch(/^Vendor-\w{8}$/);
      expect(anonymizedData[0].vendorEmail).toMatch(/^email-\w+@anonymized\.com$/);
      expect(anonymizedData[0].bankAccount).toMatch(/^DE\*+0$/);
      expect(anonymizedData[0].amount).toBe(1000); // Non-sensitive data preserved
    });

    test('should log all data access for audit', async () => {
      const accessLog = {
        userId: 'user-1',
        resourceType: 'INVOICE',
        resourceId: 'inv-1',
        action: 'READ',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        justification: 'Monthly reporting'
      };

      mockPrisma.dataAccessLog.create.mockResolvedValue(accessLog);

      const result = await auditEngine.logDataAccess(accessLog);

      expect(result).toBeDefined();
      expect(mockPrisma.dataAccessLog.create).toHaveBeenCalledWith({
        data: accessLog
      });
    });
  });

  describe('Financial Controls', () => {
    test('should detect unusual transaction patterns', async () => {
      const mockTransactions = [
        { amount: 1000, date: new Date('2024-01-01'), vendor: 'Vendor A' },
        { amount: 1000, date: new Date('2024-01-01'), vendor: 'Vendor A' }, // Duplicate
        { amount: 999.99, date: new Date('2024-01-01'), vendor: 'Vendor B' }, // Round amount avoidance
        { amount: 50000, date: new Date('2024-01-02'), vendor: 'Vendor C' } // Large amount
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const anomalies = await auditEngine.detectAnomalies('comp-1');

      expect(anomalies.duplicateTransactions).toHaveLength(1);
      expect(anomalies.roundAmountAvoidance).toHaveLength(1);
      expect(anomalies.unusualAmounts).toHaveLength(1);
      expect(anomalies.riskScore).toBeGreaterThan(0.7);
    });

    test('should validate approval sequence integrity', async () => {
      const mockApprovalChain = [
        {
          id: 'task-1',
          invoiceId: 'inv-1',
          step: 0,
          status: 'APPROVED',
          approvedAt: new Date('2024-01-01T10:00:00Z'),
          userId: 'manager-1'
        },
        {
          id: 'task-2',
          invoiceId: 'inv-1',
          step: 1,
          status: 'APPROVED',
          approvedAt: new Date('2024-01-01T09:00:00Z'), // Invalid: approved before previous step
          userId: 'director-1'
        }
      ];

      mockPrisma.approvalTask.findMany.mockResolvedValue(mockApprovalChain);

      const validation = await auditEngine.validateApprovalSequence('inv-1');

      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain('APPROVAL_ORDER_VIOLATION');
    });

    test('should enforce segregation of duties', async () => {
      const mockUser = {
        id: 'user-1',
        role: 'ACCOUNTANT',
        permissions: ['CREATE_INVOICE', 'APPROVE_INVOICE'] // Conflicting permissions
      };

      const mockTransaction = {
        createdBy: 'user-1',
        approvedBy: 'user-1', // Same person
        amount: 5000
      };

      const sodViolation = await auditEngine.checkSegregationOfDuties(mockTransaction);

      expect(sodViolation.hasViolation).toBe(true);
      expect(sodViolation.violationType).toBe('SAME_USER_CREATE_APPROVE');
      expect(sodViolation.riskLevel).toBe('HIGH');
    });
  });

  describe('Regulatory Reporting', () => {
    test('should generate VAT return data', async () => {
      const mockVATData = [
        { vatRate: 19, netAmount: 1000, vatAmount: 190, type: 'SALE' },
        { vatRate: 19, netAmount: 500, vatAmount: 95, type: 'PURCHASE' }
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockVATData);

      const vatReport = await complianceManager.generateVATReport('comp-1', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      });

      expect(vatReport.outputVAT).toBe(190);
      expect(vatReport.inputVAT).toBe(95);
      expect(vatReport.netVATLiability).toBe(95);
      expect(vatReport.period).toBe('Q1-2024');
    });

    test('should generate DATEV export format', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          amount: 1190,
          account: '8400',
          contraAccount: '1200',
          description: 'Office supplies',
          vatCode: '19'
        }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const datevExport = await complianceManager.generateDATEVExport('comp-1', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });

      expect(datevExport.format).toBe('DATEV-CSV');
      expect(datevExport.records).toHaveLength(1);
      expect(datevExport.records[0]).toContain('8400'); // Account
      expect(datevExport.records[0]).toContain('1190'); // Amount
    });
  });

  describe('System Security', () => {
    test('should detect unauthorized access attempts', async () => {
      const suspiciousAttempts = [
        { userId: 'user-1', ipAddress: '192.168.1.100', timestamp: new Date(), success: false },
        { userId: 'user-1', ipAddress: '10.0.0.1', timestamp: new Date(), success: false },
        { userId: 'user-1', ipAddress: '172.16.0.1', timestamp: new Date(), success: false }
      ];

      mockPrisma.loginAttempt.findMany.mockResolvedValue(suspiciousAttempts);

      const securityAlert = await auditEngine.analyzeSecurityThreats('comp-1');

      expect(securityAlert.hasThreats).toBe(true);
      expect(securityAlert.threatTypes).toContain('MULTIPLE_FAILED_LOGINS');
      expect(securityAlert.affectedUsers).toContain('user-1');
    });

    test('should validate system configuration compliance', async () => {
      const systemConfig = {
        passwordPolicy: {
          minLength: 12,
          requireSpecialChars: true,
          maxAge: 90
        },
        sessionTimeout: 30,
        encryptionEnabled: true,
        backupFrequency: 'DAILY'
      };

      const compliance = await complianceManager.validateSystemConfiguration(systemConfig);

      expect(compliance.isCompliant).toBe(true);
      expect(compliance.securityScore).toBeGreaterThan(85);
    });
  });
});

export default {};