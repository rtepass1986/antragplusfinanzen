/**
 * Smart Invoice Extractor
 *
 * Uses the Document Processor to intelligently route between:
 * - AWS Textract for digital PDFs
 * - GPT-4o Vision for scanned invoices/images
 */

import { documentProcessor, DocumentType } from './document-processor';

interface ExtractedInvoiceData {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  totalAmount: number;
  taxAmount?: number;
  subtotal?: number;
  currency: string;
  vendorAddress?: string;
  vendorTaxId?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorIban?: string;
  vendorBic?: string;
  customerName?: string;
  customerAddress?: string;
  customerVatId?: string;
  paymentTerms?: string;
  purchaseOrder?: string;
  category?: string;
  description?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
    sku?: string;
    unit?: string;
    taxRate?: number;
  }>;
  notes?: string;
  detectedLanguage?: string;
  processingMethod?: 'textract' | 'vision' | 'hybrid';
  processingTime?: number;
  confidence?: number;
}

export class SmartInvoiceExtractor {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
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

  /**
   * Main extraction method - automatically detects best approach
   */
  async extractInvoiceData(file: File): Promise<ExtractedInvoiceData> {
    try {
      console.log(`📄 Processing invoice: ${file.name} (${file.type})`);

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Use document processor to extract text with smart routing
      const extractionResult = await documentProcessor.extractText(
        buffer,
        file.name,
        file.type,
        'invoice' as DocumentType
      );

      console.log(`✅ Extraction complete via ${extractionResult.method}`);
      console.log(`⏱️  Processing time: ${extractionResult.processingTime}ms`);
      console.log(`💰 Cost: $${extractionResult.cost.toFixed(4)}`);

      // Parse extracted text into structured invoice data
      const invoiceData = await this.parseInvoiceFromText(
        extractionResult.text,
        file.name
      );

      // Add processing metadata
      return {
        ...invoiceData,
        processingMethod: extractionResult.method as
          | 'textract'
          | 'vision'
          | 'hybrid',
        processingTime: extractionResult.processingTime,
        confidence: extractionResult.confidence,
      };
    } catch (error) {
      console.error('Error extracting invoice data:', error);
      return this.getFallbackExtraction(file.name);
    }
  }

  /**
   * Parse extracted text into structured invoice data using AI
   */
  private async parseInvoiceFromText(
    text: string,
    filename: string
  ): Promise<ExtractedInvoiceData> {
    const prompt = this.buildInvoiceParsingPrompt(text, filename);

    try {
      const response = await this.callOpenAI(prompt);
      return this.parseInvoiceResponse(response);
    } catch (error) {
      console.error('Error parsing invoice with AI:', error);
      return this.getFallbackExtraction(filename, text);
    }
  }

  /**
   * Build prompt for invoice data extraction
   */
  private buildInvoiceParsingPrompt(text: string, filename: string): string {
    return `
You are an AI specialized in extracting structured data from invoice documents. Extract all relevant information from the provided invoice text.

INVOICE TEXT:
${text}

FILENAME: ${filename}

EXTRACTION REQUIREMENTS:
Extract the following information and return it as valid JSON:

1. VENDOR/SUPPLIER INFORMATION:
   - vendor: Company name that issued the invoice
   - vendorAddress: Complete address of the vendor
   - vendorTaxId: Tax ID or VAT number if present
   - vendorEmail: Email address if present
   - vendorPhone: Phone number if present
   - vendorIban: IBAN if present
   - vendorBic: BIC/SWIFT if present

2. CUSTOMER INFORMATION:
   - customerName: Customer/recipient name
   - customerAddress: Customer address if present
   - customerVatId: Customer VAT ID if present

3. INVOICE DETAILS:
   - invoiceNumber: Invoice number or reference
   - invoiceDate: Invoice date (format: YYYY-MM-DD)
   - dueDate: Payment due date if specified (format: YYYY-MM-DD)
   - paymentTerms: Payment terms if mentioned
   - purchaseOrder: Purchase order number if present

4. FINANCIAL INFORMATION:
   - totalAmount: Total invoice amount (number only, no currency symbols)
   - taxAmount: Tax amount if specified (number only)
   - subtotal: Subtotal before tax (number only)
   - currency: Currency code (EUR, USD, etc.)

5. LINE ITEMS (Extract ALL items):
   - lineItems: Array of individual items/services with:
     - description: What was purchased/provided
     - quantity: Number of units
     - unitPrice: Price per unit
     - totalPrice: Total price for this line item
     - sku: SKU or product code if present
     - unit: Unit of measurement (piece, service, seat, etc.)
     - taxRate: Tax rate for this item

6. CATEGORIZATION:
   - category: Most appropriate expense category from: Software, Hardware, Personalkosten, Beratung, Schulungen, Forschung, Entwicklung, Innovation, Ausstattung, Reisen, Energieeffizienz, Abfallmanagement, Veranstaltungen, Marketing, Büromaterial, Miete, Versicherung, Kommunikation, Sonstiges
   - description: Brief description of what the invoice is for

7. ADDITIONAL:
   - notes: Any additional relevant information
   - detectedLanguage: Language of the document (de, en, etc.)

IMPORTANT RULES:
- Return ONLY valid JSON, no other text or explanations
- Convert all dates to YYYY-MM-DD format
- Convert all amounts to numbers (no currency symbols, no commas)
- If information is missing, use null
- Be thorough - extract ALL visible data
- For line items, extract EVERY item separately
- Look for German invoice formats (Rechnung, Rechnungsnummer, USt-IdNr, etc.)

RESPONSE FORMAT (JSON only):
{
  "vendor": "Acme GmbH",
  "vendorAddress": "Fabrikstr. 10, 10115 Berlin, Germany",
  "vendorTaxId": "DE123456789",
  "vendorEmail": "billing@acme.de",
  "vendorPhone": "+49 30 123456",
  "vendorIban": "DE89 3704 0044 0532 0130 00",
  "vendorBic": "COBADEFFXXX",
  "customerName": "Contoso Ltd.",
  "customerAddress": "1 North Rd, London NW1 1AA, UK",
  "customerVatId": "GB123456789",
  "invoiceNumber": "AC-2025-0912",
  "invoiceDate": "2025-09-12",
  "dueDate": "2025-10-12",
  "paymentTerms": "Net 30",
  "purchaseOrder": "PO-77821",
  "totalAmount": 833.00,
  "taxAmount": 133.00,
  "subtotal": 700.00,
  "currency": "EUR",
  "category": "Software",
  "description": "Monthly SaaS subscription",
  "lineItems": [
    {
      "description": "Onboarding & setup",
      "quantity": 1,
      "unitPrice": 500.00,
      "totalPrice": 500.00,
      "sku": "SVC-ONB",
      "unit": "service",
      "taxRate": 19.0
    },
    {
      "description": "Team subscription (Sep 2025)",
      "quantity": 10,
      "unitPrice": 20.00,
      "totalPrice": 200.00,
      "sku": "SUB-TEAM",
      "unit": "seat",
      "taxRate": 19.0
    }
  ],
  "notes": "Thank you for your business.",
  "detectedLanguage": "de"
}
`;
  }

  /**
   * Call OpenAI API
   */
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
              'You are a precise invoice data extraction AI. Always respond with valid JSON only, no explanations or additional text.',
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Parse AI response into structured invoice data
   */
  private parseInvoiceResponse(response: string): ExtractedInvoiceData {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and clean the extracted data
      return {
        vendor: parsed.vendor || 'Unknown Vendor',
        invoiceNumber: parsed.invoiceNumber || `AUTO-${Date.now()}`,
        invoiceDate:
          parsed.invoiceDate || new Date().toISOString().split('T')[0],
        dueDate: parsed.dueDate || undefined,
        totalAmount: Number(parsed.totalAmount) || 0,
        taxAmount: parsed.taxAmount ? Number(parsed.taxAmount) : undefined,
        subtotal: parsed.subtotal ? Number(parsed.subtotal) : undefined,
        currency: parsed.currency || 'EUR',
        vendorAddress: parsed.vendorAddress || undefined,
        vendorTaxId: parsed.vendorTaxId || undefined,
        vendorEmail: parsed.vendorEmail || undefined,
        vendorPhone: parsed.vendorPhone || undefined,
        vendorIban: parsed.vendorIban || undefined,
        vendorBic: parsed.vendorBic || undefined,
        customerName: parsed.customerName || undefined,
        customerAddress: parsed.customerAddress || undefined,
        customerVatId: parsed.customerVatId || undefined,
        paymentTerms: parsed.paymentTerms || undefined,
        purchaseOrder: parsed.purchaseOrder || undefined,
        category: parsed.category || 'Sonstiges',
        description: parsed.description || '',
        lineItems: Array.isArray(parsed.lineItems)
          ? parsed.lineItems.map(
              (item: {
                description?: string;
                quantity?: number;
                unitPrice?: number;
                totalPrice?: number;
                category?: string;
                sku?: string;
                unit?: string;
                taxRate?: number;
              }) => ({
                description: item.description || '',
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice) || 0,
                totalPrice: Number(item.totalPrice) || 0,
                category: item.category || parsed.category || 'Sonstiges',
                sku: item.sku || undefined,
                unit: item.unit || undefined,
                taxRate: item.taxRate ? Number(item.taxRate) : undefined,
              })
            )
          : [],
        notes: parsed.notes || '',
        detectedLanguage: parsed.detectedLanguage || 'en',
      };
    } catch (error) {
      console.error('Error parsing invoice response:', error);
      throw error;
    }
  }

  /**
   * Fallback extraction
   */
  private getFallbackExtraction(
    filename: string,
    text?: string
  ): ExtractedInvoiceData {
    return {
      vendor: 'Unknown Vendor',
      invoiceNumber: `FALLBACK-${Date.now()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      currency: 'EUR',
      category: 'Sonstiges',
      description: 'Manual review required',
      lineItems: [],
      notes: text
        ? 'AI extraction failed - please review manually'
        : 'Extraction failed - no text available',
    };
  }

  /**
   * Get project suggestions based on invoice data
   */
  async getProjectSuggestions(
    invoiceData: ExtractedInvoiceData,
    projects: Array<{
      id: string;
      name: string;
      code?: string;
      totalBudget: number;
      spentAmount: number;
      categories: string[];
      description?: string;
    }>
  ): Promise<{
    suggestions: Array<{
      projectId: string;
      projectName: string;
      confidence: number;
      reasoning: string;
    }>;
  }> {
    try {
      const prompt = `
Based on this invoice data, suggest which project it should be assigned to:

INVOICE DATA:
- Vendor: ${invoiceData.vendor}
- Amount: ${invoiceData.totalAmount} ${invoiceData.currency}
- Category: ${invoiceData.category}
- Description: ${invoiceData.description}

AVAILABLE PROJECTS:
${projects
  .map(
    project => `
- Project: ${project.name} (${project.code || 'No code'})
- Budget: ${project.totalBudget} (Spent: ${project.spentAmount})
- Categories: ${project.categories.join(', ')}
- Description: ${project.description || 'No description'}
`
  )
  .join('\n')}

Provide up to 3 project suggestions with confidence scores (0-1) and reasoning.
Return only valid JSON in this format:
{
  "suggestions": [
    {
      "projectId": "project-id",
      "projectName": "Project Name",
      "confidence": 0.85,
      "reasoning": "Why this project fits best"
    }
  ]
}
`;

      const response = await this.callOpenAI(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestions: parsed.suggestions || [],
        };
      }
    } catch (error) {
      console.error('Error getting project suggestions:', error);
    }

    return { suggestions: [] };
  }
}

export const smartInvoiceExtractor = new SmartInvoiceExtractor();
