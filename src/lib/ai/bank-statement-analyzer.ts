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
}

export interface BankStatementData {
  accountNumber?: string;
  accountHolder?: string;
  bankName?: string;
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  openingBalance: number;
  closingBalance: number;
  transactions: BankTransaction[];
  currency: string;
  confidence: number;
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
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    transactionCount: number;
    categorizedCount: number;
    categorizationPercentage: number;
  };
}

export class BankStatementAnalyzer {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.openai.com/v1';

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

  // Parse PDF bank statement using AWS Textract
  async parsePDFStatement(
    fileBuffer: Buffer,
    filename: string = 'statement.pdf'
  ): Promise<BankStatementData> {
    try {
      console.log('Bank PDF processing: Using AWS Textract for OCR...');

      // Use AWS Textract to extract text from PDF
      const extractedText = await this.extractTextWithTextract(
        fileBuffer,
        filename
      );

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Failed to extract text from bank statement PDF');
      }

      console.log(
        `Extracted ${extractedText.length} characters from bank statement PDF`
      );

      // Parse the extracted text to find transactions
      const transactions = this.parseTextForTransactions(extractedText);

      if (transactions.length === 0) {
        throw new Error('No transactions found in bank statement');
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
        currency: 'EUR',
        confidence: 0.9,
      };
    } catch (error) {
      console.error('Error parsing bank statement PDF:', error);
      throw error;
    }
  }

  private async extractTextWithTextract(
    fileBuffer: Buffer,
    filename: string = 'statement.pdf'
  ): Promise<string> {
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

      const s3Key = `bank-statements/temp/${Date.now()}-${filename}`;
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

      // Poll for completion
      let extractedText = '';
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const getCommand = new GetDocumentTextDetectionCommand({
          JobId: jobId,
        });
        const getResponse = await textractClient.send(getCommand);

        status = getResponse.JobStatus || 'FAILED';

        if (status === 'SUCCEEDED' && getResponse.Blocks) {
          for (const block of getResponse.Blocks) {
            if (block.BlockType === 'LINE' && block.Text) {
              extractedText += block.Text + '\n';
            }
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

      return extractedText.trim();
    } catch (error) {
      console.error('Error using AWS Textract for bank statement:', error);
      throw new Error(
        `AWS Textract failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseTextForTransactions(text: string): BankTransaction[] {
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
              amount: Math.abs(amount),
              currency: 'EUR',
              type: amount >= 0 ? 'income' : 'expense',
              balance,
              confidence: 0.85,
            });
          }
        } catch (error) {
          // Skip invalid matches
          continue;
        }
      }
    }

    // Sort transactions by date
    transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return transactions;
  }

  async analyzeBankStatement(
    statementData: BankStatementData,
    existingTransactions: BankTransaction[] = []
  ): Promise<AIAnalysisResult> {
    try {
      const analysisPrompt = this.buildAnalysisPrompt(
        statementData,
        existingTransactions
      );
      const response = await this.callOpenAI(analysisPrompt);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('Error analyzing bank statement with AI:', error);
      return this.getFallbackAnalysis(statementData);
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
${index + 1}. Date: ${tx.date}
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
  .map(
    (tx, index) => `
${index + 1}. Date: ${tx.date}
   Description: ${tx.description}
   Amount: ${tx.amount} ${tx.currency}
   Category: ${tx.category || 'Uncategorized'}
`
  )
  .join('\n')}

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
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
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

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i]
        .split(',')
        .map(col => col.trim().replace(/"/g, ''));

      if (columns.length >= 4) {
        const [date, description, amount, balance] = columns;
        const numericAmount = parseFloat(amount.replace(/[€$£,]/g, ''));

        transactions.push({
          id: `tx_${Date.now()}_${i}`,
          date: this.parseDate(date),
          description: description,
          amount: Math.abs(numericAmount),
          currency: 'EUR',
          type: numericAmount >= 0 ? 'income' : 'expense',
          balance: balance
            ? parseFloat(balance.replace(/[€$£,]/g, ''))
            : undefined,
          confidence: 0.9,
        });
      }
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
      currency: 'EUR',
      confidence: 0.9,
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
      const dataRows = jsonData.slice(1) as any[][];

      // Find column indices for required fields
      const dateIndex = this.findColumnIndex(headers, [
        'date',
        'datum',
        'transaction date',
        'valuta',
      ]);
      const descriptionIndex = this.findColumnIndex(headers, [
        'description',
        'beschreibung',
        'text',
        'reference',
        'verwendungszweck',
      ]);
      const amountIndex = this.findColumnIndex(headers, [
        'amount',
        'betrag',
        'value',
        'summe',
      ]);
      const balanceIndex = this.findColumnIndex(headers, [
        'balance',
        'saldo',
        'account balance',
        'kontostand',
      ]);

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
          !row[amountIndex]
        ) {
          continue; // Skip empty rows
        }

        const date = this.parseDate(String(row[dateIndex]));
        const description = String(row[descriptionIndex]).trim();
        const amount = this.parseAmount(String(row[amountIndex]));
        const balance =
          balanceIndex !== -1 && row[balanceIndex]
            ? this.parseAmount(String(row[balanceIndex]))
            : undefined;

        if (isNaN(amount) || amount === 0) {
          continue; // Skip invalid amounts
        }

        transactions.push({
          id: `tx_${Date.now()}_${i}`,
          date,
          description,
          amount: Math.abs(amount),
          currency: 'EUR',
          type: amount >= 0 ? 'income' : 'expense',
          balance,
          confidence: 0.9,
        });
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
        currency: 'EUR',
        confidence: 0.9,
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
      const header = headers[i].toLowerCase().trim();
      for (const variation of variations) {
        if (header.includes(variation.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }

  private parseDate(dateString: string): string {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return dateString;
  }

  private parseAmount(amountString: string): number {
    // Remove currency symbols and commas, convert to number
    const cleaned = amountString.replace(/[€$£,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

export const bankStatementAnalyzer = new BankStatementAnalyzer();
