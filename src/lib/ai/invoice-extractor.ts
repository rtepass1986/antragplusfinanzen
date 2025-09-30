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
  paymentTerms?: string;
  category?: string;
  description?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
  }>;
  notes?: string;
}

export class InvoiceDataExtractor {
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

  async extractInvoiceData(file: File): Promise<ExtractedInvoiceData> {
    try {
      if (file.type === 'application/pdf') {
        // Handle PDF files with text extraction
        return await this.extractFromPDF(file);
      } else {
        // Handle image files with OpenAI vision API
        const base64 = await this.fileToBase64(file);
        const extractionPrompt = this.buildVisionExtractionPrompt(file.name);
        const response = await this.callOpenAIVision(extractionPrompt, base64);
        return this.parseExtractionResponse(response);
      }
    } catch (error) {
      console.error('Error extracting invoice data with AI:', error);
      return this.getFallbackExtraction('', {});
    }
  }

  private async extractFromPDF(file: File): Promise<ExtractedInvoiceData> {
    try {
      console.log('PDF processing: Using AWS Textract for OCR...');

      // Use AWS Textract to extract text from PDF
      const extractedText = await this.extractTextWithTextract(file);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(
          'Failed to extract text from PDF - document may be empty or corrupted'
        );
      }

      console.log(`Extracted ${extractedText.length} characters from PDF`);

      // Use AI to analyze the extracted text
      const extractionPrompt = this.buildExtractionPrompt(
        extractedText,
        {},
        file.name
      );
      const response = await this.callOpenAI(extractionPrompt);
      return this.parseExtractionResponse(response);
    } catch (error) {
      console.error('Error extracting from PDF:', error);
      console.log('Falling back to basic text extraction...');

      try {
        // Try basic text extraction as fallback
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const basicText = await this.simplePDFTextExtraction(buffer);

        if (basicText && basicText.trim().length > 0) {
          console.log(`Fallback extraction: ${basicText.length} characters`);
          const extractionPrompt = this.buildExtractionPrompt(
            basicText,
            {},
            file.name
          );
          const response = await this.callOpenAI(extractionPrompt);
          return this.parseExtractionResponse(response);
        }
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
      }

      // Return basic fallback data
      return this.getFallbackExtraction('', { filename: file.name });
    }
  }

  private async extractTextWithTextract(file: File): Promise<string> {
    try {
      // Import AWS SDK dynamically
      const {
        TextractClient,
        StartDocumentTextDetectionCommand,
        GetDocumentTextDetectionCommand,
      } = await import('@aws-sdk/client-textract');
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to S3 first (Textract requires S3 for PDFs)
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const s3Key = `invoices/temp/${Date.now()}-${file.name}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: s3Key,
          Body: buffer,
          ContentType: file.type,
        })
      );

      console.log(`Uploaded to S3: ${s3Key}`);

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
      const maxAttempts = 120; // 2 minutes for production

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

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
      console.error('Error using AWS Textract:', error);
      throw new Error(
        `AWS Textract failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      // Use a simple text extraction approach
      // Convert file to base64 and use a basic PDF text extraction
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Try to extract text using a simple approach
      // This is a basic implementation - in production you'd want a more robust solution
      const text = await this.simplePDFTextExtraction(buffer);
      return text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      return '';
    }
  }

  private async simplePDFTextExtraction(buffer: Buffer): Promise<string> {
    try {
      // This is a very basic PDF text extraction
      // In production, you'd want to use a proper PDF library
      const bufferString = buffer.toString('latin1');

      // Look for text between BT and ET markers (PDF text objects)
      const textMatches = bufferString.match(/BT[\s\S]*?ET/g);
      if (!textMatches) {
        return '';
      }

      let extractedText = '';
      for (const match of textMatches) {
        // Extract text content from PDF text objects
        const textContent = match
          .replace(/BT|ET/g, '')
          .replace(/Tj|TJ/g, '')
          .replace(/[()]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (textContent) {
          extractedText += textContent + ' ';
        }
      }

      return extractedText.trim();
    } catch (error) {
      console.error('Error in simple PDF text extraction:', error);
      return '';
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    // Handle both browser and server environments
    if (typeof window !== 'undefined') {
      // Browser environment - use FileReader
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just the base64 string
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = error => reject(error);
      });
    } else {
      // Server environment - convert ArrayBuffer to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    }
  }

  private buildPDFVisionExtractionPrompt(filename: string): string {
    return `
You are an AI specialized in extracting structured data from invoice PDF documents. Analyze the provided PDF invoice and extract all relevant information. The PDF may contain multiple pages, scanned images, or complex layouts.

FILENAME: ${filename}

EXTRACTION REQUIREMENTS:
Extract ALL information from the invoice and return it as valid JSON:

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
   - discount: Discount amount if any
   - shipping: Shipping costs if any

5. LINE ITEMS (Extract ALL items):
   - lineItems: Array of individual items/services with:
     - description: What was purchased/provided
     - quantity: Number of units
     - unitPrice: Price per unit
     - totalPrice: Total price for this line item
     - sku: SKU or product code if present
     - unit: Unit of measurement (piece, service, seat, etc.)
     - taxRate: Tax rate for this item

6. ADDITIONAL:
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
- Extract data from ALL pages if multi-page PDF

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
  "discount": 0.00,
  "shipping": 0.00,
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

  private buildVisionExtractionPrompt(filename: string): string {
    return `
You are an AI specialized in extracting structured data from invoice documents. Analyze the provided invoice image and extract all relevant information.

FILENAME: ${filename}

EXTRACTION REQUIREMENTS:
Extract the following information and return it as valid JSON:

1. VENDOR INFORMATION:
   - vendor: Company name that issued the invoice
   - vendorAddress: Complete address of the vendor
   - vendorTaxId: Tax ID or VAT number if present

2. INVOICE DETAILS:
   - invoiceNumber: Invoice number or reference
   - invoiceDate: Invoice date (format: YYYY-MM-DD)
   - dueDate: Payment due date if specified (format: YYYY-MM-DD)
   - paymentTerms: Payment terms if mentioned

3. FINANCIAL INFORMATION:
   - totalAmount: Total invoice amount (number only, no currency symbols)
   - taxAmount: Tax amount if specified (number only)
   - subtotal: Subtotal before tax (number only)
   - currency: Currency code (EUR, USD, etc.)

4. CATEGORIZATION:
   - category: Most appropriate expense category from: Software, Hardware, Personalkosten, Beratung, Schulungen, Forschung, Entwicklung, Innovation, Ausstattung, Reisen, Energieeffizienz, Abfallmanagement, Veranstaltungen, Marketing, Büromaterial, Miete, Versicherung, Kommunikation, Sonstiges
   - description: Brief description of what the invoice is for

5. LINE ITEMS:
   - lineItems: Array of individual items/services with:
     - description: What was purchased/provided
     - quantity: Number of units
     - unitPrice: Price per unit
     - totalPrice: Total price for this line item
     - category: Category for this specific line item

6. ADDITIONAL:
   - notes: Any additional relevant information

IMPORTANT RULES:
- Return ONLY valid JSON, no other text
- Use German category names
- Convert all dates to YYYY-MM-DD format
- Convert all amounts to numbers (no currency symbols)
- If information is missing, use null or empty string
- Be precise and accurate with the extraction
- For line items, extract each individual item separately

RESPONSE FORMAT (JSON only):
{
  "vendor": "Company Name",
  "invoiceNumber": "INV-123",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "totalAmount": 1500.00,
  "taxAmount": 285.00,
  "subtotal": 1215.00,
  "currency": "EUR",
  "vendorAddress": "Street, City, Country",
  "vendorTaxId": "DE123456789",
  "paymentTerms": "30 days",
  "category": "Software",
  "description": "Software license purchase",
  "lineItems": [
    {
      "description": "Annual software license",
      "quantity": 1,
      "unitPrice": 1215.00,
      "totalPrice": 1215.00,
      "category": "Software"
    }
  ],
  "notes": "Additional information if relevant"
}
`;
  }

  private buildExtractionPrompt(
    rawText: string,
    extractedFields: any,
    filename: string
  ): string {
    return `
You are an AI specialized in extracting structured data from invoice documents. Extract the following information from the provided invoice data and return it in a clean, structured JSON format.

RAW TEXT FROM INVOICE:
${rawText}

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
   - discount: Discount amount if any
   - shipping: Shipping costs if any

5. LINE ITEMS:
   - lineItems: Array of individual items/services with:
     - description: What was purchased/provided
     - quantity: Number of units
     - unitPrice: Price per unit
     - totalPrice: Total price for this line item
     - sku: SKU or product code if present
     - unit: Unit of measurement (piece, service, etc.)
     - taxRate: Tax rate for this item

6. ADDITIONAL:
   - notes: Any additional relevant information
   - detectedLanguage: Language of the document (de, en, etc.)

IMPORTANT RULES:
- Return ONLY valid JSON, no other text
- Convert all dates to YYYY-MM-DD format
- Convert all amounts to numbers (no currency symbols)
- If information is missing, use null or empty string
- Be precise and accurate with the extraction
- For line items, extract each individual item separately
- Look for German invoice formats and terminology

RESPONSE FORMAT (JSON only):
{
  "vendor": "Company Name",
  "invoiceNumber": "INV-123",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "totalAmount": 1500.00,
  "taxAmount": 285.00,
  "subtotal": 1215.00,
  "currency": "EUR",
  "vendorAddress": "Street, City, Country",
  "vendorTaxId": "DE123456789",
  "vendorEmail": "billing@company.de",
  "vendorPhone": "+49 30 123456",
  "vendorIban": "DE89 3704 0044 0532 0130 00",
  "vendorBic": "COBADEFFXXX",
  "customerName": "Customer Name",
  "customerAddress": "Customer Address",
  "customerVatId": "GB123456789",
  "paymentTerms": "Net 30",
  "purchaseOrder": "PO-12345",
  "discount": 0.00,
  "shipping": 0.00,
  "lineItems": [
    {
      "description": "Service description",
      "quantity": 1,
      "unitPrice": 1215.00,
      "totalPrice": 1215.00,
      "sku": "SVC-001",
      "unit": "service",
      "taxRate": 19.0
    }
  ],
  "notes": "Additional information if relevant",
  "detectedLanguage": "de"
}
`;
  }

  private async callOpenAIVision(
    prompt: string,
    base64Image: string,
    mimeType: string = 'image/jpeg'
  ): Promise<string> {
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
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
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
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private parseExtractionResponse(response: string): ExtractedInvoiceData {
    try {
      // Clean the response to extract JSON - try multiple patterns
      let jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        // Try to find JSON array pattern
        jsonMatch = response.match(/\[[\s\S]*\]/);
      }

      if (!jsonMatch) {
        // Try to find any JSON-like structure
        jsonMatch = response.match(/\{[\s\S]*?\}(?=\s*$|\s*[^,}\s])/);
      }

      if (!jsonMatch) {
        console.warn('No JSON found in response, using fallback parsing');
        return this.createFallbackInvoiceData(response);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (jsonError) {
        console.warn(
          'JSON parsing failed, attempting to fix malformed JSON:',
          jsonError
        );
        // Try to fix common JSON issues
        const fixedJson = this.fixMalformedJson(jsonMatch[0]);
        parsed = JSON.parse(fixedJson);
      }

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
        paymentTerms: parsed.paymentTerms || undefined,
        category: parsed.category || 'Sonstiges',
        description: parsed.description || '',
        lineItems: Array.isArray(parsed.lineItems)
          ? parsed.lineItems.map((item: any) => ({
              description: item.description || '',
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
              totalPrice: Number(item.totalPrice) || 0,
              category: item.category || parsed.category || 'Sonstiges',
            }))
          : [],
        notes: parsed.notes || '',
      };
    } catch (error) {
      console.error('Error parsing AI extraction response:', error);
      return this.getFallbackExtraction('', {});
    }
  }

  private getFallbackExtraction(
    rawText: string,
    extractedFields: any
  ): ExtractedInvoiceData {
    // Fallback extraction using basic patterns
    const vendorMatch = rawText.match(
      /(?:from|vendor|supplier)[:\s]+([^\n]+)/i
    );
    const amountMatch = rawText.match(/(?:total|amount)[:\s]*([0-9.,]+)/i);
    const dateMatch = rawText.match(/(\d{1,2}[./]\d{1,2}[./]\d{4})/);

    return {
      vendor: vendorMatch ? vendorMatch[1].trim() : 'Unknown Vendor',
      invoiceNumber: `FALLBACK-${Date.now()}`,
      invoiceDate: dateMatch
        ? dateMatch[1]
        : new Date().toISOString().split('T')[0],
      totalAmount: amountMatch
        ? parseFloat(amountMatch[1].replace(',', '.'))
        : 0,
      currency: 'EUR',
      category: 'Sonstiges',
      description: 'Extracted from document',
      lineItems: [],
      notes: 'AI extraction failed - manual review required',
    };
  }

  private fixMalformedJson(jsonString: string): string {
    try {
      // Fix common JSON issues
      const fixed = jsonString
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing quotes around keys
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Fix unescaped quotes in strings
        .replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":')
        // Remove any trailing commas before closing braces/brackets
        .replace(/,(\s*[}\]])/g, '$1');

      return fixed;
    } catch (error) {
      console.warn('Failed to fix malformed JSON:', error);
      return jsonString;
    }
  }

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

export const invoiceDataExtractor = new InvoiceDataExtractor();
