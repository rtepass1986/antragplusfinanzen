import { textractClient } from './config';
import {
  AnalyzeDocumentCommand,
  AnalyzeDocumentCommandInput,
  Document,
  FeatureType,
  AnalyzeDocumentResponse,
  Block,
  BlockType,
} from '@aws-sdk/client-textract';

export interface ExtractedField {
  key: string;
  value: string;
  confidence: number;
  boundingBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface InvoiceData {
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  customerName?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  currency?: string;
  paymentTerms?: string;
  rawText: string;
  confidence: number;
}

export interface InvoiceItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

export class TextractService {
  // Analyze document using AWS Textract
  async analyzeDocument(fileBuffer: Buffer): Promise<AnalyzeDocumentResponse> {
    try {
      const document: Document = {
        Bytes: fileBuffer,
      };

      const input: AnalyzeDocumentCommandInput = {
        Document: document,
        FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
      };

      const command = new AnalyzeDocumentCommand(input);
      const response = await textractClient.send(command);

      return response;
    } catch (error) {
      console.error('Textract analysis error:', error);
      throw new Error(`Failed to analyze document: ${error}`);
    }
  }

  // Extract key-value pairs from Textract response
  extractKeyValuePairs(blocks: Block[]): ExtractedField[] {
    const keyValuePairs: ExtractedField[] = [];
    const keyMap = new Map<string, Block>();
    const valueMap = new Map<string, Block>();

    // First pass: identify keys and values
    blocks.forEach(block => {
      if (block.BlockType === BlockType.KEY_VALUE_SET) {
        if (block.EntityTypes?.includes('KEY')) {
          keyMap.set(block.Id!, block);
        } else if (block.EntityTypes?.includes('VALUE')) {
          valueMap.set(block.Id!, block);
        }
      }
    });

    // Second pass: match keys with values
    keyMap.forEach((keyBlock, keyId) => {
      const valueBlock = valueMap.get(keyId);
      if (valueBlock && keyBlock.Relationships) {
        const keyText = this.getTextFromBlock(keyBlock, blocks);
        const valueText = this.getTextFromBlock(valueBlock, blocks);

        if (keyText && valueText) {
          keyValuePairs.push({
            key: keyText.toLowerCase().trim(),
            value: valueText.trim(),
            confidence: Math.min(
              keyBlock.Confidence || 0,
              valueBlock.Confidence || 0
            ),
            boundingBox: keyBlock.Geometry?.BoundingBox ? {
              left: keyBlock.Geometry.BoundingBox.Left || 0,
              top: keyBlock.Geometry.BoundingBox.Top || 0,
              width: keyBlock.Geometry.BoundingBox.Width || 0,
              height: keyBlock.Geometry.BoundingBox.Height || 0,
            } : undefined,
          });
        }
      }
    });

    return keyValuePairs;
  }

  // Extract text from blocks
  private getTextFromBlock(block: Block, allBlocks: Block[]): string {
    if (block.Text) {
      return block.Text;
    }

    if (block.Relationships) {
      const textBlocks = block.Relationships.filter(rel => rel.Type === 'CHILD')
        .flatMap(
          rel => rel.Ids?.map(id => allBlocks.find(b => b.Id === id)) || []
        )
        .filter(block => block?.BlockType === BlockType.WORD)
        .map(block => block?.Text)
        .filter(Boolean);

      return textBlocks.join(' ');
    }

    return '';
  }

  // Parse invoice data from extracted fields
  parseInvoiceData(
    extractedFields: ExtractedField[],
    rawText: string
  ): InvoiceData {
    const invoiceData: InvoiceData = {
      items: [],
      rawText,
      confidence: 0,
    };

    let totalConfidence = 0;
    let fieldCount = 0;

    extractedFields.forEach(field => {
      totalConfidence += field.confidence;
      fieldCount++;

      switch (field.key) {
        case 'invoice number':
        case 'invoice #':
        case 'inv #':
          invoiceData.invoiceNumber = field.value;
          break;
        case 'date':
        case 'invoice date':
        case 'issue date':
          invoiceData.date = this.parseDate(field.value);
          break;
        case 'due date':
        case 'payment due':
          invoiceData.dueDate = this.parseDate(field.value);
          break;
        case 'customer':
        case 'bill to':
        case 'client':
          invoiceData.customerName = field.value;
          break;
        case 'address':
        case 'customer address':
          invoiceData.customerAddress = field.value;
          break;
        case 'subtotal':
        case 'sub total':
          invoiceData.subtotal = this.parseAmount(field.value);
          break;
        case 'tax':
        case 'tax amount':
        case 'vat':
          invoiceData.taxAmount = this.parseAmount(field.value);
          break;
        case 'total':
        case 'amount due':
        case 'grand total':
          invoiceData.total = this.parseAmount(field.value);
          break;
        case 'currency':
        case 'curr':
          invoiceData.currency = field.value.toUpperCase();
          break;
        case 'payment terms':
        case 'terms':
          invoiceData.paymentTerms = field.value;
          break;
      }
    });

    // Calculate average confidence
    if (fieldCount > 0) {
      invoiceData.confidence = totalConfidence / fieldCount;
    }

    // Set default currency if not found
    if (!invoiceData.currency) {
      invoiceData.currency = 'EUR';
    }

    // Parse line items from raw text
    invoiceData.items = this.parseLineItems(rawText);

    return invoiceData;
  }

  // Parse date strings
  private parseDate(dateString: string): string {
    // Try to parse various date formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return dateString;
  }

  // Parse amount strings
  private parseAmount(amountString: string): number {
    // Remove currency symbols and commas, convert to number
    const cleaned = amountString.replace(/[€$£,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Parse line items from raw text
  private parseLineItems(rawText: string): InvoiceItem[] {
    const items: InvoiceItem[] = [];
    const lines = rawText.split('\n');

    let inItemsSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Detect items section
      if (
        trimmedLine.toLowerCase().includes('description') ||
        trimmedLine.toLowerCase().includes('item') ||
        trimmedLine.toLowerCase().includes('service')
      ) {
        inItemsSection = true;
        continue;
      }

      // Detect end of items section
      if (
        trimmedLine.toLowerCase().includes('subtotal') ||
        trimmedLine.toLowerCase().includes('total') ||
        trimmedLine.toLowerCase().includes('tax')
      ) {
        inItemsSection = false;
        continue;
      }

      if (inItemsSection && trimmedLine) {
        // Try to parse line item (description: amount format)
        const match = trimmedLine.match(/^(.+?):\s*([€$£]?\s*[\d,]+\.?\d*)/i);
        if (match) {
          items.push({
            description: match[1].trim(),
            total: this.parseAmount(match[2]),
          });
        }
      }
    }

    return items;
  }
}

export const textractService = new TextractService();
