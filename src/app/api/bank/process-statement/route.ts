import {
  BankStatementData,
  BankTransaction,
  bankStatementAnalyzer,
} from '@/lib/ai/bank-statement-analyzer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
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
      statementData = await bankStatementAnalyzer.parsePDFStatement(pdfBuffer);
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

    // Get existing transactions for duplicate detection
    // In production, this would query the database
    const existingTransactions: BankTransaction[] = [];

    // Analyze the statement with AI
    const analysis = await bankStatementAnalyzer.analyzeBankStatement(
      statementData,
      existingTransactions
    );

    return NextResponse.json({
      success: true,
      statementData,
      analysis,
      message: 'Bank statement processed successfully',
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
    { message: 'Bank statement processing endpoint' },
    { status: 200 }
  );
}
