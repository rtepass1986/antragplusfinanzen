import { invoiceAnalyzer } from '@/lib/ai/invoice-analyzer';
import { mockOCRService } from '@/lib/ocr/mock-service';
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

    console.log('Processing invoice with AI analysis...');

    // Step 1: OCR Processing
    const ocrResult = await mockOCRService.processDocument(file);

    if (!ocrResult.success || !ocrResult.data) {
      return NextResponse.json(
        { error: 'Failed to extract data from invoice' },
        { status: 500 }
      );
    }

    const invoiceData = ocrResult.data.invoiceData;

    // Step 2: Get projects for AI analysis
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
        startDate: true,
        endDate: true,
      },
    });

    // Step 3: Get recent transactions for matching
    const transactions = await prisma.transaction.findMany({
      where: {
        bankAccount: {
          companyId,
        },
      },
      select: {
        id: true,
        amount: true,
        description: true,
        date: true,
        type: true,
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    // Step 4: AI Analysis
    const aiAnalysis = await invoiceAnalyzer.analyzeInvoice(
      {
        id: 'temp-id',
        invoiceNumber: invoiceData.invoiceNumber || 'AUTO-GENERATED',
        vendor: invoiceData.vendor || 'Unknown Vendor',
        totalAmount: invoiceData.totalAmount || 0,
        currency: invoiceData.currency || 'EUR',
        invoiceDate: invoiceData.invoiceDate || new Date().toISOString(),
        dueDate: invoiceData.dueDate,
        category: invoiceData.category,
        description: invoiceData.notes,
        lineItems: [],
      },
      projects.map(project => ({
        id: project.id,
        name: project.name,
        code: project.code,
        totalBudget: Number(project.totalBudget || 0),
        spentAmount: Number(project.spentAmount || 0),
        categories: project.categories,
        description: project.description,
        startDate: project.startDate?.toISOString(),
        endDate: project.endDate?.toISOString(),
      })),
      transactions.map(transaction => ({
        id: transaction.id,
        amount: Number(transaction.amount),
        description: transaction.description,
        date: transaction.date.toISOString(),
        type: transaction.type.toLowerCase() as 'income' | 'expense',
        confidence: 0.5,
      }))
    );

    // Step 5: Create invoice in database
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceData.invoiceNumber || `AUTO-${Date.now()}`,
        filename: file.name,
        originalFile: file.name,
        s3Key: ocrResult.data.s3Url,
        s3Url: ocrResult.data.s3Url,

        vendor: invoiceData.vendor || 'Unknown Vendor',
        vendorAddress: invoiceData.vendorAddress,
        vendorTaxId: invoiceData.vendorTaxId,

        invoiceDate: new Date(invoiceData.invoiceDate || Date.now()),
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
        totalAmount: invoiceData.totalAmount || 0,
        taxAmount: invoiceData.taxAmount || 0,
        subtotal: invoiceData.subtotal || 0,
        currency: invoiceData.currency || 'EUR',

        status: 'PROCESSING',
        category: aiAnalysis.categorySuggestion || invoiceData.category,
        project: aiAnalysis.suggestedProject
          ? projects.find(p => p.id === aiAnalysis.suggestedProject!.projectId)
              ?.name
          : null,

        ocrConfidence: invoiceData.confidence,
        ocrRawText: ocrResult.data.rawText,
        extractedFields: ocrResult.data.extractedFields,

        notes: `AI Analysis: ${aiAnalysis.riskAssessment || 'No risks identified'}`,
        tags: ['ai-processed', 'auto-categorized'],

        companyId,
        createdById: 'system-user', // In a real app, this would come from authentication
      },
    });

    // Step 6: Create line items if available
    if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
      await prisma.lineItem.createMany({
        data: invoiceData.lineItems.map((item: any) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.totalPrice || 0,
          totalPrice: item.totalPrice || 0,
          category: item.category || aiAnalysis.categorySuggestion,
          project: aiAnalysis.suggestedProject
            ? projects.find(
                p => p.id === aiAnalysis.suggestedProject!.projectId
              )?.name
            : null,
        })),
      });
    }

    // Step 7: Check for transaction matches and update payment status
    let paymentStatus = 'unpaid';
    const matchedTransactions: any[] = [];

    if (aiAnalysis.transactionMatches.length > 0) {
      for (const match of aiAnalysis.transactionMatches) {
        if (match.confidence > 0.8) {
          // High confidence match
          matchedTransactions.push(match);
          paymentStatus = 'paid';
        }
      }
    }

    // Update invoice status based on payment analysis
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: paymentStatus === 'paid' ? 'PAID' : 'PROCESSING',
        paidAt: paymentStatus === 'paid' ? new Date() : null,
      },
    });

    // Step 8: Budget impact analysis if project is suggested
    let budgetImpact = null;
    if (aiAnalysis.suggestedProject) {
      budgetImpact = await invoiceAnalyzer.assessBudgetImpact(
        aiAnalysis.suggestedProject.projectId,
        invoiceData.totalAmount || 0,
        projects.map(project => ({
          id: project.id,
          name: project.name,
          code: project.code,
          totalBudget: Number(project.totalBudget || 0),
          spentAmount: Number(project.spentAmount || 0),
          categories: project.categories,
          description: project.description,
          startDate: project.startDate?.toISOString(),
          endDate: project.endDate?.toISOString(),
        }))
      );
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
      aiAnalysis: {
        suggestedProject: aiAnalysis.suggestedProject,
        paymentStatus,
        matchedTransactions,
        categorySuggestion: aiAnalysis.categorySuggestion,
        riskAssessment: aiAnalysis.riskAssessment,
        budgetImpact,
      },
      processingTime: Date.now() - Date.now(), // This would be calculated properly
    });
  } catch (error) {
    console.error('Invoice processing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
