/**
 * APPROVAL WORKFLOW ENGINE TESTS
 * Tests the complete approval workflow automation system
 */

import { ApprovalEngine, WorkflowCondition, WorkflowStep } from '../src/lib/workflow/approval-engine';
import { prisma } from '../src/lib/prisma';

// Mock Prisma for testing
jest.mock('../src/lib/prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('🔄 Approval Workflow Engine', () => {
  let approvalEngine: ApprovalEngine;

  beforeEach(() => {
    approvalEngine = new ApprovalEngine();
    jest.clearAllMocks();
  });

  describe('Workflow Condition Evaluation', () => {
    test('should correctly evaluate greater_than conditions', async () => {
      const mockInvoice = {
        id: 'inv-1',
        companyId: 'comp-1',
        totalAmount: 1500,
        vendor: 'Test Vendor',
        company: { id: 'comp-1' }
      };

      const mockWorkflow = {
        id: 'wf-1',
        name: 'High Value Approval',
        conditions: [
          { field: 'totalAmount', operator: 'greater_than', value: 1000 }
        ] as WorkflowCondition[],
        steps: [
          {
            id: 'step-1',
            name: 'Manager Approval',
            approvers: ['user-1'],
            requireAll: false
          }
        ] as WorkflowStep[]
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([mockWorkflow]);

      const applicableWorkflow = await approvalEngine.getApplicableWorkflow('inv-1');

      expect(applicableWorkflow).toBeTruthy();
      expect(applicableWorkflow?.name).toBe('High Value Approval');
    });

    test('should reject workflows that don\'t match conditions', async () => {
      const mockInvoice = {
        id: 'inv-1',
        companyId: 'comp-1',
        totalAmount: 500,
        vendor: 'Test Vendor',
        company: { id: 'comp-1' }
      };

      const mockWorkflow = {
        id: 'wf-1',
        name: 'High Value Approval',
        conditions: [
          { field: 'totalAmount', operator: 'greater_than', value: 1000 }
        ] as WorkflowCondition[],
        steps: []
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([mockWorkflow]);

      const applicableWorkflow = await approvalEngine.getApplicableWorkflow('inv-1');

      expect(applicableWorkflow).toBeNull();
    });
  });

  describe('Workflow Initiation', () => {
    test('should start workflow and create approval tasks', async () => {
      const mockInvoice = {
        id: 'inv-1',
        companyId: 'comp-1',
        totalAmount: 1500,
        vendor: 'Test Vendor',
        company: { id: 'comp-1' }
      };

      const mockWorkflow = {
        id: 'wf-1',
        name: 'Standard Approval',
        conditions: [
          { field: 'totalAmount', operator: 'greater_than', value: 1000 }
        ] as WorkflowCondition[],
        steps: [
          {
            id: 'step-1',
            name: 'Manager Approval',
            approvers: ['user-1', 'user-2'],
            requireAll: false
          }
        ] as WorkflowStep[]
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrisma.approvalTask.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.invoice.update.mockResolvedValue(mockInvoice);

      const result = await approvalEngine.startApprovalWorkflow('inv-1');

      expect(result).toBe(true);
      expect(mockPrisma.approvalTask.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            invoiceId: 'inv-1',
            userId: 'user-1'
          }),
          expect.objectContaining({
            invoiceId: 'inv-1',
            userId: 'user-2'
          })
        ])
      });
    });
  });

  describe('Approval Processing', () => {
    test('should process approval and move to next step', async () => {
      const mockTask = {
        id: 'task-1',
        invoiceId: 'inv-1',
        workflowId: 'wf-1',
        userId: 'user-1',
        step: 0,
        workflow: {
          steps: [
            {
              id: 'step-1',
              name: 'Manager Approval',
              approvers: ['user-1'],
              requireAll: false
            },
            {
              id: 'step-2',
              name: 'Finance Approval',
              approvers: ['user-2'],
              requireAll: false
            }
          ] as WorkflowStep[]
        },
        user: { name: 'Test User' },
        invoice: { id: 'inv-1' }
      };

      mockPrisma.approvalTask.findUnique.mockResolvedValue(mockTask);
      mockPrisma.approvalTask.update.mockResolvedValue({ ...mockTask, status: 'APPROVED' });
      mockPrisma.approvalTask.findMany.mockResolvedValue([
        { ...mockTask, status: 'APPROVED' }
      ]);
      mockPrisma.approvalTask.createMany.mockResolvedValue({ count: 1 });

      const result = await approvalEngine.processApproval('task-1', 'user-1', 'approve', 'Looks good');

      expect(result).toBe(true);
      expect(mockPrisma.approvalTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'APPROVED',
          comments: 'Looks good',
          updatedAt: expect.any(Date)
        }
      });
    });

    test('should handle rejection and end workflow', async () => {
      const mockTask = {
        id: 'task-1',
        invoiceId: 'inv-1',
        workflowId: 'wf-1',
        userId: 'user-1',
        step: 0,
        workflow: {
          steps: [
            {
              id: 'step-1',
              name: 'Manager Approval',
              approvers: ['user-1'],
              requireAll: false
            }
          ] as WorkflowStep[]
        },
        user: { name: 'Test User' },
        invoice: { id: 'inv-1' }
      };

      mockPrisma.approvalTask.findUnique.mockResolvedValue(mockTask);
      mockPrisma.approvalTask.update.mockResolvedValue({ ...mockTask, status: 'REJECTED' });
      mockPrisma.invoice.update.mockResolvedValue({ id: 'inv-1', approvalStatus: 'REJECTED' });

      const result = await approvalEngine.processApproval('task-1', 'user-1', 'reject', 'Invalid vendor');

      expect(result).toBe(true);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { approvalStatus: 'REJECTED' }
      });
    });
  });

  describe('Delegation Handling', () => {
    test('should delegate approval task to another user', async () => {
      const mockTask = {
        id: 'task-1',
        invoiceId: 'inv-1',
        userId: 'user-1'
      };

      mockPrisma.approvalTask.findUnique.mockResolvedValue(mockTask);
      mockPrisma.approvalTask.update.mockResolvedValue({ ...mockTask, userId: 'user-2' });
      mockPrisma.delegation.create.mockResolvedValue({
        id: 'delegation-1',
        delegatedBy: 'user-1',
        delegatedTo: 'user-2'
      });

      const result = await approvalEngine.delegateApproval('task-1', 'user-1', 'user-2', 'Going on vacation');

      expect(result).toBe(true);
      expect(mockPrisma.approvalTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          userId: 'user-2',
          status: 'DELEGATED',
          comments: 'Delegated from user-1: Going on vacation'
        }
      });
    });
  });

  describe('Auto-Approval Logic', () => {
    test('should auto-approve invoices meeting criteria', async () => {
      const mockWorkflow = {
        id: 'wf-1',
        name: 'Auto Approval',
        conditions: [
          { field: 'totalAmount', operator: 'less_than', value: 500 }
        ] as WorkflowCondition[],
        steps: [
          {
            id: 'step-1',
            name: 'Auto Approval',
            approvers: [],
            requireAll: false,
            autoApprove: {
              conditions: [
                { field: 'vendor', operator: 'contains', value: 'Trusted' }
              ] as WorkflowCondition[],
              maxAmount: 500
            }
          }
        ] as WorkflowStep[]
      };

      const mockInvoice = {
        id: 'inv-1',
        totalAmount: 300,
        vendor: 'Trusted Vendor Inc',
        companyId: 'comp-1'
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, approvalStatus: 'APPROVED' });

      const result = await approvalEngine.checkAutoApproval('inv-1');

      expect(result).toBe(true);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: {
          approvalStatus: 'APPROVED',
          approvedAt: expect.any(Date)
        }
      });
    });
  });
});

export default {};