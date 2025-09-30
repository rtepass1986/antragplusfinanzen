import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface BatchSaveResult {
  success: boolean;
  filename: string;
  invoiceId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { invoices } = await request.json();
    const companyId = invoices[0]?.companyId || 'default-company-id';

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json(
        { error: 'No invoices provided' },
        { status: 400 }
      );
    }

    if (invoices.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 invoices allowed per batch' },
        { status: 400 }
      );
    }

    console.log(`Starting batch save of ${invoices.length} invoices`);

    const results: BatchSaveResult[] = [];

    // Process invoices sequentially to avoid database conflicts
    for (let i = 0; i < invoices.length; i++) {
      const invoiceData = invoices[i];
      console.log(
        `Saving invoice ${i + 1}/${invoices.length}: ${invoiceData.filename}`
      );

      try {
        // Validate required fields
        if (
          !invoiceData.vendor ||
          !invoiceData.invoiceNumber ||
          !invoiceData.totalAmount
        ) {
          results.push({
            success: false,
            filename: invoiceData.filename || 'unknown',
            error:
              'Missing required fields: vendor, invoiceNumber, or totalAmount',
          });
          continue;
        }

        // Create invoice in database
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: invoiceData.invoiceNumber,
            filename: invoiceData.filename || 'unknown.pdf',
            originalFile: invoiceData.filename || 'unknown.pdf',
            s3Key: invoiceData.s3Key,
            s3Url: invoiceData.s3Url,

            vendor: invoiceData.vendor,
            vendorAddress: invoiceData.vendorAddress,
            vendorTaxId: invoiceData.vendorTaxId,

            invoiceDate: new Date(invoiceData.invoiceDate),
            dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
            totalAmount: invoiceData.totalAmount,
            taxAmount: invoiceData.taxAmount || 0,
            subtotal: invoiceData.subtotal || invoiceData.totalAmount,
            currency: invoiceData.currency || 'EUR',

            status: 'PROCESSING',
            category: invoiceData.category || 'Sonstiges',
            project: invoiceData.project || null,

            ocrConfidence: invoiceData.ocrConfidence,
            ocrRawText: invoiceData.ocrRawText,
            extractedFields: invoiceData.extractedFields,

            notes: invoiceData.notes || '',
            tags: invoiceData.tags || ['ai-extracted', 'batch-upload'],

            companyId,
            createdById: 'cmg6dyttz000032qko8ihkoob', // Use the existing admin user
          },
        });

        // Create line items if available
        if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
          await prisma.lineItem.createMany({
            data: invoiceData.lineItems.map((item: any) => ({
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || item.totalPrice || 0,
              totalPrice: item.totalPrice || 0,
              category: item.category || invoiceData.category,
              project: invoiceData.project,
            })),
          });
        }

        // Check for potential transaction matches
        const potentialMatches = await prisma.transaction.findMany({
          where: {
            bankAccount: {
              companyId,
            },
            amount: {
              gte: invoiceData.totalAmount * 0.95, // Within 5% of invoice amount
              lte: invoiceData.totalAmount * 1.05,
            },
          },
          select: {
            id: true,
            amount: true,
            description: true,
            date: true,
            type: true,
          },
          orderBy: {
            date: 'desc',
          },
          take: 5,
        });

        // Update payment status if matches found
        if (potentialMatches.length > 0) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });
        }

        results.push({
          success: true,
          filename: invoiceData.filename,
          invoiceId: invoice.id,
        });

        console.log(
          `Successfully saved: ${invoiceData.filename} (ID: ${invoice.id})`
        );
      } catch (error) {
        console.error(`Error saving ${invoiceData.filename}:`, error);
        results.push({
          success: false,
          filename: invoiceData.filename || 'unknown',
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(
      `Batch save completed: ${successCount} successful, ${errorCount} failed`
    );

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: invoices.length,
        successful: successCount,
        failed: errorCount,
      },
    });
  } catch (error) {
    console.error('Batch save error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Batch invoice saving API',
    maxInvoices: 20,
    features: [
      'Sequential processing',
      'Individual error handling',
      'Line items creation',
      'Payment matching',
      'Transaction linking',
    ],
  });
}
