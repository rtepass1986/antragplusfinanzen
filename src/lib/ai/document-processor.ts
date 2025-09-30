/**
 * Smart Document Processor
 *
 * Automatically detects document type and quality, then routes to the best
 * extraction method:
 * - Digital PDFs → AWS Textract (fast, accurate, cheap)
 * - Scanned documents/images → GPT-4o Vision (handles poor quality, rotated images)
 */

export type DocumentType =
  | 'invoice'
  | 'bank_statement'
  | 'receipt'
  | 'contract'
  | 'general';

export type DocumentQuality =
  | 'digital' // Native PDF, high quality
  | 'scanned' // Scanned/photographed, may have quality issues
  | 'image'; // Direct image upload

export type ExtractionMethod =
  | 'textract' // AWS Textract for digital PDFs
  | 'vision' // GPT-4o Vision for scanned/image documents
  | 'hybrid'; // Both methods with comparison

export interface DocumentMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  detectedQuality: DocumentQuality;
  recommendedMethod: ExtractionMethod;
  confidence: number;
  pageCount?: number;
  isRotated?: boolean;
  hasLowContrast?: boolean;
  hasHandwriting?: boolean;
}

export interface ExtractionResult {
  text: string;
  confidence: number;
  method: ExtractionMethod;
  metadata: DocumentMetadata;
  processingTime: number;
  cost: number;
  structuredData?: Record<string, unknown>;
  rawResponse?: unknown;
}

export class DocumentProcessor {
  private openAIKey: string | null = null;

  constructor() {
    this.openAIKey = null;
  }

  private getOpenAIKey(): string {
    if (this.openAIKey) {
      return this.openAIKey;
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openAIKey = process.env.OPENAI_API_KEY;
    return this.openAIKey;
  }

  /**
   * Detect document quality and type
   */
  async analyzeDocument(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string
  ): Promise<DocumentMetadata> {
    // Check if it's an image file
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (imageTypes.includes(fileType)) {
      return {
        fileName,
        fileType,
        fileSize: fileBuffer.length,
        detectedQuality: 'image',
        recommendedMethod: 'vision',
        confidence: 1.0,
      };
    }

    // For PDFs, we need to check if it's digital or scanned
    if (fileType === 'application/pdf') {
      const quality = await this.detectPDFQuality(fileBuffer);

      return {
        fileName,
        fileType,
        fileSize: fileBuffer.length,
        detectedQuality: quality.isScanned ? 'scanned' : 'digital',
        recommendedMethod: quality.isScanned ? 'vision' : 'textract',
        confidence: quality.confidence,
        pageCount: quality.pageCount,
        isRotated: quality.isRotated,
        hasLowContrast: quality.hasLowContrast,
      };
    }

    // Default to vision for unknown types
    return {
      fileName,
      fileType,
      fileSize: fileBuffer.length,
      detectedQuality: 'scanned',
      recommendedMethod: 'vision',
      confidence: 0.5,
    };
  }

  /**
   * Detect if PDF is digital or scanned
   */
  private async detectPDFQuality(fileBuffer: Buffer): Promise<{
    isScanned: boolean;
    confidence: number;
    pageCount: number;
    isRotated: boolean;
    hasLowContrast: boolean;
  }> {
    try {
      // Convert buffer to string to analyze PDF structure
      const pdfString = fileBuffer.toString(
        'binary',
        0,
        Math.min(50000, fileBuffer.length)
      );

      // Check for text content in PDF
      const hasTextContent =
        pdfString.includes('/Type/Font') ||
        pdfString.includes('/Subtype/Type1') ||
        pdfString.includes('/BaseFont');

      // Check for images (scanned PDFs are usually just images)
      const hasImages =
        pdfString.includes('/XObject') && pdfString.includes('/Image');

      // Estimate page count
      const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
      const pageCount = pageMatches ? pageMatches.length : 1;

      // Check for rotation
      const isRotated = pdfString.includes('/Rotate');

      // Determine if scanned
      const isScanned = !hasTextContent && hasImages;
      const confidence = hasTextContent ? 0.9 : hasImages ? 0.85 : 0.5;

      return {
        isScanned,
        confidence,
        pageCount,
        isRotated,
        hasLowContrast: false, // Would need image analysis to detect
      };
    } catch (error) {
      console.error('Error detecting PDF quality:', error);
      // Default to scanned (safer for quality)
      return {
        isScanned: true,
        confidence: 0.5,
        pageCount: 1,
        isRotated: false,
        hasLowContrast: false,
      };
    }
  }

  /**
   * Extract text from document using the best method
   */
  async extractText(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    documentType: DocumentType = 'general',
    forceMethod?: ExtractionMethod
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Analyze document to determine best method
    const metadata = await this.analyzeDocument(fileBuffer, fileName, fileType);
    const method = forceMethod || metadata.recommendedMethod;

    console.log(`📄 Processing ${documentType}: ${fileName}`);
    console.log(`📊 Quality: ${metadata.detectedQuality}, Method: ${method}`);

    let result: ExtractionResult;

    if (method === 'vision' || metadata.detectedQuality === 'image') {
      result = await this.extractWithVision(
        fileBuffer,
        fileName,
        fileType,
        documentType,
        metadata
      );
    } else if (method === 'textract') {
      result = await this.extractWithTextract(fileBuffer, fileName, metadata);
    } else {
      // Hybrid: try both and compare
      result = await this.extractHybrid(
        fileBuffer,
        fileName,
        fileType,
        documentType,
        metadata
      );
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Extract text using AWS Textract (for digital PDFs)
   */
  private async extractWithTextract(
    fileBuffer: Buffer,
    fileName: string,
    metadata: DocumentMetadata
  ): Promise<ExtractionResult> {
    try {
      const {
        TextractClient,
        StartDocumentTextDetectionCommand,
        GetDocumentTextDetectionCommand,
      } = await import('@aws-sdk/client-textract');
      const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import(
        '@aws-sdk/client-s3'
      );

      // Upload to S3
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const s3Key = `documents/temp/${Date.now()}-${fileName}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: s3Key,
          Body: fileBuffer,
        })
      );

      // Start Textract job
      const textractClient = new TextractClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

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

      // Poll for completion
      let extractedText = '';
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 60;
      let nextToken: string | undefined;

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

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

          nextToken = getResponse.NextToken;
          if (nextToken) {
            status = 'IN_PROGRESS';
          }
        }

        attempts++;
      }

      // Cleanup S3
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: s3Key,
        })
      );

      if (status !== 'SUCCEEDED') {
        throw new Error(`Textract job ${status}`);
      }

      // Calculate cost (Textract pricing: $0.0015 per page)
      const pageCount = metadata.pageCount || 1;
      const cost = pageCount * 0.0015;

      return {
        text: extractedText.trim(),
        confidence: 0.95,
        method: 'textract',
        metadata,
        processingTime: 0, // Will be set by caller
        cost,
        rawResponse: { jobId, pageCount },
      };
    } catch (error) {
      console.error('Textract extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract text using GPT-4o Vision (for scanned documents and images)
   */
  private async extractWithVision(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    documentType: DocumentType,
    metadata: DocumentMetadata
  ): Promise<ExtractionResult> {
    try {
      // Convert buffer to base64
      const base64Image = fileBuffer.toString('base64');

      // Determine mime type
      let mimeType = fileType;
      if (fileType === 'application/pdf') {
        // For PDFs, we need to convert to image first or use multi-modal approach
        // For now, we'll use GPT-4o's PDF support
        mimeType = 'application/pdf';
      } else if (!fileType.startsWith('image/')) {
        mimeType = 'image/jpeg'; // Default
      }

      // Build extraction prompt based on document type
      const prompt = this.buildExtractionPrompt(documentType);

      // Call GPT-4o Vision API
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.getOpenAIKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert document processor specialized in extracting text and data from scanned documents, invoices, receipts, and bank statements. Always preserve exact formatting and return complete, accurate text.',
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
                      detail: 'high', // High detail for better accuracy
                    },
                  },
                ],
              },
            ],
            max_tokens: 4000,
            temperature: 0.1,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI Vision API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const extractedText = data.choices[0].message.content;

      // Calculate cost (GPT-4o Vision pricing: ~$0.01 per image + tokens)
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const cost =
        (inputTokens / 1000) * 0.005 + (outputTokens / 1000) * 0.015 + 0.01;

      return {
        text: extractedText,
        confidence: 0.9,
        method: 'vision',
        metadata,
        processingTime: 0,
        cost,
        rawResponse: data,
      };
    } catch (error) {
      console.error('Vision extraction failed:', error);
      throw error;
    }
  }

  /**
   * Hybrid extraction: try both methods and use the best result
   */
  private async extractHybrid(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    documentType: DocumentType,
    metadata: DocumentMetadata
  ): Promise<ExtractionResult> {
    try {
      // Try Textract first (faster and cheaper)
      const textractResult = await this.extractWithTextract(
        fileBuffer,
        fileName,
        metadata
      );

      // If Textract confidence is high and text is substantial, use it
      if (textractResult.text.length > 100 && textractResult.confidence > 0.9) {
        return textractResult;
      }

      // Otherwise, fall back to Vision
      console.log('Textract result insufficient, falling back to Vision...');
      const visionResult = await this.extractWithVision(
        fileBuffer,
        fileName,
        fileType,
        documentType,
        metadata
      );

      // Return vision result with hybrid flag
      return {
        ...visionResult,
        method: 'hybrid',
        cost: textractResult.cost + visionResult.cost,
      };
    } catch (error) {
      console.error('Hybrid extraction failed:', error);
      // Last resort: just try vision
      return this.extractWithVision(
        fileBuffer,
        fileName,
        fileType,
        documentType,
        metadata
      );
    }
  }

  /**
   * Build extraction prompt based on document type
   */
  private buildExtractionPrompt(documentType: DocumentType): string {
    const prompts: Record<DocumentType, string> = {
      invoice: `Extract ALL text from this invoice image. Include:
- Invoice number
- Date
- Vendor/Company name and address
- Customer name and address
- Line items (description, quantity, unit price, total)
- Subtotal, tax, total amount
- Payment terms
- Any notes or references

Return the complete extracted text with proper formatting. Preserve the structure and layout.`,

      bank_statement: `Extract ALL text from this bank statement. Include:
- Account number and holder name
- Bank name
- Statement period
- All transactions with:
  * Date
  * Description
  * Amount (debit/credit)
  * Balance
- Opening and closing balances

Return complete text preserving the transaction table structure.`,

      receipt: `Extract ALL text from this receipt. Include:
- Store/merchant name
- Date and time
- Items purchased with prices
- Subtotal, tax, total
- Payment method
- Receipt number

Return complete text with proper formatting.`,

      contract: `Extract ALL text from this contract/document. Preserve:
- Document title
- All sections and paragraphs
- Dates and signatures
- Terms and conditions
- Any tables or structured data

Return complete text maintaining original structure.`,

      general: `Extract ALL visible text from this document.
Preserve the original structure, formatting, and layout as much as possible.
Include all text, numbers, dates, and any structured data visible in the image.`,
    };

    return prompts[documentType];
  }

  /**
   * Extract structured data from text based on document type
   */
  async extractStructuredData(
    text: string,
    documentType: DocumentType
  ): Promise<Record<string, unknown>> {
    // This can be enhanced with GPT-4o to extract structured data
    // For now, return raw text
    return { rawText: text, documentType };
  }
}

export const documentProcessor = new DocumentProcessor();
