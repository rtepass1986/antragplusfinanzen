import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const invoiceData = await request.json();
    const companyId = invoiceData.companyId || 'default-company-id';

    // Validate required fields
    if (
      !invoiceData.vendor ||
      !invoiceData.invoiceNumber ||
      !invoiceData.totalAmount
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: vendor, invoiceNumber, or totalAmount',
        },
        { status: 400 }
      );
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
        tags: invoiceData.tags || ['ai-extracted'],

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
      const bestMatch = potentialMatches[0];
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendor: invoice.vendor,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        project: invoice.project,
        category: invoice.category,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
      },
      potentialMatches: potentialMatches.map(transaction => ({
        id: transaction.id,
        amount: Number(transaction.amount),
        description: transaction.description,
        date: transaction.date,
        type: transaction.type,
      })),
    });
  } catch (error) {
    console.error('Error saving invoice:', error);
    return NextResponse.json(
      {
        error: 'Failed to save invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
