import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SESClient, CreateReceiptRuleCommand } from '@aws-sdk/client-ses';
import { textractService } from '../aws/textract';
import { prisma } from '../prisma';
import { approvalEngine } from '../workflow/approval-engine';
import { duplicateDetector } from '../duplicate/detector';

interface EmailInvoice {
  from: string;
  subject: string;
  body: string;
  attachments: {
    filename: string;
    contentType: string;
    content: Buffer;
  }[];
  receivedAt: Date;
}

interface ProcessingResult {
  success: boolean;
  invoiceId?: string;
  error?: string;
  duplicateFound?: boolean;
}

export class EmailProcessor {
  private s3Client: S3Client;
  private sesClient: SESClient;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'eu-central-1'
    });
    
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'eu-central-1'
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME || 'fintech-invoices';
  }

  /**
   * Sets up email forwarding for a company
   */
  async setupEmailForwarding(companyId: string, emailDomain: string): Promise<string> {
    const emailAddress = `invoices-${companyId}@${emailDomain}`;
    
    try {
      // Create SES receipt rule
      await this.sesClient.send(new CreateReceiptRuleCommand({
        RuleName: `invoice-processing-${companyId}`,
        Recipients: [emailAddress],
        Actions: [
          {
            S3Action: {
              BucketName: this.bucketName,
              ObjectKeyPrefix: `emails/${companyId}/`,
              TopicArn: process.env.SNS_TOPIC_ARN // For triggering processing
            }
          }
        ],
        Enabled: true
      }));

      // Store configuration in database
      await prisma.integrationConfig.create({
        data: {
          companyId,
          type: 'EMAIL',
          name: 'Invoice Email Import',
          config: {
            emailAddress,
            domain: emailDomain,
            autoProcess: true
          }
        }
      });

      return emailAddress;
    } catch (error) {
      throw new Error(`Failed to setup email forwarding: ${error}`);
    }
  }

  /**
   * Processes incoming email with invoice attachments
   */
  async processEmailInvoice(email: EmailInvoice, companyId: string): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const attachment of email.attachments) {
      try {
        // Check if attachment is an invoice document
        if (!this.isInvoiceDocument(attachment)) {
          continue;
        }

        // Upload to S3
        const s3Key = `emails/${companyId}/${Date.now()}-${attachment.filename}`;
        await this.uploadToS3(s3Key, attachment.content, attachment.contentType);

        // Process with OCR
        const ocrResult = await textractService.analyzeDocument(attachment.content);
        const invoiceData = textractService.parseInvoiceData(
          textractService.extractKeyValuePairs(ocrResult.Blocks || []),
          this.extractRawText(ocrResult.Blocks || [])
        );

        // Check for duplicates
        const duplicateCheck = await duplicateDetector.checkForDuplicates({
          invoiceNumber: invoiceData.invoiceNumber || '',
          vendor: invoiceData.customerName || '',
          totalAmount: invoiceData.total || 0,
          invoiceDate: invoiceData.date || ''
        }, companyId);

        if (duplicateCheck.isDuplicate) {
          results.push({
            success: false,
            duplicateFound: true,
            error: `Duplicate invoice detected: ${duplicateCheck.reason}`
          });
          continue;
        }

        // Determine sender/vendor from email
        const vendor = this.extractVendorFromEmail(email, invoiceData);

        // Create invoice record
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: invoiceData.invoiceNumber || `AUTO-${Date.now()}`,
            filename: attachment.filename,
            originalFile: attachment.filename,
            s3Key,
            s3Url: `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
            
            vendor: vendor.name,
            vendorAddress: vendor.address,
            vendorTaxId: vendor.taxId,
            
            invoiceDate: new Date(invoiceData.date || email.receivedAt),
            dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
            totalAmount: invoiceData.total || 0,
            taxAmount: invoiceData.taxAmount || 0,
            subtotal: invoiceData.subtotal || 0,
            currency: invoiceData.currency || 'EUR',
            
            status: 'PROCESSING',
            priority: this.determinePriority(invoiceData, email),
            
            ocrConfidence: invoiceData.confidence,
            ocrRawText: invoiceData.rawText,
            extractedFields: ocrResult,
            
            companyId,
            createdById: await this.getSystemUserId(companyId),
            
            // Email metadata
            notes: `Imported from email: ${email.subject}\nSender: ${email.from}`,
            tags: ['email-import', 'auto-processed']
          }
        });

        // Create line items
        if (invoiceData.items && invoiceData.items.length > 0) {
          await prisma.lineItem.createMany({
            data: invoiceData.items.map(item => ({
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || item.total || 0,
              totalPrice: item.total || 0
            }))
          });
        }

        // Start approval workflow
        await approvalEngine.startApprovalWorkflow(invoice.id);

        // Create audit log
        await this.createAuditLog(companyId, 'SYSTEM', 'Invoice', invoice.id, {
          action: 'EMAIL_IMPORT',
          email: {
            from: email.from,
            subject: email.subject,
            receivedAt: email.receivedAt
          },
          ocrConfidence: invoiceData.confidence
        });

        results.push({
          success: true,
          invoiceId: invoice.id
        });

      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Extracts vendor information from email and OCR data
   */
  private extractVendorFromEmail(email: EmailInvoice, ocrData: any): {
    name: string;
    address?: string;
    taxId?: string;
  } {
    // Try to get vendor from OCR first
    if (ocrData.customerName) {
      return {
        name: ocrData.customerName,
        address: ocrData.customerAddress,
        taxId: ocrData.vendorTaxId
      };
    }

    // Extract from email domain
    const domain = email.from.split('@')[1];
    const companyName = domain.split('.')[0];
    
    return {
      name: companyName.charAt(0).toUpperCase() + companyName.slice(1),
      address: `Email: ${email.from}`
    };
  }

  /**
   * Determines invoice priority based on content and sender
   */
  private determinePriority(invoiceData: any, email: EmailInvoice): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
    // Check amount
    const amount = invoiceData.total || 0;
    if (amount > 10000) return 'HIGH';
    if (amount > 50000) return 'URGENT';

    // Check subject for urgency keywords
    const urgentKeywords = ['urgent', 'immediate', 'asap', 'priority', 'dringend', 'eilig'];
    const subject = email.subject.toLowerCase();
    
    if (urgentKeywords.some(keyword => subject.includes(keyword))) {
      return 'URGENT';
    }

    // Check due date
    if (invoiceData.dueDate) {
      const dueDate = new Date(invoiceData.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 3600 * 24));
      
      if (daysUntilDue <= 3) return 'HIGH';
      if (daysUntilDue <= 7) return 'NORMAL';
    }

    return 'NORMAL';
  }

  /**
   * Checks if attachment is an invoice document
   */
  private isInvoiceDocument(attachment: { filename: string; contentType: string }): boolean {
    const invoiceTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff'
    ];

    const invoiceKeywords = [
      'invoice', 'rechnung', 'bill', 'factura', 'facture'
    ];

    // Check MIME type
    if (!invoiceTypes.includes(attachment.contentType)) {
      return false;
    }

    // Check filename
    const filename = attachment.filename.toLowerCase();
    return invoiceKeywords.some(keyword => filename.includes(keyword));
  }

  private async uploadToS3(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: contentType
    }));
  }

  private extractRawText(blocks: any[]): string {
    return blocks
      .filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .filter(Boolean)
      .join('\n');
  }

  private async getSystemUserId(companyId: string): Promise<string> {
    // Get system user for the company or create one
    let systemUser = await prisma.user.findFirst({
      where: {
        email: `system@company-${companyId}`,
        role: 'ADMIN'
      }
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: `system@company-${companyId}`,
          name: 'System (Email Import)',
          role: 'ADMIN'
        }
      });

      // Associate with company
      await prisma.userCompany.create({
        data: {
          userId: systemUser.id,
          companyId,
          role: 'ADMIN'
        }
      });
    }

    return systemUser.id;
  }

  private async createAuditLog(companyId: string, userId: string, entity: string, entityId: string, metadata: any): Promise<void> {
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'CREATE',
        entity,
        entityId,
        newValue: metadata
      }
    });
  }

  /**
   * Webhook handler for SES/SNS notifications
   */
  async handleEmailWebhook(snsMessage: any): Promise<void> {
    try {
      const message = JSON.parse(snsMessage.Message);
      const s3Key = message.Records[0].s3.object.key;
      const companyId = s3Key.split('/')[1]; // Extract from key pattern

      // Download and parse email from S3
      // This would require additional email parsing logic
      // For now, this is a placeholder for the webhook handler
      
      console.log('Processing email webhook for company:', companyId);
      
    } catch (error) {
      console.error('Failed to process email webhook:', error);
    }
  }
}

export const emailProcessor = new EmailProcessor();