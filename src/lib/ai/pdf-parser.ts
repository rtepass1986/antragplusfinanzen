import pdfParse from 'pdf-parse';
import { BankStatementData, BankTransaction } from './bank-statement-analyzer';

export class PDFParser {
  // Parse PDF bank statement data (server-side only)
  async parsePDFStatement(fileBuffer: Buffer): Promise<BankStatementData> {
    try {
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text;

      // Extract transactions using regex patterns
      const transactions = this.extractTransactionsFromText(text);

      if (transactions.length === 0) {
        throw new Error('No transactions found in PDF file');
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
        confidence: 0.8, // Lower confidence for PDF parsing
      };
    } catch (error) {
      console.error('Error parsing PDF file:', error);
      throw new Error(
        `Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Extract transactions from PDF text using regex patterns
  private extractTransactionsFromText(text: string): BankTransaction[] {
    const transactions: BankTransaction[] = [];

    // Common patterns for bank statement transactions
    const patterns = [
      // Pattern 1: Date Description Amount Balance
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([+-]?[\d,]+\.?\d*)\s+([+-]?[\d,]+\.?\d*)/g,
      // Pattern 2: Date Amount Description
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([+-]?[\d,]+\.?\d*)\s+(.+?)(?=\n|\r|$)/g,
      // Pattern 3: Date Description Amount (with currency symbols)
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([+-]?[€$£]?[\d,]+\.?\d*)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          const date = this.parseDate(match[1]);
          const description = match[2]?.trim() || '';
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
              confidence: 0.7, // Lower confidence for PDF extraction
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

export const pdfParser = new PDFParser();
