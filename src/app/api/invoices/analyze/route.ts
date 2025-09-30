import { invoiceAnalyzer } from '@/lib/ai/invoice-analyzer';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get invoice data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get all projects for AI analysis
    const projects = await prisma.project.findMany({
      where: {
        companyId: invoice.companyId,
      },
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

    // Get recent transactions for matching
    const transactions = await prisma.transaction.findMany({
      where: {
        bankAccount: {
          companyId: invoice.companyId,
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
      take: 50,
    });

    // Prepare data for AI analysis
    const invoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendor: invoice.vendor,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency,
      invoiceDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString(),
      category: invoice.category,
      description: invoice.notes,
      lineItems: invoice.lineItems.map(item => ({
        description: item.description,
        amount: Number(item.totalPrice),
        category: item.category,
      })),
    };

    const projectData = projects.map(project => ({
      id: project.id,
      name: project.name,
      code: project.code,
      totalBudget: Number(project.totalBudget || 0),
      spentAmount: Number(project.spentAmount || 0),
      categories: project.categories,
      description: project.description,
      startDate: project.startDate?.toISOString(),
      endDate: project.endDate?.toISOString(),
    }));

    const transactionData = transactions.map(transaction => ({
      id: transaction.id,
      amount: Number(transaction.amount),
      description: transaction.description,
      date: transaction.date.toISOString(),
      type: transaction.type.toLowerCase() as 'income' | 'expense',
      confidence: 0.5, // Default confidence
    }));

    // Analyze with AI
    const analysis = await invoiceAnalyzer.analyzeInvoice(
      invoiceData,
      projectData,
      transactionData
    );

    // Update invoice with AI suggestions
    const updateData: any = {};

    if (analysis.suggestedProject) {
      // Find the suggested project name to match with our project field
      const suggestedProject = projects.find(
        p => p.id === analysis.suggestedProject!.projectId
      );
      if (suggestedProject) {
        updateData.project = suggestedProject.name;
      }
    }

    if (analysis.categorySuggestion) {
      updateData.category = analysis.categorySuggestion;
    }

    // Update payment status
    updateData.status =
      analysis.paymentStatus === 'paid'
        ? 'PAID'
        : analysis.paymentStatus === 'partial'
          ? 'REVIEWED'
          : 'PROCESSING';

    // Update invoice in database
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    // Return analysis results
    return NextResponse.json({
      success: true,
      analysis,
      updatedInvoice: {
        id: updatedInvoice.id,
        project: updatedInvoice.project,
        category: updatedInvoice.category,
        status: updatedInvoice.status,
      },
    });
  } catch (error) {
    console.error('Error analyzing invoice:', error);
    return NextResponse.json(
      { error: 'Failed to analyze invoice' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get invoice with AI analysis results
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get project suggestions
    const projects = await prisma.project.findMany({
      where: {
        companyId: invoice.companyId,
      },
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

    // Get potential transaction matches
    const potentialMatches = await prisma.transaction.findMany({
      where: {
        bankAccount: {
          companyId: invoice.companyId,
        },
        amount: {
          gte: Number(invoice.totalAmount) * 0.95, // Within 5% of invoice amount
          lte: Number(invoice.totalAmount) * 1.05,
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
      take: 10,
    });

    return NextResponse.json({
      invoice,
      projectSuggestions: projects.map(project => ({
        id: project.id,
        name: project.name,
        code: project.code,
        budgetUtilization:
          Number(project.totalBudget || 0) > 0
            ? (Number(project.spentAmount || 0) /
                Number(project.totalBudget || 0)) *
              100
            : 0,
        categories: project.categories,
        description: project.description,
      })),
      transactionMatches: potentialMatches.map(transaction => ({
        id: transaction.id,
        amount: Number(transaction.amount),
        description: transaction.description,
        date: transaction.date,
        type: transaction.type,
        similarity: this.calculateSimilarity(
          invoice.vendor,
          transaction.description
        ),
      })),
    });
  } catch (error) {
    console.error('Error getting invoice analysis:', error);
    return NextResponse.json(
      { error: 'Failed to get invoice analysis' },
      { status: 500 }
    );
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Simple similarity calculation based on common words
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);

  return commonWords.length / totalWords;
}
