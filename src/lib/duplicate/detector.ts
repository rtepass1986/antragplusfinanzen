import { prisma } from '../prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface InvoiceIdentifiers {
  invoiceNumber?: string;
  vendor: string;
  totalAmount: number;
  invoiceDate: string;
  customerName?: string;
  vendorTaxId?: string;
}

interface DuplicateResult {
  isDuplicate: boolean;
  reason?: string;
  similarInvoices: string[]; // Invoice IDs
  confidence: number; // 0-1 scale
}

interface SimilarityWeights {
  invoiceNumber: number;
  vendor: number;
  amount: number;
  date: number;
  vendorTaxId: number;
}

export class DuplicateDetector {
  private readonly weights: SimilarityWeights = {
    invoiceNumber: 0.4,
    vendor: 0.25,
    amount: 0.2,
    date: 0.1,
    vendorTaxId: 0.05
  };

  private readonly duplicateThreshold = 0.85; // 85% similarity = duplicate
  private readonly similarThreshold = 0.7;    // 70% similarity = worth reviewing

  /**
   * Checks if an invoice is a duplicate of existing invoices
   */
  async checkForDuplicates(
    identifiers: InvoiceIdentifiers, 
    companyId: string,
    excludeInvoiceId?: string
  ): Promise<DuplicateResult> {
    
    // Get potential duplicates from database
    const candidates = await this.getCandidateInvoices(identifiers, companyId, excludeInvoiceId);
    
    let maxSimilarity = 0;
    const mostSimilarInvoices: string[] = [];
    const duplicateReasons: string[] = [];

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(identifiers, {
        invoiceNumber: candidate.invoiceNumber,
        vendor: candidate.vendor,
        totalAmount: Number(candidate.totalAmount),
        invoiceDate: candidate.invoiceDate.toISOString(),
        customerName: candidate.customerName,
        vendorTaxId: candidate.vendorTaxId
      });

      if (similarity >= this.similarThreshold) {
        mostSimilarInvoices.push(candidate.id);
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }

        // Collect specific reasons for high similarity
        if (similarity >= this.duplicateThreshold) {
          const reasons = this.analyzeReasons(identifiers, candidate);
          duplicateReasons.push(...reasons);
        }
      }
    }

    const isDuplicate = maxSimilarity >= this.duplicateThreshold;
    
    return {
      isDuplicate,
      reason: isDuplicate ? duplicateReasons.join(', ') : undefined,
      similarInvoices: mostSimilarInvoices,
      confidence: maxSimilarity
    };
  }

  /**
   * Performs comprehensive duplicate check and logs results
   */
  async performDuplicateCheck(invoiceId: string): Promise<DuplicateResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const identifiers: InvoiceIdentifiers = {
      invoiceNumber: invoice.invoiceNumber,
      vendor: invoice.vendor,
      totalAmount: Number(invoice.totalAmount),
      invoiceDate: invoice.invoiceDate.toISOString(),
      customerName: invoice.customerName,
      vendorTaxId: invoice.vendorTaxId
    };

    const result = await this.checkForDuplicates(
      identifiers, 
      invoice.companyId, 
      invoiceId
    );

    // Log duplicate check results
    await prisma.duplicateCheck.create({
      data: {
        invoiceId,
        similarTo: result.similarInvoices,
        similarity: result.confidence,
        status: result.isDuplicate ? 'CONFIRMED_DUPLICATE' : 'NOT_DUPLICATE'
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        companyId: invoice.companyId,
        userId: invoice.createdById,
        action: 'DUPLICATE_CHECK',
        entity: 'Invoice',
        entityId: invoiceId,
        metadata: {
          similarity: result.confidence,
          isDuplicate: result.isDuplicate,
          similarInvoices: result.similarInvoices,
          reason: result.reason
        }
      }
    });

    return result;
  }

  /**
   * Batch duplicate detection for multiple invoices
   */
  async batchDuplicateDetection(companyId: string, limit = 100): Promise<void> {
    const uncheckedInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        duplicates: {
          none: {}
        }
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    for (const invoice of uncheckedInvoices) {
      await this.performDuplicateCheck(invoice.id);
    }
  }

  /**
   * Advanced fuzzy matching for invoice numbers
   */
  private matchInvoiceNumbers(num1?: string, num2?: string): number {
    if (!num1 || !num2) return 0;

    // Exact match
    if (num1 === num2) return 1;

    // Remove common prefixes/suffixes and special characters
    const clean1 = this.cleanInvoiceNumber(num1);
    const clean2 = this.cleanInvoiceNumber(num2);

    if (clean1 === clean2) return 0.95;

    // Levenshtein distance for fuzzy matching
    const similarity = this.calculateStringSimilarity(clean1, clean2);
    
    // Only consider high similarity for invoice numbers
    return similarity > 0.8 ? similarity : 0;
  }

  /**
   * Cleans invoice number for better matching
   */
  private cleanInvoiceNumber(invoiceNumber: string): string {
    return invoiceNumber
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .replace(/^(inv|invoice|re|rechnung|bill)/, '') // Remove common prefixes
      .replace(/(copy|kopie|duplicate)$/, ''); // Remove copy indicators
  }

  /**
   * Calculates string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * Fuzzy vendor name matching
   */
  private matchVendorNames(vendor1: string, vendor2: string): number {
    const normalized1 = this.normalizeVendorName(vendor1);
    const normalized2 = this.normalizeVendorName(vendor2);

    if (normalized1 === normalized2) return 1;

    // Check if one contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.9;
    }

    return this.calculateStringSimilarity(normalized1, normalized2);
  }

  /**
   * Normalizes vendor names for better matching
   */
  private normalizeVendorName(vendor: string): string {
    return vendor
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(gmbh|ltd|inc|corp|ag|kg|ohg|gbr)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Amount similarity with tolerance
   */
  private matchAmounts(amount1: number, amount2: number): number {
    if (amount1 === amount2) return 1;

    const tolerance = 0.01; // 1 cent tolerance
    const diff = Math.abs(amount1 - amount2);
    
    if (diff <= tolerance) return 0.99;

    // Percentage difference
    const avgAmount = (amount1 + amount2) / 2;
    const percentDiff = diff / avgAmount;

    if (percentDiff <= 0.001) return 0.95; // 0.1% difference
    if (percentDiff <= 0.01) return 0.85;  // 1% difference
    if (percentDiff <= 0.05) return 0.7;   // 5% difference

    return 0;
  }

  /**
   * Date similarity with tolerance
   */
  private matchDates(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;

    const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 1;
    if (diffDays <= 1) return 0.9;
    if (diffDays <= 7) return 0.7;
    if (diffDays <= 30) return 0.5;

    return 0;
  }

  /**
   * Main similarity calculation
   */
  private calculateSimilarity(invoice1: InvoiceIdentifiers, invoice2: InvoiceIdentifiers): number {
    let totalWeight = 0;
    let weightedScore = 0;

    // Invoice number similarity
    if (invoice1.invoiceNumber && invoice2.invoiceNumber) {
      const similarity = this.matchInvoiceNumbers(invoice1.invoiceNumber, invoice2.invoiceNumber);
      weightedScore += similarity * this.weights.invoiceNumber;
      totalWeight += this.weights.invoiceNumber;
    }

    // Vendor similarity
    const vendorSimilarity = this.matchVendorNames(invoice1.vendor, invoice2.vendor);
    weightedScore += vendorSimilarity * this.weights.vendor;
    totalWeight += this.weights.vendor;

    // Amount similarity
    const amountSimilarity = this.matchAmounts(invoice1.totalAmount, invoice2.totalAmount);
    weightedScore += amountSimilarity * this.weights.amount;
    totalWeight += this.weights.amount;

    // Date similarity
    const dateSimilarity = this.matchDates(invoice1.invoiceDate, invoice2.invoiceDate);
    weightedScore += dateSimilarity * this.weights.date;
    totalWeight += this.weights.date;

    // Vendor tax ID similarity
    if (invoice1.vendorTaxId && invoice2.vendorTaxId) {
      const taxIdSimilarity = invoice1.vendorTaxId === invoice2.vendorTaxId ? 1 : 0;
      weightedScore += taxIdSimilarity * this.weights.vendorTaxId;
      totalWeight += this.weights.vendorTaxId;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Gets candidate invoices for duplicate checking
   */
  private async getCandidateInvoices(
    identifiers: InvoiceIdentifiers, 
    companyId: string,
    excludeInvoiceId?: string
  ) {
    const where: any = {
      companyId,
      OR: [
        // Same invoice number
        identifiers.invoiceNumber ? { invoiceNumber: identifiers.invoiceNumber } : {},
        // Same vendor with similar amount
        {
          vendor: {
            contains: identifiers.vendor,
            mode: 'insensitive'
          },
          totalAmount: {
            gte: identifiers.totalAmount * 0.95,
            lte: identifiers.totalAmount * 1.05
          }
        }
      ]
    };

    if (excludeInvoiceId) {
      where.NOT = { id: excludeInvoiceId };
    }

    return await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        vendor: true,
        totalAmount: true,
        invoiceDate: true,
        customerName: true,
        vendorTaxId: true
      }
    });
  }

  /**
   * Analyzes specific reasons for duplicate detection
   */
  private analyzeReasons(invoice1: InvoiceIdentifiers, invoice2: any): string[] {
    const reasons: string[] = [];

    if (invoice1.invoiceNumber === invoice2.invoiceNumber) {
      reasons.push('Identical invoice number');
    }

    if (invoice1.totalAmount === Number(invoice2.totalAmount)) {
      reasons.push('Exact amount match');
    }

    const vendorSimilarity = this.matchVendorNames(invoice1.vendor, invoice2.vendor);
    if (vendorSimilarity > 0.95) {
      reasons.push('Nearly identical vendor name');
    }

    if (invoice1.vendorTaxId && invoice2.vendorTaxId && invoice1.vendorTaxId === invoice2.vendorTaxId) {
      reasons.push('Same vendor tax ID');
    }

    return reasons;
  }
}

export const duplicateDetector = new DuplicateDetector();