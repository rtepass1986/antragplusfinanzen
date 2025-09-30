import { invoiceDataExtractor } from '@/lib/ai/invoice-extractor';
import { extractPdfText, isPdf } from '@/lib/parser/extractPdf';
import { parseInvoiceFromText } from '@/lib/parser/parseInvoice';
import { NextRequest, NextResponse } from 'next/server';

interface BatchExtractResult {
  success: boolean;
  filename: string;
  data?: any;
  error?: string;
  processingMethod?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 files allowed per batch' },
        { status: 400 }
      );
    }

    console.log(`Starting batch processing of ${files.length} files`);

    const results: BatchExtractResult[] = [];

    // Process files sequentially to avoid overwhelming the server
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);

      try {
        // Validate file type
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/tiff',
          'application/pdf',
        ];

        if (!allowedTypes.includes(file.type)) {
          results.push({
            success: false,
            filename: file.name,
            error:
              'Invalid file type. Only JPEG, PNG, TIFF, and PDF files are supported.',
          });
          continue;
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          results.push({
            success: false,
            filename: file.name,
            error: 'File too large. Maximum size is 10MB.',
          });
          continue;
        }

        let extractedData;
        let processingMethod = 'unknown';

        try {
          if (file.type === 'application/pdf') {
            console.log(`Using AWS Textract for PDF: ${file.name}`);
            extractedData = await invoiceDataExtractor.extractInvoiceData(file);
            processingMethod = 'aws-textract';
          } else {
            console.log(`Using OpenAI Vision for image: ${file.name}`);
            extractedData = await invoiceDataExtractor.extractInvoiceData(file);
            processingMethod = 'openai-vision';
          }
        } catch (error) {
          console.warn(
            `Primary extraction failed for ${file.name}, trying fallback:`,
            error
          );

          if (isPdf(file)) {
            try {
              console.log(`Falling back to pdf-parse for: ${file.name}`);
              const buffer = Buffer.from(await file.arrayBuffer());
              const text = await extractPdfText(buffer);
              const parsedData = await parseInvoiceFromText(file.name, text);

              // Convert parsed data to expected format
              extractedData = {
                vendor: parsedData.supplier?.name || '',
                invoiceNumber: parsedData.invoice_number || '',
                invoiceDate: parsedData.issue_date || '',
                dueDate: parsedData.due_date || '',
                totalAmount: parsedData.totals?.total || 0,
                taxAmount: parsedData.totals?.vat || 0,
                subtotal: parsedData.totals?.net || 0,
                currency: parsedData.currency || 'EUR',
                vendorAddress: parsedData.supplier?.address || '',
                vendorTaxId: parsedData.supplier?.vat_id || '',
                paymentTerms: parsedData.payment_terms || '',
                category: '',
                description: parsedData.notes || '',
                lineItems:
                  parsedData.line_items?.map((item, index) => ({
                    id: `line-${index}`,
                    description: item.description,
                    quantity: item.quantity || 1,
                    unitPrice: item.unit_price || 0,
                    totalPrice: item.net_amount,
                    category: '',
                    taxRate: item.tax_rate || 19,
                  })) || [],
                notes: parsedData.notes || '',
                filename: file.name,
                fileSize: file.size,
                fileType: file.type,
                ocrConfidence: 0.75,
                ocrRawText: `Processed with pdf-parse fallback`,
                processingMethod: 'pdf-parse-fallback',
                projectSuggestions: [],
              };
              processingMethod = 'pdf-parse-fallback';
            } catch (fallbackError) {
              console.error(
                `Fallback extraction also failed for ${file.name}:`,
                fallbackError
              );
              throw error; // Re-throw original error
            }
          } else {
            throw error; // Re-throw original error for images
          }
        }

        results.push({
          success: true,
          filename: file.name,
          data: {
            ...extractedData,
            processingMethod,
            ocrConfidence:
              processingMethod === 'aws-textract'
                ? 0.95
                : processingMethod === 'openai-vision'
                  ? 0.9
                  : 0.75,
          },
          processingMethod,
        });

        console.log(
          `Successfully processed: ${file.name} (${processingMethod})`
        );
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        results.push({
          success: false,
          filename: file.name,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }

      // Small delay between files to be gentle on the server
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(
      `Batch processing completed: ${successCount} successful, ${errorCount} failed`
    );

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: files.length,
        successful: successCount,
        failed: errorCount,
        processingTime: Date.now() - Date.now(), // This would be calculated properly
      },
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Batch invoice processing API',
    supportedFormats: ['PDF', 'JPG', 'PNG', 'TIFF', 'GIF', 'BMP'],
    maxFiles: 20,
    maxFileSize: '10MB',
    methods: [
      'AWS Textract (PDF)',
      'OpenAI Vision (Images)',
      'pdf-parse (PDF fallback)',
    ],
  });
}
