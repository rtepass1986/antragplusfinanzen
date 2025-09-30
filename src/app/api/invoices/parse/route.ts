import { invoiceDataExtractor } from '@/lib/ai/invoice-extractor';
import { extractPdfText, isImage, isPdf } from '@/lib/parser/extractPdf';
import { parseInvoiceFromText } from '@/lib/parser/parseInvoice';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!isPdf(file) && !isImage(file)) {
      return NextResponse.json(
        { error: 'Only PDF and image files are supported' },
        { status: 400 }
      );
    }

    let text = '';
    let extractedData;

    if (isPdf(file)) {
      // Use existing AWS Textract integration for PDFs
      try {
        extractedData = await invoiceDataExtractor.extractFromPDF(file);
        return NextResponse.json({
          success: true,
          data: extractedData,
          method: 'aws-textract',
        });
      } catch (error) {
        console.warn('AWS Textract failed, falling back to pdf-parse:', error);

        // Fallback to pdf-parse
        const buffer = Buffer.from(await file.arrayBuffer());
        text = await extractPdfText(buffer);

        if (!text || text.trim().length === 0) {
          return NextResponse.json(
            {
              error:
                'Could not extract text from PDF. The PDF might be scanned or corrupted.',
            },
            { status: 400 }
          );
        }
      }
    } else if (isImage(file)) {
      // Use existing vision API for images
      try {
        extractedData = await invoiceDataExtractor.extractInvoiceData(file);
        return NextResponse.json({
          success: true,
          data: extractedData,
          method: 'openai-vision',
        });
      } catch (error) {
        console.error('Image processing failed:', error);
        return NextResponse.json(
          { error: 'Failed to process image file' },
          { status: 500 }
        );
      }
    }

    // If we have text from PDF fallback, parse it
    if (text) {
      try {
        const parsedData = await parseInvoiceFromText(file.name, text);
        return NextResponse.json({
          success: true,
          data: parsedData,
          method: 'pdf-parse',
        });
      } catch (error) {
        console.error('Text parsing failed:', error);
        return NextResponse.json(
          { error: 'Failed to parse invoice text' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'No processing method succeeded' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Invoice parsing error:', error);
    return NextResponse.json(
      { error: 'Internal server error during invoice parsing' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Invoice parsing API',
    supportedFormats: ['PDF', 'JPG', 'PNG', 'GIF', 'BMP', 'TIFF'],
    methods: [
      'AWS Textract (PDF)',
      'OpenAI Vision (Images)',
      'pdf-parse (PDF fallback)',
    ],
  });
}
