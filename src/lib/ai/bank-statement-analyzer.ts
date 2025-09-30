import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  category?: string;
  subcategory?: string;
  counterparty?: string;
  reference?: string;
  balance?: number;
  confidence: number;
  rawDescription?: string;
  iban?: string;
}

export interface BankStatementData {
  accountNumber?: string;
  accountHolder?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  openingBalance: number;
  closingBalance: number;
  transactions: BankTransaction[];
  currency: string;
  confidence: number;
  metadata?: {
    detectedFormat?: string;
    pageCount?: number;
    processingMethod?: 'csv' | 'excel' | 'pdf' | 'ai';
  };
}

export interface AIAnalysisResult {
  suggestedCategories: Array<{
    transactionId: string;
    category: string;
    subcategory?: string;
    confidence: number;
    reasoning: string;
  }>;
  duplicateDetection: Array<{
    transactionId: string;
    isDuplicate: boolean;
    duplicateOf?: string;
    confidence: number;
  }>;
  anomalyDetection: Array<{
    transactionId: string;
    anomalyType:
      | 'unusual_amount'
      | 'unusual_timing'
      | 'suspicious_pattern'
      | 'missing_counterparty';
    severity: 'low' | 'medium' | 'high';
    description: string;
    confidence: number;
  }>;
  counterpartyMapping: Array<{
    originalDescription: string;
    suggestedCounterparty: string;
    confidence: number;
  }>;
  reconciliation: Array<{
    transactionId: string;
    matchedInvoiceId?: string;
    matchedExpenseId?: string;
    matchType: 'exact' | 'fuzzy' | 'none';
    confidence: number;
  }>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    transactionCount: number;
    categorizedCount: number;
    categorizationPercentage: number;
  };
}

// Bank format templates for better parsing
interface BankFormat {
  name: string;
  identifiers: string[];
  dateFormat: string;
  amountFormat: 'comma' | 'dot';
  columnHints: {
    date: string[];
    description: string[];
    amount: string[];
    balance: string[];
    reference: string[];
  };
}

const BANK_FORMATS: BankFormat[] = [
  {
    name: 'Deutsche Bank',
    identifiers: ['Deutsche Bank', 'DEUTSCHE BANK AG'],
    dateFormat: 'DD.MM.YYYY',
    amountFormat: 'comma',
    columnHints: {
      date: ['Buchungstag', 'Valuta', 'Datum'],
      description: ['Buchungstext', 'Verwendungszweck', 'Text'],
      amount: ['Betrag', 'Umsatz'],
      balance: ['Saldo', 'Kontostand'],
      reference: ['Auftraggeber', 'Empfänger'],
    },
  },
  {
    name: 'Sparkasse',
    identifiers: ['Sparkasse', 'SPARKASSE'],
    dateFormat: 'DD.MM.YYYY',
    amountFormat: 'comma',
    columnHints: {
      date: ['Buchungstag', 'Wertstellung'],
      description: ['Verwendungszweck', 'Buchungstext'],
      amount: ['Betrag', 'Umsatz'],
      balance: ['Saldo'],
      reference: ['Auftraggeber/Empfänger'],
    },
  },
  {
    name: 'N26',
    identifiers: ['N26', 'Number26'],
    dateFormat: 'YYYY-MM-DD',
    amountFormat: 'dot',
    columnHints: {
      date: ['Date', 'Datum'],
      description: ['Payee', 'Description', 'Verwendungszweck'],
      amount: ['Amount', 'Betrag'],
      balance: ['Balance', 'Saldo'],
      reference: ['Payment Reference'],
    },
  },
  {
    name: 'Commerzbank',
    identifiers: ['Commerzbank', 'COMMERZBANK'],
    dateFormat: 'DD.MM.YYYY',
    amountFormat: 'comma',
    columnHints: {
      date: ['Buchungstag', 'Wertstellung'],
      description: ['Buchungstext', 'Verwendungszweck'],
      amount: ['Betrag', 'Umsatz'],
      balance: ['Saldo'],
      reference: ['Auftraggeber', 'Zahlungsempfänger'],
    },
  },
  {
    name: 'ING',
    identifiers: ['ING-DiBa', 'ING'],
    dateFormat: 'DD.MM.YYYY',
    amountFormat: 'comma',
    columnHints: {
      date: ['Buchung', 'Valuta'],
      description: ['Verwendungszweck', 'Buchungstext'],
      amount: ['Betrag', 'Umsatz'],
      balance: ['Saldo'],
      reference: ['Auftraggeber/Empfänger'],
    },
  },
];

export class BankStatementAnalyzer {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.openai.com/v1';
  private maxRetries: number = 3;
  private s3KeysToCleanup: string[] = [];

  constructor() {
    // Lazy initialization - only check at runtime, not at module load
    this.apiKey = null;
  }

  private getApiKey(): string {
    if (this.apiKey) {
      return this.apiKey;
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.apiKey = process.env.OPENAI_API_KEY;
    return this.apiKey;
  }

  // Detect bank format from text
  private detectBankFormat(text: string): BankFormat | null {
    for (const format of BANK_FORMATS) {
      for (const identifier of format.identifiers) {
        if (text.includes(identifier)) {
          console.log(`Detected bank format: ${format.name}`);
          return format;
        }
      }
    }
    return null;
  }

  // Extract currency from text
  private detectCurrency(text: string): string {
    const currencyPatterns = [
      { pattern: /\bEUR\b|€/i, currency: 'EUR' },
      { pattern: /\bUSD\b|\$/i, currency: 'USD' },
      { pattern: /\bGBP\b|£/i, currency: 'GBP' },
      { pattern: /\bCHF\b/i, currency: 'CHF' },
    ];

    for (const { pattern, currency } of currencyPatterns) {
      if (pattern.test(text)) {
        return currency;
      }
    }

    return 'EUR'; // Default fallback
  }

  // Extract counterparty from description
  private extractCounterparty(description: string): string {
    if (!description) return '';

    let cleaned = description;

    // Remove common prefixes
    cleaned = cleaned.replace(
      /^(SEPA|SEPA-ÜBERWEISUNG|LASTSCHRIFT|KARTENZAHLUNG|VISA|MASTERCARD|PAYPAL|STRIPE|DIRECT DEBIT|STANDING ORDER|TRANSFER)\s*/i,
      ''
    );

    // Remove transaction IDs and reference numbers (10+ digits)
    cleaned = cleaned.replace(/\b\d{10,}\b/g, '');

    // Remove IBANs
    cleaned = cleaned.replace(/\b[A-Z]{2}\d{2}[A-Z0-9]+\b/g, '');

    // Remove BICs
    cleaned = cleaned.replace(/\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b/g, '');

    // Remove common German banking terms
    cleaned = cleaned.replace(
      /\b(VERWENDUNGSZWECK|AUFTRAGGEBER|EMPFÄNGER|REFERENZ|MANDATSREF|KUNDENREF|END-TO-END-REF)\b/gi,
      ''
    );

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Take first significant part (before double space or special chars)
    const parts = cleaned.split(/\s{2,}|\//);
    cleaned = parts[0] || cleaned;

    return cleaned.substring(0, 100); // Max length
  }

  // Parse PDF bank statement using AWS Textract + AI
  async parsePDFStatement(
    fileBuffer: Buffer,
    filename: string = 'statement.pdf'
  ): Promise<BankStatementData> {
    let s3Key: string | undefined;

    try {
      console.log('Bank PDF processing: Using AWS Textract for OCR...');

      // Use AWS Textract to extract text from PDF
      const { extractedText, s3Key: uploadedKey } =
        await this.extractTextWithTextract(fileBuffer, filename);

      s3Key = uploadedKey;

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Failed to extract text from bank statement PDF');
      }

      console.log(
        `Extracted ${extractedText.length} characters from bank statement PDF`
      );

      // Detect bank format and currency
      const detectedFormat = this.detectBankFormat(extractedText);
      const currency = this.detectCurrency(extractedText);

      // Use AI to parse the extracted text instead of regex
      const statementData = await this.parseTextWithAI(
        extractedText,
        currency,
        detectedFormat?.name
      );

      // Add metadata
      statementData.metadata = {
        detectedFormat: detectedFormat?.name,
        processingMethod: 'pdf',
      };

      // Clean up S3 file after successful processing
      await this.cleanupS3Files([s3Key]);

      return statementData;
    } catch (error) {
      console.error('Error parsing bank statement PDF:', error);

      // Clean up S3 file on error
      if (s3Key) {
        await this.cleanupS3Files([s3Key]);
      }

      throw error;
    }
  }

  private async extractTextWithTextract(
    fileBuffer: Buffer,
    filename: string = 'statement.pdf'
  ): Promise<{ extractedText: string; s3Key: string }> {
    let s3Key: string = '';

    try {
      // Import AWS SDK dynamically
      const {
        TextractClient,
        StartDocumentTextDetectionCommand,
        GetDocumentTextDetectionCommand,
      } = await import('@aws-sdk/client-textract');
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      // Upload to S3 first (Textract requires S3 for PDFs)
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      s3Key = `bank-statements/temp/${Date.now()}-${filename}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/pdf',
        })
      );

      console.log(`Uploaded bank statement to S3: ${s3Key}`);

      // Initialize Textract client
      const textractClient = new TextractClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      // Start async text detection
      const startCommand = new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: process.env.S3_BUCKET_NAME || '',
            Name: s3Key,
          },
        },
      });

      const startResponse = await textractClient.send(startCommand);
      const jobId = startResponse.JobId;

      if (!jobId) {
        throw new Error('Failed to start Textract job');
      }

      console.log(`Textract job started: ${jobId}`);

      // Poll for completion with increased timeout and pagination support
      let extractedText = '';
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max for large files
      let nextToken: string | undefined;

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const getCommand = new GetDocumentTextDetectionCommand({
          JobId: jobId,
          NextToken: nextToken,
        });
        const getResponse = await textractClient.send(getCommand);

        status = getResponse.JobStatus || 'FAILED';

        if (status === 'SUCCEEDED' && getResponse.Blocks) {
          for (const block of getResponse.Blocks) {
            if (block.BlockType === 'LINE' && block.Text) {
              extractedText += block.Text + '\n';
            }
          }

          // Handle pagination
          nextToken = getResponse.NextToken;
          if (nextToken) {
            status = 'IN_PROGRESS'; // Continue to get next page
          }
        }

        attempts++;
      }

      if (status !== 'SUCCEEDED') {
        throw new Error(`Textract job ${status}`);
      }

      console.log(
        `Textract completed. Extracted ${extractedText.length} characters`
      );

      return { extractedText: extractedText.trim(), s3Key };
    } catch (error) {
      console.error('Error using AWS Textract for bank statement:', error);
      throw new Error(
        `AWS Textract failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Clean up S3 files
  private async cleanupS3Files(s3Keys: string[]): Promise<void> {
    if (s3Keys.length === 0) return;

    try {
      const { S3Client, DeleteObjectsCommand } = await import(
        '@aws-sdk/client-s3'
      );

      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Delete: {
            Objects: s3Keys.map(key => ({ Key: key })),
          },
        })
      );

      console.log(`Cleaned up ${s3Keys.length} S3 files`);
    } catch (error) {
      console.error('Error cleaning up S3 files:', error);
      // Don't throw - cleanup is best effort
    }
  }

  // Use AI to parse extracted text into structured transactions
  private async parseTextWithAI(
    text: string,
    currency: string = 'EUR',
    bankName?: string
  ): Promise<BankStatementData> {
    const prompt = `You are a bank statement parser. Extract ALL transaction data from this bank statement text.

BANK: ${bankName || 'Unknown'}
EXPECTED CURRENCY: ${currency}

STATEMENT TEXT:
${text.substring(0, 8000)} ${text.length > 8000 ? '... (truncated)' : ''}

Extract the following information:
1. Account number (IBAN if available)
2. Account holder name
3. Statement period (start and end dates)
4. Opening balance
5. Closing balance
6. ALL transactions with:
   - Date (format as YYYY-MM-DD)
   - Description (full text)
   - Amount (positive for income, negative for expenses)
   - Balance after transaction (if shown)
   - Reference/IBAN of counterparty (if shown)

Return ONLY valid JSON in this exact format:
{
  "accountNumber": "string or null",
  "accountHolder": "string or null",
  "iban": "string or null",
  "bankName": "string or null",
  "statementPeriod": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  },
  "openingBalance": number,
  "closingBalance": number,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "balance": number or null,
      "reference": "string or null"
    }
  ]
}`;

    try {
      const response = await this.callOpenAIWithRetry(prompt);
      const parsed = JSON.parse(response);

      // Convert to our format
      const transactions: BankTransaction[] = (parsed.transactions || []).map(
        (
          tx: {
            date: string;
            description: string;
            amount: number;
            balance?: number;
            reference?: string;
          },
          index: number
        ) => ({
          id: `tx_${Date.now()}_${index}`,
          date: tx.date,
          description: tx.description,
          rawDescription: tx.description,
          amount: Math.abs(tx.amount),
          currency: currency,
          type: tx.amount >= 0 ? 'income' : 'expense',
          balance: tx.balance,
          reference: tx.reference,
          counterparty: this.extractCounterparty(tx.description),
          confidence: 0.9,
        })
      );

      return {
        accountNumber: parsed.accountNumber || undefined,
        accountHolder: parsed.accountHolder || undefined,
        bankName: parsed.bankName || bankName,
        iban: parsed.iban || undefined,
        statementPeriod: parsed.statementPeriod,
        openingBalance: parsed.openingBalance || 0,
        closingBalance: parsed.closingBalance || 0,
        transactions,
        currency,
        confidence: 0.9,
      };
    } catch (err) {
      console.error('Error parsing with AI, falling back to regex:', err);
      // Fallback to basic regex parsing
      return this.parseTextForTransactionsFallback(text, currency);
    }
  }

  // Fallback regex-based parsing
  private parseTextForTransactionsFallback(
    text: string,
    currency: string = 'EUR'
  ): BankStatementData {
    const transactions: BankTransaction[] = [];

    // Common patterns for bank transactions
    const patterns = [
      // Pattern: Date, Description, Amount, Balance
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([+-]?[\d,]+\.?\d*)\s+([+-]?[\d,]+\.?\d*)/g,
      // Pattern: Date, Amount, Description
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([+-]?[\d,]+\.?\d*)\s+(.+?)(?=\n|$)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          const date = this.parseDate(match[1]);
          const description = (match[2] || '').trim();
          const amount = this.parseAmount(match[3] || match[2]);
          const balance = match[4] ? this.parseAmount(match[4]) : undefined;

          if (description && !isNaN(amount) && amount !== 0) {
            transactions.push({
              id: `tx_${Date.now()}_${transactions.length}`,
              date,
              description,
              rawDescription: description,
              amount: Math.abs(amount),
              currency: currency,
              type: amount >= 0 ? 'income' : 'expense',
              balance,
              counterparty: this.extractCounterparty(description),
              confidence: 0.7,
            });
          }
        } catch {
          // Skip invalid matches
          continue;
        }
      }
    }

    // Sort transactions by date
    transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      statementPeriod: {
        startDate:
          transactions[0]?.date || new Date().toISOString().split('T')[0],
        endDate:
          transactions[transactions.length - 1]?.date ||
          new Date().toISOString().split('T')[0],
      },
      openingBalance: transactions[0]?.balance || 0,
      closingBalance: transactions[transactions.length - 1]?.balance || 0,
      transactions,
      currency: currency,
      confidence: 0.7,
      metadata: {
        processingMethod: 'ai',
      },
    };
  }

  async analyzeBankStatement(
    statementData: BankStatementData,
    companyId?: string
  ): Promise<AIAnalysisResult> {
    try {
      // Get existing transactions from database for duplicate detection
      const existingTransactions = companyId
        ? await this.getExistingTransactions(
            companyId,
            statementData.statementPeriod
          )
        : [];

      const analysisPrompt = this.buildAnalysisPrompt(
        statementData,
        existingTransactions
      );
      const response = await this.callOpenAIWithRetry(analysisPrompt);
      const analysis = this.parseAnalysisResponse(response);

      // Add reconciliation if company ID provided
      if (companyId) {
        analysis.reconciliation = await this.reconcileTransactions(
          statementData.transactions,
          companyId
        );
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing bank statement with AI:', error);
      return this.getFallbackAnalysis(statementData);
    }
  }

  // Get existing transactions from database
  private async getExistingTransactions(
    companyId: string,
    period: { startDate: string; endDate: string }
  ): Promise<BankTransaction[]> {
    try {
      // Query database for existing transactions via bank accounts
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { companyId },
        select: { id: true },
      });

      const accountIds = bankAccounts.map(acc => acc.id);

      const existingTxs = await prisma.transaction.findMany({
        where: {
          bankAccountId: { in: accountIds },
          date: {
            gte: new Date(period.startDate),
            lte: new Date(period.endDate),
          },
        },
        select: {
          id: true,
          date: true,
          description: true,
          amount: true,
          currency: true,
          type: true,
          category: true,
          subcategory: true,
          counterparty: true,
          reference: true,
          confidence: true,
        },
        orderBy: { date: 'asc' },
        take: 1000, // Limit for performance
      });

      return existingTxs.map(tx => ({
        id: tx.id,
        date: tx.date.toISOString().split('T')[0],
        description: tx.description,
        amount: Number(tx.amount),
        currency: tx.currency,
        type: tx.type === 'INCOME' ? 'income' : 'expense',
        category: tx.category || undefined,
        subcategory: tx.subcategory || undefined,
        counterparty: tx.counterparty || undefined,
        reference: tx.reference || undefined,
        confidence: tx.confidence || 1.0,
      }));
    } catch (error) {
      console.error('Error fetching existing transactions:', error);
      return [];
    }
  }

  // Reconcile transactions with invoices and expenses
  private async reconcileTransactions(
    transactions: BankTransaction[],
    companyId: string
  ): Promise<AIAnalysisResult['reconciliation']> {
    try {
      const reconciliation: AIAnalysisResult['reconciliation'] = [];

      // Get unpaid invoices
      const unpaidInvoices = await prisma.invoice.findMany({
        where: {
          companyId,
          status: { in: ['APPROVED', 'PROCESSING'] },
        },
        select: {
          id: true,
          totalAmount: true,
          dueDate: true,
          vendor: true,
        },
      });

      for (const tx of transactions) {
        let matched = false;

        // Try to match with invoices
        for (const invoice of unpaidInvoices) {
          // Exact amount match
          if (Math.abs(tx.amount - Number(invoice.totalAmount)) < 0.01) {
            // Check if dates are within reasonable range (±7 days)
            const txDate = new Date(tx.date);
            const dueDate = invoice.dueDate
              ? new Date(invoice.dueDate)
              : txDate;
            const daysDiff = Math.abs(
              (txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysDiff <= 7) {
              reconciliation.push({
                transactionId: tx.id,
                matchedInvoiceId: invoice.id,
                matchType: 'exact',
                confidence: 0.95,
              });
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          reconciliation.push({
            transactionId: tx.id,
            matchType: 'none',
            confidence: 0,
          });
        }
      }

      return reconciliation;
    } catch (error) {
      console.error('Error reconciling transactions:', error);
      return [];
    }
  }

  // Save transactions to database
  async saveTransactions(
    statementData: BankStatementData,
    companyId: string,
    analysis: AIAnalysisResult
  ): Promise<void> {
    try {
      // Get or create a default bank account for this company
      let bankAccount = await prisma.bankAccount.findFirst({
        where: { companyId },
      });

      if (!bankAccount) {
        bankAccount = await prisma.bankAccount.create({
          data: {
            companyId,
            name: statementData.bankName || 'Default Account',
            iban: statementData.iban || 'UNKNOWN',
            bankName: statementData.bankName || 'Unknown Bank',
            balance: statementData.closingBalance,
          },
        });
      }

      // Create transactions in database
      for (const tx of statementData.transactions) {
        // Find suggested category from analysis
        const suggestion = analysis.suggestedCategories.find(
          s => s.transactionId === tx.id
        );

        // Check if it's a duplicate
        const duplicate = analysis.duplicateDetection.find(
          d => d.transactionId === tx.id && d.isDuplicate
        );

        if (duplicate?.isDuplicate) {
          console.log(`Skipping duplicate transaction: ${tx.id}`);
          continue;
        }

        await prisma.transaction.create({
          data: {
            id: tx.id,
            bankAccountId: bankAccount.id,
            date: new Date(tx.date),
            description: tx.description,
            amount: tx.amount,
            currency: tx.currency,
            type: tx.type === 'income' ? 'INCOME' : 'EXPENSE',
            category: suggestion?.category,
            subcategory: suggestion?.subcategory,
            counterparty: tx.counterparty,
            reference: tx.reference,
            // balance: tx.balance,  // Uncomment after running migration
            confidence: tx.confidence,
            originalDescription: tx.rawDescription,
            aiProcessed: true,
            aiProcessedAt: new Date(),
            // metadata: {  // Uncomment after running migration
            //   rawDescription: tx.rawDescription,
            //   aiReasoning: suggestion?.reasoning,
            // },
          },
        });
      }

      console.log(
        `Saved ${statementData.transactions.length} transactions to database`
      );
    } catch (error) {
      console.error('Error saving transactions to database:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(
    statementData: BankStatementData,
    existingTransactions: BankTransaction[]
  ): string {
    return `
You are an AI financial analyst specializing in bank statement processing and transaction categorization. Analyze the following bank statement and provide intelligent recommendations.

BANK STATEMENT DATA:
- Account: ${statementData.accountNumber || 'Not specified'}
- Account Holder: ${statementData.accountHolder || 'Not specified'}
- Bank: ${statementData.bankName || 'Not specified'}
- Period: ${statementData.statementPeriod.startDate} to ${statementData.statementPeriod.endDate}
- Opening Balance: ${statementData.openingBalance} ${statementData.currency}
- Closing Balance: ${statementData.closingBalance} ${statementData.currency}
- Currency: ${statementData.currency}

TRANSACTIONS TO ANALYZE:
${statementData.transactions
  .map(
    (tx, index) => `
${index + 1}. ID: ${tx.id}
   Date: ${tx.date}
   Description: ${tx.description}
   Amount: ${tx.amount} ${tx.currency}
   Type: ${tx.type}
   Reference: ${tx.reference || 'N/A'}
   Balance: ${tx.balance || 'N/A'}
`
  )
  .join('\n')}

EXISTING TRANSACTIONS (for duplicate detection):
${existingTransactions
  .slice(0, 50)
  .map(
    (tx, index) => `
${index + 1}. Date: ${tx.date}
   Description: ${tx.description}
   Amount: ${tx.amount} ${tx.currency}
   Category: ${tx.category || 'Uncategorized'}
`
  )
  .join('\n')}
${existingTransactions.length > 50 ? `... and ${existingTransactions.length - 50} more` : ''}

ANALYSIS REQUIREMENTS:

1. CATEGORIZATION: For each transaction, suggest appropriate categories and subcategories:
   - Income categories: Sales, Investments, Grants, Refunds, Other Income
   - Expense categories: Office Supplies, Software, Hardware, Personnel, Consulting, Travel, Marketing, Rent, Utilities, Insurance, Communication, Training, Research, Development, Equipment, Maintenance, Legal, Accounting, Banking, Taxes, Other Expenses
   - Subcategories should be more specific (e.g., "Software" -> "SaaS Subscriptions", "Office Supplies" -> "Stationery")

2. DUPLICATE DETECTION: Identify potential duplicate transactions by comparing:
   - Amount and date proximity (±1 day)
   - Description similarity
   - Reference number matches
   - Pattern recognition

3. ANOMALY DETECTION: Flag unusual transactions:
   - Unusually high/low amounts compared to typical patterns
   - Transactions outside normal business hours/days
   - Suspicious patterns (round numbers, frequent small amounts)
   - Missing counterparty information

4. COUNTERPARTY MAPPING: Clean up and standardize counterparty names:
   - Remove transaction references and codes
   - Standardize company names
   - Group similar entities

5. SUMMARY STATISTICS: Calculate key metrics for the statement period.

RESPONSE FORMAT (JSON):
{
  "suggestedCategories": [
    {
      "transactionId": "transaction-id",
      "category": "Software",
      "subcategory": "SaaS Subscriptions",
      "confidence": 0.95,
      "reasoning": "Transaction description mentions 'Adobe Creative Cloud' which is clearly a software subscription"
    }
  ],
  "duplicateDetection": [
    {
      "transactionId": "transaction-id",
      "isDuplicate": false,
      "duplicateOf": null,
      "confidence": 0.90
    }
  ],
  "anomalyDetection": [
    {
      "transactionId": "transaction-id",
      "anomalyType": "unusual_amount",
      "severity": "medium",
      "description": "Transaction amount is 300% higher than typical monthly average",
      "confidence": 0.85
    }
  ],
  "counterpartyMapping": [
    {
      "originalDescription": "PAYPAL *ADOBE SYSTEMS 1234567890",
      "suggestedCounterparty": "Adobe Systems",
      "confidence": 0.95
    }
  ],
  "summary": {
    "totalIncome": 15000.00,
    "totalExpenses": 8500.00,
    "netCashFlow": 6500.00,
    "transactionCount": 45,
    "categorizedCount": 42,
    "categorizationPercentage": 93.3
  }
}

Provide your analysis in valid JSON format only.
`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial analyst AI that processes bank statements and categorizes transactions. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Call OpenAI with retry logic
  private async callOpenAIWithRetry(
    prompt: string,
    retries: number = 0
  ): Promise<string> {
    try {
      return await this.callOpenAI(prompt);
    } catch (error) {
      if (retries < this.maxRetries) {
        console.log(
          `OpenAI call failed, retrying (${retries + 1}/${this.maxRetries})...`
        );
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
        return this.callOpenAIWithRetry(prompt, retries + 1);
      }
      throw error;
    }
  }

  private parseAnalysisResponse(response: string): AIAnalysisResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        suggestedCategories: parsed.suggestedCategories || [],
        duplicateDetection: parsed.duplicateDetection || [],
        anomalyDetection: parsed.anomalyDetection || [],
        counterpartyMapping: parsed.counterpartyMapping || [],
        reconciliation: [],
        summary: parsed.summary || {
          totalIncome: 0,
          totalExpenses: 0,
          netCashFlow: 0,
          transactionCount: 0,
          categorizedCount: 0,
          categorizationPercentage: 0,
        },
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.getFallbackAnalysis();
    }
  }

  private getFallbackAnalysis(
    statementData?: BankStatementData
  ): AIAnalysisResult {
    const transactionCount = statementData?.transactions.length || 0;
    return {
      suggestedCategories: [],
      duplicateDetection: [],
      anomalyDetection: [],
      counterpartyMapping: [],
      reconciliation: [],
      summary: {
        totalIncome: 0,
        totalExpenses: 0,
        netCashFlow: 0,
        transactionCount,
        categorizedCount: 0,
        categorizationPercentage: 0,
      },
    };
  }

  // Parse CSV bank statement data
  parseCSVStatement(csvContent: string): BankStatementData {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const transactions: BankTransaction[] = [];

    if (lines.length < 2) {
      throw new Error(
        'CSV file must contain at least a header row and one data row'
      );
    }

    // Detect format from header
    const header = lines[0].toLowerCase();
    const detectedFormat = this.detectBankFormat(header);
    const currency = this.detectCurrency(csvContent);

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i]
        .split(',')
        .map(col => col.trim().replace(/^"|"$/g, ''));

      if (columns.length >= 3) {
        try {
          const date = this.parseDate(columns[0]);
          const description = columns[1] || '';
          const amount = this.parseAmount(columns[2]);
          const balance = columns[3] ? this.parseAmount(columns[3]) : undefined;

          if (!isNaN(amount) && amount !== 0) {
            transactions.push({
              id: `tx_${Date.now()}_${i}`,
              date,
              description,
              rawDescription: description,
              amount: Math.abs(amount),
              currency,
              type: amount >= 0 ? 'income' : 'expense',
              balance,
              counterparty: this.extractCounterparty(description),
              confidence: 0.9,
            });
          }
        } catch (error) {
          console.warn(`Skipping invalid CSV row ${i}:`, error);
          continue;
        }
      }
    }

    if (transactions.length === 0) {
      throw new Error('No valid transactions found in CSV file');
    }

    return {
      statementPeriod: {
        startDate:
          transactions[0]?.date || new Date().toISOString().split('T')[0],
        endDate:
          transactions[transactions.length - 1]?.date ||
          new Date().toISOString().split('T')[0],
      },
      openingBalance: transactions[0]?.balance || 0,
      closingBalance: transactions[transactions.length - 1]?.balance || 0,
      transactions,
      currency,
      confidence: 0.9,
      metadata: {
        detectedFormat: detectedFormat?.name,
        processingMethod: 'csv',
      },
    };
  }

  // Parse XLS/XLSX bank statement data
  parseXLSStatement(fileBuffer: Buffer): BankStatementData {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error(
          'Excel file must contain at least a header row and one data row'
        );
      }

      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1) as (
        | string
        | number
        | null
        | undefined
      )[][];

      // Detect bank format
      const headerText = headers.join(' ');
      const detectedFormat = this.detectBankFormat(headerText);
      const currency = this.detectCurrency(headerText);

      // Find column indices for required fields
      const dateIndex = this.findColumnIndex(
        headers,
        detectedFormat?.columnHints.date || [
          'date',
          'datum',
          'buchungstag',
          'transaction date',
          'valuta',
        ]
      );
      const descriptionIndex = this.findColumnIndex(
        headers,
        detectedFormat?.columnHints.description || [
          'description',
          'beschreibung',
          'text',
          'reference',
          'verwendungszweck',
          'buchungstext',
        ]
      );
      const amountIndex = this.findColumnIndex(
        headers,
        detectedFormat?.columnHints.amount || [
          'amount',
          'betrag',
          'value',
          'summe',
          'umsatz',
        ]
      );
      const balanceIndex = this.findColumnIndex(
        headers,
        detectedFormat?.columnHints.balance || [
          'balance',
          'saldo',
          'account balance',
          'kontostand',
        ]
      );

      if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
        throw new Error(
          'Excel file must contain columns for Date, Description, and Amount'
        );
      }

      const transactions: BankTransaction[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        if (
          row.length === 0 ||
          !row[dateIndex] ||
          !row[descriptionIndex] ||
          row[amountIndex] === undefined
        ) {
          continue; // Skip empty rows
        }

        try {
          const date = this.parseDate(String(row[dateIndex]));
          const description = String(row[descriptionIndex]).trim();
          const amount = this.parseAmount(String(row[amountIndex]));
          const balance =
            balanceIndex !== -1 && row[balanceIndex] !== undefined
              ? this.parseAmount(String(row[balanceIndex]))
              : undefined;

          if (isNaN(amount) || amount === 0) {
            continue; // Skip invalid amounts
          }

          transactions.push({
            id: `tx_${Date.now()}_${i}`,
            date,
            description,
            rawDescription: description,
            amount: Math.abs(amount),
            currency,
            type: amount >= 0 ? 'income' : 'expense',
            balance,
            counterparty: this.extractCounterparty(description),
            confidence: 0.9,
          });
        } catch (error) {
          console.warn(`Skipping invalid Excel row ${i + 2}:`, error);
          continue;
        }
      }

      if (transactions.length === 0) {
        throw new Error('No valid transactions found in Excel file');
      }

      return {
        statementPeriod: {
          startDate:
            transactions[0]?.date || new Date().toISOString().split('T')[0],
          endDate:
            transactions[transactions.length - 1]?.date ||
            new Date().toISOString().split('T')[0],
        },
        openingBalance: transactions[0]?.balance || 0,
        closingBalance: transactions[transactions.length - 1]?.balance || 0,
        transactions,
        currency,
        confidence: 0.9,
        metadata: {
          detectedFormat: detectedFormat?.name,
          processingMethod: 'excel',
        },
      };
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      throw new Error(
        `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Helper method to find column index by name variations
  private findColumnIndex(headers: string[], variations: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '')
        .toLowerCase()
        .trim();
      for (const variation of variations) {
        if (header.includes(variation.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }

  private parseDate(dateString: string): string {
    // Handle Excel serial dates
    if (!isNaN(Number(dateString)) && Number(dateString) > 40000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(
        excelEpoch.getTime() + Number(dateString) * 24 * 60 * 60 * 1000
      );
      return date.toISOString().split('T')[0];
    }

    // Try parsing as regular date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try German date format DD.MM.YYYY
    const germanMatch = dateString.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (germanMatch) {
      const [, day, month, year] = germanMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateString;
  }

  private parseAmount(amountString: string): number {
    if (typeof amountString === 'number') {
      return amountString;
    }

    // Remove currency symbols and whitespace
    let cleaned = String(amountString)
      .replace(/[€$£\s]/g, '')
      .trim();

    // Handle German number format (comma as decimal separator)
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes('.') && cleaned.includes(',')) {
      // Both present - remove thousand separator
      if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
        // European format: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

export const bankStatementAnalyzer = new BankStatementAnalyzer();
