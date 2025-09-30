import { prisma } from '../prisma';
import { ApprovalStatus, Priority } from '@prisma/client';

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface WorkflowStep {
  id: string;
  name: string;
  approvers: string[]; // User IDs
  requireAll: boolean; // true = all must approve, false = any can approve
  autoApprove?: {
    conditions: WorkflowCondition[];
    maxAmount?: number;
  };
}

export interface WorkflowConfig {
  id: string;
  name: string;
  conditions: WorkflowCondition[];
  steps: WorkflowStep[];
}

export class ApprovalEngine {
  
  /**
   * Determines which workflow applies to an invoice
   */
  async getApplicableWorkflow(invoiceId: string): Promise<WorkflowConfig | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { company: true }
    });

    if (!invoice) return null;

    const workflows = await prisma.approvalWorkflow.findMany({
      where: { 
        companyId: invoice.companyId,
        isActive: true 
      }
    });

    // Check each workflow's conditions
    for (const workflow of workflows) {
      const conditions = workflow.conditions as WorkflowCondition[];
      if (this.evaluateConditions(invoice, conditions)) {
        return {
          id: workflow.id,
          name: workflow.name,
          conditions,
          steps: workflow.steps as WorkflowStep[]
        };
      }
    }

    return null;
  }

  /**
   * Starts approval workflow for an invoice
   */
  async startApprovalWorkflow(invoiceId: string): Promise<boolean> {
    const workflow = await this.getApplicableWorkflow(invoiceId);
    if (!workflow) return false;

    // Create approval tasks for first step
    const firstStep = workflow.steps[0];
    if (!firstStep) return false;

    const tasks = firstStep.approvers.map(userId => ({
      invoiceId,
      workflowId: workflow.id,
      userId,
      step: 0,
      status: ApprovalStatus.PENDING,
      priority: Priority.NORMAL,
      dueDate: this.calculateDueDate(Priority.NORMAL)
    }));

    await prisma.approvalTask.createMany({
      data: tasks
    });

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { approvalStatus: ApprovalStatus.PENDING }
    });

    return true;
  }

  /**
   * Processes an approval decision
   */
  async processApproval(
    taskId: string, 
    userId: string, 
    decision: 'approve' | 'reject',
    comments?: string
  ): Promise<boolean> {
    const task = await prisma.approvalTask.findUnique({
      where: { id: taskId },
      include: { 
        invoice: true, 
        workflow: true,
        user: true
      }
    });

    if (!task || task.userId !== userId) {
      throw new Error('Unauthorized or task not found');
    }

    // Update the task
    const status = decision === 'approve' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    
    await prisma.approvalTask.update({
      where: { id: taskId },
      data: {
        status,
        comments,
        updatedAt: new Date()
      }
    });

    // Check if this completes the current step
    const workflow = task.workflow.steps as WorkflowStep[];
    const currentStep = workflow[task.step];
    
    if (decision === 'reject') {
      // Rejection ends the workflow
      await prisma.invoice.update({
        where: { id: task.invoiceId },
        data: { approvalStatus: ApprovalStatus.REJECTED }
      });
      
      return true;
    }

    // Check if step is complete
    const stepTasks = await prisma.approvalTask.findMany({
      where: {
        invoiceId: task.invoiceId,
        step: task.step
      }
    });

    const approvedTasks = stepTasks.filter(t => t.status === ApprovalStatus.APPROVED);
    const stepComplete = currentStep.requireAll 
      ? approvedTasks.length === stepTasks.length
      : approvedTasks.length > 0;

    if (stepComplete) {
      // Move to next step or complete workflow
      const nextStepIndex = task.step + 1;
      
      if (nextStepIndex < workflow.length) {
        // Start next step
        const nextStep = workflow[nextStepIndex];
        const nextTasks = nextStep.approvers.map(userId => ({
          invoiceId: task.invoiceId,
          workflowId: task.workflowId,
          userId,
          step: nextStepIndex,
          status: ApprovalStatus.PENDING,
          priority: Priority.NORMAL,
          dueDate: this.calculateDueDate(Priority.NORMAL)
        }));

        await prisma.approvalTask.createMany({
          data: nextTasks
        });
      } else {
        // Workflow complete - approve invoice
        await prisma.invoice.update({
          where: { id: task.invoiceId },
          data: { 
            approvalStatus: ApprovalStatus.APPROVED,
            approvedAt: new Date(),
            approvedById: userId
          }
        });
      }
    }

    return true;
  }

  /**
   * Handles delegation of approval tasks
   */
  async delegateApproval(
    taskId: string,
    fromUserId: string,
    toUserId: string,
    reason?: string
  ): Promise<boolean> {
    const task = await prisma.approvalTask.findUnique({
      where: { id: taskId }
    });

    if (!task || task.userId !== fromUserId) {
      throw new Error('Unauthorized or task not found');
    }

    // Update task to new user
    await prisma.approvalTask.update({
      where: { id: taskId },
      data: {
        userId: toUserId,
        status: ApprovalStatus.DELEGATED,
        comments: `Delegated from ${fromUserId}: ${reason || 'No reason provided'}`
      }
    });

    // Create delegation record
    await prisma.delegation.create({
      data: {
        delegatedBy: fromUserId,
        delegatedTo: toUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        reason
      }
    });

    return true;
  }

  /**
   * Gets pending approval tasks for a user
   */
  async getPendingTasks(userId: string, companyId?: string) {
    const where: any = {
      userId,
      status: ApprovalStatus.PENDING
    };

    if (companyId) {
      where.invoice = {
        companyId
      };
    }

    return await prisma.approvalTask.findMany({
      where,
      include: {
        invoice: {
          include: {
            company: true
          }
        },
        workflow: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Auto-approval logic for invoices that meet criteria
   */
  async checkAutoApproval(invoiceId: string): Promise<boolean> {
    const workflow = await this.getApplicableWorkflow(invoiceId);
    if (!workflow) return false;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) return false;

    // Check each step for auto-approval
    for (const step of workflow.steps) {
      if (step.autoApprove) {
        const { conditions, maxAmount } = step.autoApprove;
        
        // Check amount limit
        if (maxAmount && Number(invoice.totalAmount) > maxAmount) {
          continue;
        }

        // Check custom conditions
        if (this.evaluateConditions(invoice, conditions)) {
          // Auto-approve this invoice
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              approvalStatus: ApprovalStatus.APPROVED,
              approvedAt: new Date()
            }
          });
          
          return true;
        }
      }
    }

    return false;
  }

  private evaluateConditions(invoice: any, conditions: WorkflowCondition[]): boolean {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(invoice, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          if (fieldValue !== condition.value) return false;
          break;
        case 'greater_than':
          if (Number(fieldValue) <= Number(condition.value)) return false;
          break;
        case 'less_than':
          if (Number(fieldValue) >= Number(condition.value)) return false;
          break;
        case 'contains':
          if (!String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase())) return false;
          break;
        default:
          return false;
      }
    }
    
    return true;
  }

  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((o, key) => o?.[key], obj);
  }

  private calculateDueDate(priority: Priority): Date {
    const days = priority === Priority.URGENT ? 1 : priority === Priority.HIGH ? 3 : 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

export const approvalEngine = new ApprovalEngine();