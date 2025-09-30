import { prisma } from '../prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DatevExportOptions {
  companyId: string;
  startDate: Date;
  endDate: Date;
  includeInvoices?: boolean;
  includeExpenses?: boolean;
  format: 'CSV' | 'XML';
  consultant?: string;
  clientNumber?: string;
}

interface DatevRecord {
  umsatz: string;          // Revenue/Amount
  sollKonto: string;       // Debit account
  habenKonto: string;      // Credit account
  steuerschluessel: string; // Tax key
  belegdatum: string;      // Document date
  belegfeld1: string;      // Document field 1 (invoice number)
  belegfeld2: string;      // Document field 2 (vendor/customer)
  skonto: string;          // Discount
  buchungstext: string;    // Posting text
}

export class DatevExporter {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'eu-central-1'
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'fintech-exports';
  }

  /**
   * Exports accounting data in DATEV format
   */
  async exportToDatev(options: DatevExportOptions): Promise<string> {
    try {
      // Get company configuration
      const company = await prisma.company.findUnique({
        where: { id: options.companyId },
        include: {
          integrationConfigs: {
            where: { type: 'DATEV' }
          }
        }
      });

      if (!company) {
        throw new Error('Company not found');
      }

      const datevConfig = company.integrationConfigs.find(config => config.type === 'DATEV');
      if (!datevConfig) {
        throw new Error('DATEV configuration not found');
      }

      // Get invoice data
      const invoices = await this.getInvoiceData(options);
      
      // Get expense data
      const expenses = await this.getExpenseData(options);

      // Convert to DATEV records
      const records: DatevRecord[] = [];
      
      if (options.includeInvoices !== false) {
        records.push(...this.convertInvoicesToDatev(invoices, datevConfig.config as any));
      }
      
      if (options.includeExpenses !== false) {
        records.push(...this.convertExpensesToDatev(expenses, datevConfig.config as any));
      }

      // Generate export file
      const exportData = options.format === 'XML' 
        ? this.generateDatevXml(records, options, company)
        : this.generateDatevCsv(records, options, company);

      // Upload to S3
      const filename = this.generateFilename(options);
      const s3Key = `datev-exports/${options.companyId}/${filename}`;
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: exportData,
        ContentType: options.format === 'XML' ? 'application/xml' : 'text/csv',
        Metadata: {
          companyId: options.companyId,
          exportDate: new Date().toISOString(),
          recordCount: records.length.toString()
        }
      }));

      // Create export log
      await prisma.exportLog.create({
        data: {
          companyId: options.companyId,
          type: 'DATEV',
          status: 'COMPLETED',
          filename,
          s3Key,
          parameters: options as any
        }
      });

      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    } catch (error) {
      // Log export error
      await prisma.exportLog.create({
        data: {
          companyId: options.companyId,
          type: 'DATEV',
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          parameters: options as any
        }
      });

      throw error;
    }
  }

  /**
   * Gets invoice data for export period
   */
  private async getInvoiceData(options: DatevExportOptions) {
    return await prisma.invoice.findMany({
      where: {
        companyId: options.companyId,
        invoiceDate: {
          gte: options.startDate,
          lte: options.endDate
        },
        status: {
          in: ['APPROVED', 'PAID']
        }
      },
      include: {
        lineItems: true
      },
      orderBy: {
        invoiceDate: 'asc'
      }
    });
  }

  /**
   * Gets expense data for export period
   */
  private async getExpenseData(options: DatevExportOptions) {
    return await prisma.expense.findMany({
      where: {
        companyId: options.companyId,
        date: {
          gte: options.startDate,
          lte: options.endDate
        },
        status: {
          in: ['APPROVED', 'PAID']
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
  }

  /**
   * Converts invoices to DATEV format
   */
  private convertInvoicesToDatev(invoices: any[], datevConfig: any): DatevRecord[] {
    return invoices.flatMap(invoice => {
      const records: DatevRecord[] = [];
      
      // Main invoice posting
      records.push({
        umsatz: this.formatAmount(Number(invoice.totalAmount)),
        sollKonto: this.getDebtorAccount(invoice.vendor, datevConfig),
        habenKonto: this.getRevenueAccount(invoice.category, datevConfig),
        steuerschluessel: this.getTaxKey(Number(invoice.taxAmount), Number(invoice.totalAmount)),
        belegdatum: this.formatDate(invoice.invoiceDate),
        belegfeld1: invoice.invoiceNumber,
        belegfeld2: invoice.vendor,
        skonto: '0,00',
        buchungstext: `Rechnung ${invoice.invoiceNumber} - ${invoice.vendor}`
      });

      // Tax posting (if applicable)
      if (invoice.taxAmount && Number(invoice.taxAmount) > 0) {
        records.push({
          umsatz: this.formatAmount(Number(invoice.taxAmount)),
          sollKonto: this.getTaxAccount('INPUT_TAX', datevConfig),
          habenKonto: this.getRevenueAccount(invoice.category, datevConfig),
          steuerschluessel: '0',
          belegdatum: this.formatDate(invoice.invoiceDate),
          belegfeld1: invoice.invoiceNumber,
          belegfeld2: 'USt',
          skonto: '0,00',
          buchungstext: `USt ${invoice.invoiceNumber}`
        });
      }

      return records;
    });
  }

  /**
   * Converts expenses to DATEV format
   */
  private convertExpensesToDatev(expenses: any[], datevConfig: any): DatevRecord[] {
    return expenses.map(expense => ({
      umsatz: this.formatAmount(Number(expense.amount)),
      sollKonto: this.getExpenseAccount(expense.category, datevConfig),
      habenKonto: this.getCreditorAccount(expense.vendor || 'DIVERSE', datevConfig),
      steuerschluessel: this.getTaxKey(0, Number(expense.amount)), // Simplified tax handling
      belegdatum: this.formatDate(expense.date),
      belegfeld1: expense.id.substring(0, 10), // Truncated ID as document number
      belegfeld2: expense.title,
      skonto: '0,00',
      buchungstext: expense.description || expense.title
    }));
  }

  /**
   * Generates DATEV CSV format
   */
  private generateDatevCsv(records: DatevRecord[], options: DatevExportOptions, company: any): string {
    const headers = [
      'EXTF', '300', '21', 'Buchungsstapel', '7', // DATEV format headers
      format(new Date(), 'yyyyMMdd', { locale: de }),
      '', '', '', options.consultant || '', options.clientNumber || '',
      format(options.startDate, 'yyyyMMdd', { locale: de }),
      format(options.endDate, 'yyyyMMdd', { locale: de }),
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ].join(';');

    const columnHeaders = [
      'Umsatz (ohne Soll/Haben-Kz)',
      'Soll/Haben-Kennzeichen',
      'WKZ Umsatz',
      'Kurs',
      'Basis-Umsatz',
      'WKZ Basis-Umsatz',
      'Konto',
      'Gegenkonto (ohne BU-Schlüssel)',
      'BU-Schlüssel',
      'Belegdatum',
      'Belegfeld 1',
      'Belegfeld 2',
      'Skonto',
      'Buchungstext'
    ].join(';');

    const dataRows = records.map(record => [
      record.umsatz,
      'S', // Soll (Debit)
      'EUR',
      '',
      '',
      '',
      record.sollKonto,
      record.habenKonto,
      record.steuerschluessel,
      record.belegdatum,
      record.belegfeld1,
      record.belegfeld2,
      record.skonto,
      record.buchungstext
    ].join(';'));

    return [headers, columnHeaders, ...dataRows].join('\n');
  }

  /**
   * Generates DATEV XML format
   */
  private generateDatevXml(records: DatevRecord[], options: DatevExportOptions, company: any): string {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <Header>
    <Version>3.0</Version>
    <DataCategory>21</DataCategory>
    <FormatName>Buchungsstapel</FormatName>
    <FormatVersion>7</FormatVersion>
    <GeneratingSystem>FinTech SaaS</GeneratingSystem>
    <Consultant>${options.consultant || ''}</Consultant>
    <Client>${options.clientNumber || ''}</Client>
    <FiscalYearBegin>${format(options.startDate, 'yyyyMMdd')}</FiscalYearBegin>
    <FiscalYearEnd>${format(options.endDate, 'yyyyMMdd')}</FiscalYearEnd>
    <CreatedAt>${format(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ss')}</CreatedAt>
  </Header>
  <Transactions>`;

    const xmlRecords = records.map((record, index) => `
    <Transaction id="${index + 1}">
      <Amount>${record.umsatz}</Amount>
      <DebitAccount>${record.sollKonto}</DebitAccount>
      <CreditAccount>${record.habenKonto}</CreditAccount>
      <TaxKey>${record.steuerschluessel}</TaxKey>
      <DocumentDate>${record.belegdatum}</DocumentDate>
      <DocumentNumber>${record.belegfeld1}</DocumentNumber>
      <Reference>${record.belegfeld2}</Reference>
      <Discount>${record.skonto}</Discount>
      <PostingText>${this.escapeXml(record.buchungstext)}</PostingText>
    </Transaction>`).join('');

    const xmlFooter = `
  </Transactions>
</Document>`;

    return xmlHeader + xmlRecords + xmlFooter;
  }

  /**
   * Helper methods for account mapping
   */
  private getDebtorAccount(vendor: string, config: any): string {
    // Map vendor to debtor account based on configuration
    const vendorAccounts = config.vendorAccounts || {};
    return vendorAccounts[vendor] || config.defaultDebtorAccount || '1400';
  }

  private getCreditorAccount(vendor: string, config: any): string {
    const creditorAccounts = config.creditorAccounts || {};
    return creditorAccounts[vendor] || config.defaultCreditorAccount || '1600';
  }

  private getRevenueAccount(category: string, config: any): string {
    const revenueAccounts = config.revenueAccounts || {};
    return revenueAccounts[category] || config.defaultRevenueAccount || '8400';
  }

  private getExpenseAccount(category: string, config: any): string {
    const expenseAccounts = config.expenseAccounts || {};
    return expenseAccounts[category] || config.defaultExpenseAccount || '6300';
  }

  private getTaxAccount(type: 'INPUT_TAX' | 'OUTPUT_TAX', config: any): string {
    const taxAccounts = config.taxAccounts || {};
    return type === 'INPUT_TAX' 
      ? (taxAccounts.inputTax || '1576')
      : (taxAccounts.outputTax || '1776');
  }

  private getTaxKey(taxAmount: number, totalAmount: number): string {
    if (taxAmount === 0) return '0';
    
    const taxRate = (taxAmount / (totalAmount - taxAmount)) * 100;
    
    // German tax keys
    if (Math.abs(taxRate - 19) < 0.1) return '3'; // 19% USt
    if (Math.abs(taxRate - 7) < 0.1) return '2';  // 7% USt
    if (Math.abs(taxRate - 16) < 0.1) return '5'; // 16% USt (COVID rate)
    
    return '0'; // No tax
  }

  private formatAmount(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }

  private formatDate(date: Date): string {
    return format(date, 'ddMMyy', { locale: de });
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private generateFilename(options: DatevExportOptions): string {
    const startDate = format(options.startDate, 'yyyyMMdd');
    const endDate = format(options.endDate, 'yyyyMMdd');
    const timestamp = format(new Date(), 'HHmmss');
    const extension = options.format.toLowerCase();
    
    return `DATEV_Export_${startDate}_${endDate}_${timestamp}.${extension}`;
  }

  /**
   * Sets up DATEV configuration for a company
   */
  async setupDatevConfig(companyId: string, config: {
    consultant: string;
    clientNumber: string;
    defaultDebtorAccount: string;
    defaultCreditorAccount: string;
    defaultRevenueAccount: string;
    defaultExpenseAccount: string;
    vendorAccounts?: Record<string, string>;
    revenueAccounts?: Record<string, string>;
    expenseAccounts?: Record<string, string>;
    taxAccounts?: {
      inputTax: string;
      outputTax: string;
    };
  }): Promise<void> {
    await prisma.integrationConfig.upsert({
      where: {
        companyId_type_name: {
          companyId,
          type: 'DATEV',
          name: 'Main Configuration'
        }
      },
      update: {
        config: config as any
      },
      create: {
        companyId,
        type: 'DATEV',
        name: 'Main Configuration',
        config: config as any
      }
    });
  }
}

export const datevExporter = new DatevExporter();