import { BankTransaction } from '@/lib/ai/bank-statement-analyzer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions, companyId } = body;

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Transactions array is required' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Validate transaction structure
    for (const transaction of transactions) {
      if (
        !transaction.id ||
        !transaction.date ||
        !transaction.description ||
        !transaction.amount
      ) {
        return NextResponse.json(
          {
            error:
              'Invalid transaction structure. Required fields: id, date, description, amount',
          },
          { status: 400 }
        );
      }
    }

    // In production, this would save to the database
    // For now, we'll just return success
    console.log(
      `Saving ${transactions.length} transactions for company ${companyId}`
    );

    // Simulate database save
    const savedTransactions = transactions.map((tx: BankTransaction) => ({
      ...tx,
      id: `saved_${tx.id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${savedTransactions.length} transactions`,
      transactionCount: savedTransactions.length,
      transactions: savedTransactions,
    });
  } catch (error) {
    console.error('Error saving transactions:', error);
    return NextResponse.json(
      {
        error: 'Failed to save transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Bank transactions save endpoint' },
    { status: 200 }
  );
}
