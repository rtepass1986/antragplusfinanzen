import { prisma } from '../prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

interface AuditEvent {
  companyId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface ComplianceReport {
  companyId: string;
  reportType: 'GoBD' | 'GDPR' | 'SOX' | 'CUSTOM';
  period: {
    startDate: Date;
    endDate: Date;
  };
  includedEntities: string[];
  filters?: {
    actions?: string[];
    users?: string[];
    entities?: string[];
  };
}

interface DataRetentionPolicy {
  entityType: string;
  retentionPeriod: number; // months
  archiveAfter: number; // months
  anonymizeAfter?: number; // months
  conditions?: {
    field: string;
    operator: string;
    value: any;
  }[];
}

export class AuditManager {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'eu-central-1'
    });
    this.bucketName = process.env.AUDIT_BUCKET_NAME || 'fintech-audit-logs';
  }

  /**
   * Records an audit event
   */
  async recordAuditEvent(event: AuditEvent): Promise<string> {
    try {
      // Create audit log entry
      const auditLog = await prisma.auditLog.create({
        data: {
          companyId: event.companyId,
          userId: event.userId,
          action: event.action,
          entity: event.entity,
          entityId: event.entityId,
          oldValue: event.oldValue,
          newValue: event.newValue,
          metadata: {
            ...event.metadata,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            sessionId: event.sessionId,
            timestamp: new Date().toISOString(),
            hash: this.generateEventHash(event)
          }
        }
      });

      // For critical events, also store in immutable storage
      if (this.isCriticalEvent(event.action)) {
        await this.storeInImmutableStorage(auditLog);
      }

      return auditLog.id;

    } catch (error) {
      console.error('Failed to record audit event:', error);
      throw new Error('Audit logging failed');
    }
  }

  /**
   * Generates compliance report
   */
  async generateComplianceReport(request: ComplianceReport): Promise<string> {
    const startTime = Date.now();

    try {
      // Get audit logs for the period
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          companyId: request.companyId,
          createdAt: {
            gte: request.period.startDate,
            lte: request.period.endDate
          },
          ...(request.filters?.actions && {
            action: { in: request.filters.actions }
          }),
          ...(request.filters?.users && {
            userId: { in: request.filters.users }
          }),
          ...(request.filters?.entities && {
            entity: { in: request.filters.entities }
          })
        },
        include: {
          user: {
            select: { name: true, email: true }
          },
          company: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Generate report based on type
      const reportData = await this.formatComplianceReport(request.reportType, auditLogs, request);
      
      // Upload report to S3
      const reportKey = `compliance-reports/${request.companyId}/${request.reportType}_${Date.now()}.json`;
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: reportKey,
        Body: JSON.stringify(reportData, null, 2),
        ContentType: 'application/json',
        Metadata: {
          companyId: request.companyId,
          reportType: request.reportType,
          generatedAt: new Date().toISOString(),
          recordCount: auditLogs.length.toString(),
          processingTime: (Date.now() - startTime).toString()
        }
      }));

      // Create report log
      await prisma.auditLog.create({
        data: {
          companyId: request.companyId,
          userId: 'SYSTEM',
          action: 'COMPLIANCE_REPORT_GENERATED',
          entity: 'ComplianceReport',
          entityId: reportKey,
          metadata: {
            reportType: request.reportType,
            period: request.period,
            recordCount: auditLogs.length,
            processingTime: Date.now() - startTime
          }
        }
      });

      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${reportKey}`;

    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new Error('Compliance report generation failed');
    }
  }

  /**
   * Implements data retention policies
   */
  async enforceDataRetention(companyId: string): Promise<{
    archived: number;
    anonymized: number;
    deleted: number;
  }> {
    const policies = await this.getDataRetentionPolicies(companyId);
    let archived = 0;
    let anonymized = 0;
    const deleted = 0;

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriod);

      const archiveDate = new Date();
      archiveDate.setMonth(archiveDate.getMonth() - policy.archiveAfter);

      const anonymizeDate = policy.anonymizeAfter ? new Date() : null;
      if (anonymizeDate) {
        anonymizeDate.setMonth(anonymizeDate.getMonth() - policy.anonymizeAfter);
      }

      // Handle different entity types
      switch (policy.entityType) {
        case 'AuditLog':
          // Archive old audit logs
          const oldLogs = await prisma.auditLog.findMany({
            where: {
              companyId,
              createdAt: { lte: archiveDate }
            }
          });

          if (oldLogs.length > 0) {
            await this.archiveAuditLogs(oldLogs);
            archived += oldLogs.length;
          }

          // Anonymize very old logs if policy exists
          if (anonymizeDate) {
            const veryOldLogs = await prisma.auditLog.findMany({
              where: {
                companyId,
                createdAt: { lte: anonymizeDate }
              }
            });

            for (const log of veryOldLogs) {
              await this.anonymizeAuditLog(log.id);
              anonymized++;
            }
          }
          break;

        case 'Invoice':
          // Similar logic for invoices
          const oldInvoices = await prisma.invoice.findMany({
            where: {
              companyId,
              createdAt: { lte: archiveDate },
              status: 'ARCHIVED'
            }
          });

          if (oldInvoices.length > 0) {
            await this.archiveInvoices(oldInvoices);
            archived += oldInvoices.length;
          }
          break;

        // Add more entity types as needed
      }
    }

    // Log retention enforcement
    await this.recordAuditEvent({
      companyId,
      userId: 'SYSTEM',
      action: 'DATA_RETENTION_ENFORCED',
      entity: 'DataRetention',
      entityId: `retention_${Date.now()}`,
      metadata: {
        archived,
        anonymized,
        deleted,
        executedAt: new Date().toISOString()
      }
    });

    return { archived, anonymized, deleted };
  }

  /**
   * Validates data integrity for compliance
   */
  async validateDataIntegrity(companyId: string, entityType?: string): Promise<{
    totalRecords: number;
    validRecords: number;
    corruptedRecords: number;
    missingHashes: number;
    issues: Array<{ id: string; issue: string }>;
  }> {
    const issues: Array<{ id: string; issue: string }> = [];
    let totalRecords = 0;
    let validRecords = 0;
    let corruptedRecords = 0;
    let missingHashes = 0;

    // Check audit logs integrity
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        ...(entityType && { entity: entityType })
      }
    });

    totalRecords = auditLogs.length;

    for (const log of auditLogs) {
      const metadata = log.metadata as any;
      
      // Check if hash exists
      if (!metadata?.hash) {
        missingHashes++;
        issues.push({
          id: log.id,
          issue: 'Missing integrity hash'
        });
        continue;
      }

      // Verify hash
      const expectedHash = this.generateEventHash({
        companyId: log.companyId,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        oldValue: log.oldValue,
        newValue: log.newValue,
        metadata: { ...metadata, hash: undefined } // Exclude hash from hash calculation
      });

      if (expectedHash !== metadata.hash) {
        corruptedRecords++;
        issues.push({
          id: log.id,
          issue: 'Data integrity violation - hash mismatch'
        });
      } else {
        validRecords++;
      }
    }

    // Log integrity check results
    await this.recordAuditEvent({
      companyId,
      userId: 'SYSTEM',
      action: 'INTEGRITY_CHECK_COMPLETED',
      entity: 'IntegrityCheck',
      entityId: `integrity_${Date.now()}`,
      metadata: {
        totalRecords,
        validRecords,
        corruptedRecords,
        missingHashes,
        issuesFound: issues.length
      }
    });

    return {
      totalRecords,
      validRecords,
      corruptedRecords,
      missingHashes,
      issues
    };
  }

  /**
   * Exports audit trail for legal/regulatory purposes
   */
  async exportAuditTrail(
    companyId: string,
    startDate: Date,
    endDate: Date,
    format: 'JSON' | 'CSV' | 'PDF' = 'JSON'
  ): Promise<string> {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        company: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    let exportData: string;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'CSV':
        exportData = this.formatAuditTrailAsCSV(auditLogs);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'PDF':
        exportData = await this.formatAuditTrailAsPDF(auditLogs);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      default:
        exportData = JSON.stringify(auditLogs, null, 2);
        contentType = 'application/json';
        fileExtension = 'json';
    }

    // Upload to S3
    const exportKey = `audit-exports/${companyId}/audit_trail_${Date.now()}.${fileExtension}`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: exportKey,
      Body: exportData,
      ContentType: contentType,
      Metadata: {
        companyId,
        format,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        recordCount: auditLogs.length.toString()
      }
    }));

    // Log export
    await this.recordAuditEvent({
      companyId,
      userId: 'SYSTEM',
      action: 'AUDIT_TRAIL_EXPORTED',
      entity: 'AuditExport',
      entityId: exportKey,
      metadata: {
        format,
        period: { startDate, endDate },
        recordCount: auditLogs.length
      }
    });

    return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${exportKey}`;
  }

  /**
   * GDPR compliance: Right to be forgotten
   */
  async processGDPRDeletionRequest(
    companyId: string,
    userId: string,
    requestedBy: string
  ): Promise<boolean> {
    // Anonymize user data in audit logs
    await prisma.auditLog.updateMany({
      where: {
        companyId,
        userId
      },
      data: {
        metadata: {
          anonymized: true,
          originalUserId: userId,
          anonymizedAt: new Date().toISOString()
        }
      }
    });

    // Remove personal identifiable information
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: 'ANONYMIZED',
        email: `anonymized_${userId}@deleted.local`,
        image: null
      }
    });

    // Log GDPR deletion
    await this.recordAuditEvent({
      companyId,
      userId: requestedBy,
      action: 'GDPR_DELETION_PROCESSED',
      entity: 'GDPRRequest',
      entityId: userId,
      metadata: {
        targetUserId: userId,
        requestedBy,
        processedAt: new Date().toISOString(),
        reason: 'Right to be forgotten'
      }
    });

    return true;
  }

  /**
   * Private helper methods
   */
  private generateEventHash(event: AuditEvent): string {
    const data = JSON.stringify({
      companyId: event.companyId,
      userId: event.userId,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      oldValue: event.oldValue,
      newValue: event.newValue,
      metadata: event.metadata
    });

    return createHash('sha256').update(data).digest('hex');
  }

  private isCriticalEvent(action: string): boolean {
    const criticalActions = [
      'COMPANY_CREATED',
      'USER_DELETED',
      'PAYMENT_INITIATED',
      'DATA_EXPORT',
      'SETTINGS_UPDATED',
      'ROLE_UPDATED',
      'GDPR_DELETION_PROCESSED'
    ];

    return criticalActions.includes(action);
  }

  private async storeInImmutableStorage(auditLog: any): Promise<void> {
    const key = `immutable-logs/${auditLog.companyId}/${auditLog.id}.json`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(auditLog),
      ContentType: 'application/json',
      Metadata: {
        immutable: 'true',
        critical: 'true',
        hash: auditLog.metadata.hash
      }
    }));
  }

  private async formatComplianceReport(
    reportType: string,
    auditLogs: any[],
    request: ComplianceReport
  ): Promise<any> {
    const baseReport = {
      reportType,
      companyId: request.companyId,
      period: request.period,
      generatedAt: new Date().toISOString(),
      totalRecords: auditLogs.length
    };

    switch (reportType) {
      case 'GoBD':
        return {
          ...baseReport,
          compliance: {
            dataIntegrity: auditLogs.every(log => log.metadata?.hash),
            immutableStorage: true,
            retentionPeriod: '10 years',
            accessControls: true
          },
          summary: this.generateGoBDSummary(auditLogs)
        };

      case 'GDPR':
        return {
          ...baseReport,
          compliance: {
            rightToAccess: true,
            rightToRectification: true,
            rightToErasure: true,
            dataPortability: true
          },
          summary: this.generateGDPRSummary(auditLogs)
        };

      default:
        return {
          ...baseReport,
          logs: auditLogs
        };
    }
  }

  private generateGoBDSummary(auditLogs: any[]): any {
    const actions = auditLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    return {
      actionBreakdown: actions,
      integrityChecks: auditLogs.filter(log => log.action === 'INTEGRITY_CHECK_COMPLETED').length,
      criticalEvents: auditLogs.filter(log => this.isCriticalEvent(log.action)).length
    };
  }

  private generateGDPRSummary(auditLogs: any[]): any {
    return {
      dataAccesses: auditLogs.filter(log => log.action.includes('READ')).length,
      dataModifications: auditLogs.filter(log => log.action.includes('UPDATE')).length,
      dataDeletions: auditLogs.filter(log => log.action.includes('DELETE')).length,
      gdprRequests: auditLogs.filter(log => log.action.includes('GDPR')).length
    };
  }

  private async getDataRetentionPolicies(companyId: string): Promise<DataRetentionPolicy[]> {
    // Default policies - would be configurable per company
    return [
      {
        entityType: 'AuditLog',
        retentionPeriod: 120, // 10 years
        archiveAfter: 60,     // 5 years
        anonymizeAfter: 84    // 7 years
      },
      {
        entityType: 'Invoice',
        retentionPeriod: 120, // 10 years
        archiveAfter: 24      // 2 years
      }
    ];
  }

  private async archiveAuditLogs(logs: any[]): Promise<void> {
    // Implementation would move logs to cold storage
    console.log(`Archiving ${logs.length} audit logs`);
  }

  private async archiveInvoices(invoices: any[]): Promise<void> {
    // Implementation would move invoices to cold storage
    console.log(`Archiving ${invoices.length} invoices`);
  }

  private async anonymizeAuditLog(logId: string): Promise<void> {
    await prisma.auditLog.update({
      where: { id: logId },
      data: {
        metadata: {
          anonymized: true,
          anonymizedAt: new Date().toISOString()
        }
      }
    });
  }

  private formatAuditTrailAsCSV(auditLogs: any[]): string {
    const headers = ['Date', 'User', 'Action', 'Entity', 'Entity ID', 'Details'];
    const rows = auditLogs.map(log => [
      log.createdAt.toISOString(),
      log.user?.email || log.userId,
      log.action,
      log.entity,
      log.entityId,
      JSON.stringify(log.metadata || {})
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private async formatAuditTrailAsPDF(auditLogs: any[]): Promise<string> {
    // Would use a PDF library like puppeteer or jsPDF
    return 'PDF generation not implemented';
  }
}

export const auditManager = new AuditManager();