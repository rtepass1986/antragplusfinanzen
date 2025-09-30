import { invoiceDataExtractor } from '@/lib/ai/invoice-extractor';
import { extractPdfText, isPdf } from '@/lib/parser/extractPdf';
import { parseInvoiceFromText } from '@/lib/parser/parseInvoice';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId =
      (formData.get('companyId') as string) || 'default-company-id';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Invalid file type. Only JPEG, PNG, TIFF, and PDF files are supported.',
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    console.log(`Processing invoice: ${file.name} (${file.type})`);

    // Step 1: AI Data Extraction with fallback
    let extractedData;
    let processingMethod = 'unknown';

    try {
      if (file.type === 'application/pdf') {
        console.log('Using AWS Textract for PDF...');
        extractedData = await invoiceDataExtractor.extractInvoiceData(file);
        processingMethod = 'aws-textract';
      } else {
        console.log('Using OpenAI vision to extract structured data...');
        extractedData = await invoiceDataExtractor.extractInvoiceData(file);
        processingMethod = 'openai-vision';
      }
    } catch (error) {
      console.warn('Primary extraction failed, trying fallback:', error);

      if (isPdf(file)) {
        try {
          console.log('Falling back to pdf-parse + heuristics...');
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
          };
          processingMethod = 'pdf-parse-fallback';
        } catch (fallbackError) {
          console.error('Fallback extraction also failed:', fallbackError);
          throw error; // Re-throw original error
        }
      } else {
        throw error; // Re-throw original error for images
      }
    }

    // Step 2: Get project suggestions (optional)
    const projects = await prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        code: true,
        totalBudget: true,
        spentAmount: true,
        categories: true,
        description: true,
      },
    });

    const projectSuggestions = await invoiceDataExtractor.getProjectSuggestions(
      extractedData,
      projects.map(project => ({
        id: project.id,
        name: project.name,
        code: project.code,
        totalBudget: Number(project.totalBudget || 0),
        spentAmount: Number(project.spentAmount || 0),
        categories: project.categories,
        description: project.description,
      }))
    );

    // Return extracted data for user review
    return NextResponse.json({
      success: true,
      extractedData: {
        // Basic invoice information
        vendor: extractedData.vendor,
        invoiceNumber: extractedData.invoiceNumber,
        invoiceDate: extractedData.invoiceDate,
        dueDate: extractedData.dueDate,
        totalAmount: extractedData.totalAmount,
        taxAmount: extractedData.taxAmount,
        subtotal: extractedData.subtotal,
        currency: extractedData.currency,

        // Vendor information
        vendorAddress: extractedData.vendorAddress,
        vendorTaxId: extractedData.vendorTaxId,
        paymentTerms: extractedData.paymentTerms,

        // Categorization
        category: extractedData.category,
        description: extractedData.description,

        // Line items
        lineItems: extractedData.lineItems,

        // Additional
        notes: extractedData.notes,

        // File information
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,

        // Processing information
        ocrConfidence:
          processingMethod === 'aws-textract'
            ? 0.95
            : processingMethod === 'openai-vision'
              ? 0.9
              : 0.75,
        ocrRawText: `Processed with ${processingMethod}`,
        processingMethod,

        // Project suggestions
        projectSuggestions: projectSuggestions.suggestions,
      },
      processingTime: Date.now() - Date.now(), // This would be calculated properly
    });
  } catch (error) {
    console.error('Invoice extraction error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract invoice data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
