/**
 * DUPLICATE DETECTION SYSTEM TESTS
 * Tests the advanced fuzzy matching and similarity scoring
 */

import { DuplicateDetector } from '../src/lib/duplicate/detector';
import { prisma } from '../src/lib/prisma';

jest.mock('../src/lib/prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('🔍 Duplicate Detection System', () => {
  let duplicateDetector: DuplicateDetector;

  beforeEach(() => {
    duplicateDetector = new DuplicateDetector();
    jest.clearAllMocks();
  });

  describe('Exact Duplicate Detection', () => {
    test('should detect perfect duplicates', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15',
        vendorTaxId: 'DE123456789'
      };

      const mockCandidate = {
        id: 'existing-invoice',
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: { toNumber: () => 1000.00 },
        invoiceDate: new Date('2024-01-15'),
        customerName: null,
        vendorTaxId: 'DE123456789'
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 1.0
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.similarInvoices).toHaveLength(1);
      expect(result.reason).toContain('Identical invoice number');
    });
  });

  describe('Fuzzy Matching', () => {
    test('should detect similar invoice numbers', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corp',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15'
      };

      const mockCandidate = {
        id: 'similar-invoice',
        invoiceNumber: 'INV-0001', // Similar but not exact
        vendor: 'ACME Corporation', // Similar vendor name
        totalAmount: { toNumber: () => 999.99 }, // Almost same amount
        invoiceDate: new Date('2024-01-16'), // One day difference
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 0.85
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.confidence).toBeLessThan(1.0);
    });

    test('should handle vendor name variations', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation GmbH',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15'
      };

      const mockCandidate = {
        id: 'similar-invoice',
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corp', // Shortened form
        totalAmount: { toNumber: () => 1000.00 },
        invoiceDate: new Date('2024-01-15'),
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 0.9
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.85);
    });
  });

  describe('Amount Tolerance', () => {
    test('should allow small amount differences', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15'
      };

      const mockCandidate = {
        id: 'similar-invoice',
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: { toNumber: () => 1000.01 }, // 1 cent difference
        invoiceDate: new Date('2024-01-15'),
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 0.99
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    test('should reject large amount differences', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15'
      };

      const mockCandidate = {
        id: 'different-invoice',
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: { toNumber: () => 2000.00 }, // Double the amount
        invoiceDate: new Date('2024-01-15'),
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 0.7
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBeLessThan(0.85);
    });
  });

  describe('Date Tolerance', () => {
    test('should handle same-day invoices as potential duplicates', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15T10:00:00Z'
      };

      const mockCandidate = {
        id: 'similar-invoice',
        invoiceNumber: 'INV-001',
        vendor: 'ACME Corporation',
        totalAmount: { toNumber: () => 1000.00 },
        invoiceDate: new Date('2024-01-15T15:00:00Z'), // Same day, different time
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 1.0
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });
  });

  describe('Batch Processing', () => {
    test('should perform batch duplicate detection', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          vendor: 'ACME Corp',
          duplicates: []
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV-002',
          vendor: 'Beta Inc',
          duplicates: []
        }
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      
      // Mock the performDuplicateCheck method calls
      const performDuplicateCheckSpy = jest.spyOn(duplicateDetector, 'performDuplicateCheck')
        .mockResolvedValue({
          isDuplicate: false,
          confidence: 0.3,
          similarInvoices: []
        });

      await duplicateDetector.batchDuplicateDetection('comp-1', 10);

      expect(performDuplicateCheckSpy).toHaveBeenCalledTimes(2);
      expect(performDuplicateCheckSpy).toHaveBeenCalledWith('inv-1');
      expect(performDuplicateCheckSpy).toHaveBeenCalledWith('inv-2');
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing invoice numbers', async () => {
      const invoice = {
        invoiceNumber: '', // Empty invoice number
        vendor: 'ACME Corporation',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15'
      };

      const mockCandidate = {
        id: 'candidate-invoice',
        invoiceNumber: '',
        vendor: 'ACME Corporation',
        totalAmount: { toNumber: () => 1000.00 },
        invoiceDate: new Date('2024-01-15'),
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 0.75
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      // Should still detect as potential duplicate based on other fields
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle special characters in vendor names', async () => {
      const invoice = {
        invoiceNumber: 'INV-001',
        vendor: 'Müller & Co. GmbH',
        totalAmount: 1000.00,
        invoiceDate: '2024-01-15'
      };

      const mockCandidate = {
        id: 'candidate-invoice',
        invoiceNumber: 'INV-001',
        vendor: 'Mueller & Co GmbH', // Normalized version
        totalAmount: { toNumber: () => 1000.00 },
        invoiceDate: new Date('2024-01-15'),
        customerName: null,
        vendorTaxId: null
      };

      mockPrisma.invoice.findMany.mockResolvedValue([mockCandidate]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        id: 'check-1',
        invoiceId: 'test-invoice',
        similarity: 0.9
      });
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        action: 'DUPLICATE_CHECK'
      });

      const result = await duplicateDetector.checkForDuplicates(invoice, 'comp-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.85);
    });
  });
});

export default {};