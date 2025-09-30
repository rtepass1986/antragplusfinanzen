import { prisma } from '../prisma';
import { addMonths, startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

interface ForecastInput {
  historicalTransactions: any[];
  pendingInvoices: any[];
  recurringItems: any[];
  seasonalFactors?: SeasonalFactor[];
  marketConditions?: MarketConditions;
}

interface SeasonalFactor {
  month: number;
  factor: number; // 1.0 = normal, >1 = higher, <1 = lower
}

interface MarketConditions {
  economicIndex: number;
  industryGrowth: number;
  inflationRate: number;
}

interface ForecastResult {
  month: Date;
  income: {
    predicted: number;
    conservative: number;
    optimistic: number;
    confidence: number;
  };
  expenses: {
    predicted: number;
    conservative: number;
    optimistic: number;
    confidence: number;
  };
  netCashFlow: {
    predicted: number;
    conservative: number;
    optimistic: number;
    confidence: number;
  };
  factors: string[];
  risks: string[];
}

export class CashFlowForecastingEngine {
  
  /**
   * Generates cash flow forecast for specified period
   */
  async generateForecast(
    companyId: string, 
    scenarioId: string,
    months: number = 12
  ): Promise<ForecastResult[]> {
    
    const scenario = await prisma.cashFlowScenario.findUnique({
      where: { id: scenarioId },
      include: { company: true }
    });

    if (!scenario) {
      throw new Error('Scenario not found');
    }

    // Gather input data
    const input = await this.gatherForecastInput(companyId, months);
    
    // Apply scenario assumptions
    const adjustedInput = this.applyScenarioAssumptions(input, scenario.assumptions as any);
    
    // Generate monthly forecasts
    const forecasts: ForecastResult[] = [];
    const startDate = startOfMonth(new Date());
    
    for (let i = 0; i < months; i++) {
      const month = addMonths(startDate, i);
      const forecast = await this.generateMonthlyForecast(month, adjustedInput, scenario);
      forecasts.push(forecast);
    }

    // Save forecasts to database
    await this.saveForecastResults(scenarioId, forecasts);
    
    return forecasts;
  }

  /**
   * Gathers all input data needed for forecasting
   */
  private async gatherForecastInput(companyId: string, months: number): Promise<ForecastInput> {
    const lookbackMonths = Math.max(months, 24); // At least 2 years of history
    const lookbackDate = addMonths(new Date(), -lookbackMonths);

    // Get historical transaction data
    const historicalTransactions = await prisma.transaction.findMany({
      where: {
        bankAccount: {
          companyId
        },
        date: {
          gte: lookbackDate
        }
      },
      include: {
        bankAccount: true
      },
      orderBy: { date: 'desc' }
    });

    // Get pending invoices
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: {
          in: ['APPROVED', 'PROCESSING']
        },
        paidAt: null
      },
      orderBy: { dueDate: 'asc' }
    });

    // Get recurring items (simplified - would be more complex in practice)
    const recurringItems = await this.identifyRecurringItems(companyId, historicalTransactions);

    return {
      historicalTransactions,
      pendingInvoices,
      recurringItems
    };
  }

  /**
   * Generates forecast for a single month
   */
  private async generateMonthlyForecast(
    month: Date, 
    input: ForecastInput,
    scenario: any
  ): Promise<ForecastResult> {
    
    // Predict income
    const incomeForecast = this.forecastIncome(month, input, scenario);
    
    // Predict expenses  
    const expenseForecast = this.forecastExpenses(month, input, scenario);
    
    // Calculate net cash flow
    const netCashFlow = {
      predicted: incomeForecast.predicted - expenseForecast.predicted,
      conservative: incomeForecast.conservative - expenseForecast.optimistic,
      optimistic: incomeForecast.optimistic - expenseForecast.conservative,
      confidence: Math.min(incomeForecast.confidence, expenseForecast.confidence)
    };

    // Identify factors and risks
    const factors = this.identifyFactors(month, input, scenario);
    const risks = this.identifyRisks(month, input, scenario, netCashFlow);

    return {
      month,
      income: incomeForecast,
      expenses: expenseForecast,
      netCashFlow,
      factors,
      risks
    };
  }

  /**
   * Forecasts income for a specific month
   */
  private forecastIncome(
    month: Date,
    input: ForecastInput,
    scenario: any
  ): { predicted: number; conservative: number; optimistic: number; confidence: number } {
    
    // Base prediction on historical data
    const historicalIncome = this.getHistoricalIncome(month, input.historicalTransactions);
    const trendFactor = this.calculateTrendFactor(input.historicalTransactions, 'INCOME');
    
    // Factor in pending invoices expected to be paid
    const expectedInvoicePayments = this.predictInvoicePayments(month, input.pendingInvoices);
    
    // Apply seasonal adjustments
    const seasonalFactor = this.getSeasonalFactor(month.getMonth() + 1, input.seasonalFactors);
    
    // Apply scenario risk level
    const riskAdjustment = this.getRiskAdjustment(scenario.riskLevel);
    
    const baseIncome = historicalIncome * trendFactor * seasonalFactor + expectedInvoicePayments;
    
    return {
      predicted: baseIncome,
      conservative: baseIncome * riskAdjustment.conservative,
      optimistic: baseIncome * riskAdjustment.optimistic,
      confidence: this.calculateConfidence(historicalIncome, expectedInvoicePayments)
    };
  }

  /**
   * Forecasts expenses for a specific month
   */
  private forecastExpenses(
    month: Date,
    input: ForecastInput,
    scenario: any
  ): { predicted: number; conservative: number; optimistic: number; confidence: number } {
    
    // Base prediction on historical data
    const historicalExpenses = this.getHistoricalExpenses(month, input.historicalTransactions);
    const trendFactor = this.calculateTrendFactor(input.historicalTransactions, 'EXPENSE');
    
    // Factor in recurring expenses
    const recurringExpenses = this.predictRecurringExpenses(month, input.recurringItems);
    
    // Apply seasonal adjustments
    const seasonalFactor = this.getSeasonalFactor(month.getMonth() + 1, input.seasonalFactors);
    
    // Apply scenario risk level
    const riskAdjustment = this.getRiskAdjustment(scenario.riskLevel);
    
    const baseExpenses = historicalExpenses * trendFactor * seasonalFactor + recurringExpenses;
    
    return {
      predicted: baseExpenses,
      conservative: baseExpenses * riskAdjustment.conservativeExpense,
      optimistic: baseExpenses * riskAdjustment.optimisticExpense,
      confidence: this.calculateConfidence(historicalExpenses, recurringExpenses)
    };
  }

  /**
   * Calculates historical income for similar months
   */
  private getHistoricalIncome(month: Date, transactions: any[]): number {
    const monthIndex = month.getMonth();
    const incomeTransactions = transactions.filter(t => 
      t.type === 'INCOME' && 
      t.date.getMonth() === monthIndex
    );
    
    if (incomeTransactions.length === 0) return 0;
    
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    return totalIncome / incomeTransactions.length * 12; // Annualized average
  }

  /**
   * Calculates historical expenses for similar months
   */
  private getHistoricalExpenses(month: Date, transactions: any[]): number {
    const monthIndex = month.getMonth();
    const expenseTransactions = transactions.filter(t => 
      t.type === 'EXPENSE' && 
      t.date.getMonth() === monthIndex
    );
    
    if (expenseTransactions.length === 0) return 0;
    
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    return totalExpenses / expenseTransactions.length * 12; // Annualized average
  }

  /**
   * Predicts when pending invoices will be paid
   */
  private predictInvoicePayments(month: Date, pendingInvoices: any[]): number {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    return pendingInvoices
      .filter(invoice => {
        // Predict payment date based on due date and payment history
        const expectedPaymentDate = this.predictPaymentDate(invoice);
        return expectedPaymentDate >= monthStart && expectedPaymentDate <= monthEnd;
      })
      .reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  }

  /**
   * Predicts payment date based on invoice due date and payment patterns
   */
  private predictPaymentDate(invoice: any): Date {
    const dueDate = invoice.dueDate || invoice.invoiceDate;
    
    // Simple prediction: assume 80% pay on time, 20% pay 15 days late
    const onTimePayment = 0.8;
    const avgDelay = 15; // days
    
    return Math.random() < onTimePayment 
      ? dueDate 
      : new Date(dueDate.getTime() + avgDelay * 24 * 60 * 60 * 1000);
  }

  /**
   * Identifies recurring transaction patterns
   */
  private async identifyRecurringItems(companyId: string, transactions: any[]): Promise<any[]> {
    // Group transactions by similar amounts and descriptions
    const groups = new Map<string, any[]>();
    
    for (const transaction of transactions) {
      const key = this.generateRecurringKey(transaction);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(transaction);
    }

    // Identify patterns that occur regularly
    const recurringItems: any[] = [];
    
    for (const [key, groupTransactions] of groups) {
      if (groupTransactions.length >= 3) { // At least 3 occurrences
        const intervals = this.calculateIntervals(groupTransactions);
        const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
        
        // If average interval is between 28-32 days (monthly) or 7-10 days (weekly)
        if ((avgInterval >= 28 && avgInterval <= 32) || (avgInterval >= 7 && avgInterval <= 10)) {
          recurringItems.push({
            description: groupTransactions[0].description,
            amount: this.calculateAverageAmount(groupTransactions),
            interval: avgInterval,
            type: groupTransactions[0].type,
            lastOccurrence: groupTransactions[0].date,
            confidence: Math.min(groupTransactions.length / 12, 1) // Max confidence at 12 occurrences
          });
        }
      }
    }

    return recurringItems;
  }

  /**
   * Generates a key for grouping similar transactions
   */
  private generateRecurringKey(transaction: any): string {
    const description = transaction.description.toLowerCase()
      .replace(/\d+/g, 'X') // Replace numbers with X
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim();
    
    const amountRange = Math.floor(Number(transaction.amount) / 100) * 100; // Group by 100€ ranges
    
    return `${description}_${amountRange}_${transaction.type}`;
  }

  /**
   * Calculates intervals between transactions
   */
  private calculateIntervals(transactions: any[]): number[] {
    const sortedTransactions = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < sortedTransactions.length; i++) {
      const interval = (sortedTransactions[i].date.getTime() - sortedTransactions[i-1].date.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(interval);
    }
    
    return intervals;
  }

  /**
   * Calculates trend factor based on recent transaction history
   */
  private calculateTrendFactor(transactions: any[], type: 'INCOME' | 'EXPENSE'): number {
    const relevantTransactions = transactions.filter(t => t.type === type);
    
    if (relevantTransactions.length < 6) return 1; // Not enough data
    
    // Calculate 3-month moving averages
    const recent3Months = this.calculateMovingAverage(relevantTransactions, 3);
    const previous3Months = this.calculateMovingAverage(relevantTransactions.slice(3), 3);
    
    if (previous3Months === 0) return 1;
    
    return recent3Months / previous3Months;
  }

  /**
   * Calculates moving average for transactions
   */
  private calculateMovingAverage(transactions: any[], months: number): number {
    const recentTransactions = transactions.slice(0, months * 30); // Approximate
    const total = recentTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    return total / months;
  }

  /**
   * Gets seasonal factor for a month
   */
  private getSeasonalFactor(month: number, seasonalFactors?: SeasonalFactor[]): number {
    if (!seasonalFactors) return 1;
    
    const factor = seasonalFactors.find(f => f.month === month);
    return factor ? factor.factor : 1;
  }

  /**
   * Gets risk adjustment factors based on scenario risk level
   */
  private getRiskAdjustment(riskLevel: string): {
    conservative: number;
    optimistic: number;
    conservativeExpense: number;
    optimisticExpense: number;
  } {
    switch (riskLevel) {
      case 'LOW':
        return { conservative: 0.95, optimistic: 1.05, conservativeExpense: 1.05, optimisticExpense: 0.95 };
      case 'MEDIUM':
        return { conservative: 0.85, optimistic: 1.15, conservativeExpense: 1.15, optimisticExpense: 0.85 };
      case 'HIGH':
        return { conservative: 0.7, optimistic: 1.3, conservativeExpense: 1.3, optimisticExpense: 0.7 };
      default:
        return { conservative: 0.85, optimistic: 1.15, conservativeExpense: 1.15, optimisticExpense: 0.85 };
    }
  }

  /**
   * Calculates confidence level for predictions
   */
  private calculateConfidence(historical: number, predicted: number): number {
    const ratio = historical > 0 ? Math.min(predicted / historical, historical / predicted) : 0;
    return Math.max(0.1, Math.min(ratio, 0.95)); // Confidence between 10% and 95%
  }

  /**
   * Applies scenario assumptions to input data
   */
  private applyScenarioAssumptions(input: ForecastInput, assumptions: any): ForecastInput {
    // Apply growth assumptions, market conditions, etc.
    if (assumptions.revenueGrowth) {
      input.historicalTransactions = input.historicalTransactions.map(t => ({
        ...t,
        amount: t.type === 'INCOME' ? Number(t.amount) * (1 + assumptions.revenueGrowth / 100) : t.amount
      }));
    }

    if (assumptions.costInflation) {
      input.historicalTransactions = input.historicalTransactions.map(t => ({
        ...t,
        amount: t.type === 'EXPENSE' ? Number(t.amount) * (1 + assumptions.costInflation / 100) : t.amount
      }));
    }

    return input;
  }

  /**
   * Identifies factors affecting the forecast
   */
  private identifyFactors(month: Date, input: ForecastInput, scenario: any): string[] {
    const factors: string[] = [];
    
    // Seasonal factors
    const monthName = format(month, 'MMMM');
    if ([11, 12, 0].includes(month.getMonth())) { // Nov, Dec, Jan
      factors.push(`${monthName} seasonal effects`);
    }

    // Pending invoices impact
    if (input.pendingInvoices.length > 0) {
      factors.push(`${input.pendingInvoices.length} pending invoices`);
    }

    // Recurring items
    if (input.recurringItems.length > 0) {
      factors.push(`${input.recurringItems.length} recurring items identified`);
    }

    return factors;
  }

  /**
   * Identifies risks for the forecast
   */
  private identifyRisks(
    month: Date, 
    input: ForecastInput, 
    scenario: any, 
    netCashFlow: any
  ): string[] {
    const risks: string[] = [];
    
    // Negative cash flow risk
    if (netCashFlow.conservative < 0) {
      risks.push('Risk of negative cash flow');
    }

    // High dependency on pending invoices
    const pendingAmount = input.pendingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    if (pendingAmount > netCashFlow.predicted * 0.5) {
      risks.push('High dependency on pending invoice payments');
    }

    // Low confidence prediction
    if (netCashFlow.confidence < 0.5) {
      risks.push('Low confidence in prediction due to limited data');
    }

    return risks;
  }

  /**
   * Saves forecast results to database
   */
  private async saveForecastResults(scenarioId: string, forecasts: ForecastResult[]): Promise<void> {
    // Delete existing forecasts for this scenario
    await prisma.cashFlowForecast.deleteMany({
      where: { scenarioId }
    });

    // Create new forecasts
    const forecastData = forecasts.map(forecast => ({
      scenarioId,
      month: forecast.month,
      income: forecast.income.predicted,
      expenses: forecast.expenses.predicted,
      net: forecast.netCashFlow.predicted,
      confidence: forecast.netCashFlow.confidence
    }));

    await prisma.cashFlowForecast.createMany({
      data: forecastData
    });
  }

  private calculateAverageAmount(transactions: any[]): number {
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    return total / transactions.length;
  }

  private predictRecurringExpenses(month: Date, recurringItems: any[]): number {
    return recurringItems
      .filter(item => item.type === 'EXPENSE')
      .reduce((sum, item) => sum + item.amount, 0);
  }
}

export const cashFlowForecastingEngine = new CashFlowForecastingEngine();