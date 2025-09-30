import {
  BankStatementData,
  bankStatementAnalyzer,
} from '@/lib/ai/bank-statement-analyzer';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const bankAccountId = formData.get('bankAccountId') as string | null;
    const saveToDatabase = formData.get('saveToDatabase') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this company
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId,
        isActive: true,
      },
    });

    if (!userCompany) {
      return NextResponse.json(
        { error: 'Access denied to this company' },
        { status: 403 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Please upload CSV, XLS, XLSX, or PDF files.',
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'File size too large. Please upload files smaller than 10MB.',
        },
        { status: 400 }
      );
    }

    let statementData: BankStatementData;

    // Process file based on type
    if (file.type === 'text/csv') {
      const csvContent = await file.text();
      statementData = bankStatementAnalyzer.parseCSVStatement(csvContent);
    } else if (file.type === 'application/pdf') {
      const pdfBuffer = Buffer.from(await file.arrayBuffer());
      statementData = await bankStatementAnalyzer.parsePDFStatement(
        pdfBuffer,
        file.name
      );
    } else if (
      file.type === 'application/vnd.ms-excel' ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      const excelBuffer = Buffer.from(await file.arrayBuffer());
      statementData = bankStatementAnalyzer.parseXLSStatement(excelBuffer);
    } else {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Please upload CSV, XLS, XLSX, or PDF files.',
        },
        { status: 400 }
      );
    }

    // Analyze the statement with AI (includes duplicate detection and reconciliation)
    const analysis = await bankStatementAnalyzer.analyzeBankStatement(
      statementData,
      companyId
    );

    // Save to database if requested
    if (saveToDatabase) {
      // Create bank statement record
      const bankStatement = await prisma.bankStatement.create({
        data: {
          companyId,
          bankAccountId: bankAccountId || undefined,
          filename: file.name,
          originalFile: file.name,
          accountNumber: statementData.accountNumber,
          accountHolder: statementData.accountHolder,
          bankName: statementData.bankName,
          statementPeriod: {
            startDate: statementData.statementPeriod.startDate,
            endDate: statementData.statementPeriod.endDate,
          },
          openingBalance: statementData.openingBalance,
          closingBalance: statementData.closingBalance,
          currency: statementData.currency,
          status: 'PROCESSED',
          transactionCount: statementData.transactions.length,
          processedCount: 0,
          aiConfidence: statementData.confidence,
          aiAnalysis: JSON.parse(JSON.stringify(analysis)),
          summary: JSON.parse(JSON.stringify(analysis.summary)),
          processedAt: new Date(),
        },
      });

      // Save transactions to database
      await bankStatementAnalyzer.saveTransactions(
        statementData,
        companyId,
        analysis
      );

      // Update bank account balance if provided
      if (bankAccountId && statementData.closingBalance) {
        await prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: { balance: statementData.closingBalance },
        });
      }

      return NextResponse.json({
        success: true,
        statementData,
        analysis,
        saved: true,
        statementId: bankStatement.id,
        message: 'Bank statement processed and saved successfully',
      });
    }

    return NextResponse.json({
      success: true,
      statementData,
      analysis,
      saved: false,
      message: 'Bank statement processed successfully (not saved to database)',
    });
  } catch (error) {
    console.error('Error processing bank statement:', error);
    return NextResponse.json(
      {
        error: 'Failed to process bank statement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Bank statement processing endpoint',
      supportedFormats: ['CSV', 'XLS', 'XLSX', 'PDF'],
      maxFileSize: '10MB',
      features: [
        'AI-powered transaction parsing',
        'Bank format detection (Deutsche Bank, Sparkasse, N26, etc.)',
        'Currency detection',
        'Counterparty extraction',
        'Duplicate detection',
        'Transaction categorization',
        'Anomaly detection',
        'Invoice reconciliation',
      ],
    },
    { status: 200 }
  );
}
