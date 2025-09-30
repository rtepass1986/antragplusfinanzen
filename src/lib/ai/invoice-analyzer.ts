interface InvoiceData {
  id: string;
  invoiceNumber: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  invoiceDate: string;
  dueDate?: string;
  category?: string;
  description?: string;
  lineItems?: Array<{
    description: string;
    amount: number;
    category?: string;
  }>;
}

interface ProjectFinancialPlan {
  id: string;
  name: string;
  code?: string;
  totalBudget: number;
  spentAmount: number;
  categories: string[];
  description?: string;
  startDate?: string;
  endDate?: string;
}

interface TransactionMatch {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: 'income' | 'expense';
  confidence: number;
}

interface AIAnalysisResult {
  suggestedProject?: {
    projectId: string;
    projectName: string;
    confidence: number;
    reasoning: string;
  };
  transactionMatches: TransactionMatch[];
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  categorySuggestion?: string;
  riskAssessment?: string;
}

export class InvoiceAnalyzer {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  async analyzeInvoice(
    invoice: InvoiceData,
    projects: ProjectFinancialPlan[],
    transactions: TransactionMatch[]
  ): Promise<AIAnalysisResult> {
    try {
      const analysisPrompt = this.buildAnalysisPrompt(
        invoice,
        projects,
        transactions
      );

      const response = await this.callOpenAI(analysisPrompt);

      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('Error analyzing invoice with AI:', error);
      return this.getFallbackAnalysis(invoice);
    }
  }

  private buildAnalysisPrompt(
    invoice: InvoiceData,
    projects: ProjectFinancialPlan[],
    transactions: TransactionMatch[]
  ): string {
    return `
You are an AI financial analyst specializing in invoice processing and project management. Analyze the following invoice and provide intelligent recommendations.

INVOICE DATA:
- Invoice Number: ${invoice.invoiceNumber}
- Vendor: ${invoice.vendor}
- Amount: ${invoice.totalAmount} ${invoice.currency}
- Date: ${invoice.invoiceDate}
- Due Date: ${invoice.dueDate || 'Not specified'}
- Category: ${invoice.category || 'Not specified'}
- Description: ${invoice.description || 'Not specified'}
- Line Items: ${JSON.stringify(invoice.lineItems || [])}

AVAILABLE PROJECTS:
${projects
  .map(
    project => `
- Project: ${project.name} (${project.code || 'No code'})
- Budget: ${project.totalBudget} (Spent: ${project.spentAmount})
- Categories: ${project.categories.join(', ')}
- Period: ${project.startDate || 'No start'} to ${project.endDate || 'No end'}
- Description: ${project.description || 'No description'}
`
  )
  .join('\n')}

RECENT TRANSACTIONS:
${transactions
  .map(
    transaction => `
- Amount: ${transaction.amount} (${transaction.type})
- Description: ${transaction.description}
- Date: ${transaction.date}
- Confidence: ${transaction.confidence}
`
  )
  .join('\n')}

ANALYSIS REQUIREMENTS:
1. PROJECT MATCHING: Based on the invoice details, suggest which project this invoice should be assigned to. Consider:
   - Budget availability and remaining funds
   - Category alignment with project categories
   - Timeline relevance (project start/end dates vs invoice date)
   - Vendor alignment with project scope
   - Financial plan compatibility

2. TRANSACTION MATCHING: Determine if this invoice corresponds to any existing transaction. Look for:
   - Amount matches (exact or close)
   - Vendor/description similarity
   - Date proximity
   - Payment patterns

3. PAYMENT STATUS: Determine if this invoice is paid, unpaid, or partially paid based on transaction matches.

4. RISK ASSESSMENT: Identify any potential issues:
   - Budget overruns
   - Category mismatches
   - Timeline conflicts
   - Vendor concerns

RESPONSE FORMAT (JSON):
{
  "suggestedProject": {
    "projectId": "project-id-if-match",
    "projectName": "Project Name",
    "confidence": 0.85,
    "reasoning": "Detailed explanation of why this project fits best"
  },
  "transactionMatches": [
    {
      "id": "transaction-id",
      "confidence": 0.95,
      "reasoning": "Why this transaction matches"
    }
  ],
  "paymentStatus": "paid|unpaid|partial",
  "categorySuggestion": "Suggested category if different from current",
  "riskAssessment": "Any risks or concerns identified"
}

Provide your analysis in valid JSON format only.
`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial analyst AI that processes invoices and matches them to projects and transactions. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private parseAnalysisResponse(response: string): AIAnalysisResult {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        suggestedProject: parsed.suggestedProject,
        transactionMatches: parsed.transactionMatches || [],
        paymentStatus: parsed.paymentStatus || 'unpaid',
        categorySuggestion: parsed.categorySuggestion,
        riskAssessment: parsed.riskAssessment,
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.getFallbackAnalysis();
    }
  }

  private getFallbackAnalysis(invoice?: InvoiceData): AIAnalysisResult {
    return {
      suggestedProject: undefined,
      transactionMatches: [],
      paymentStatus: 'unpaid',
      categorySuggestion: invoice?.category || 'General',
      riskAssessment: 'AI analysis unavailable - manual review recommended',
    };
  }

  async suggestProjectCategory(invoice: InvoiceData): Promise<string> {
    try {
      const prompt = `
Analyze this invoice and suggest the most appropriate expense category:

Invoice Details:
- Vendor: ${invoice.vendor}
- Amount: ${invoice.totalAmount} ${invoice.currency}
- Description: ${invoice.description || 'No description'}
- Line Items: ${JSON.stringify(invoice.lineItems || [])}

Common categories include: Software, Hardware, Personalkosten, Beratung, Schulungen, Forschung, Entwicklung, Innovation, Ausstattung, Reisen, Energieeffizienz, Abfallmanagement, Veranstaltungen, Marketing, Büromaterial, Miete, Versicherung, Kommunikation.

Respond with only the most appropriate category name.
`;

      const response = await this.callOpenAI(prompt);
      return response.trim().replace(/['"]/g, '');
    } catch (error) {
      console.error('Error suggesting category:', error);
      return invoice.category || 'General';
    }
  }

  async assessBudgetImpact(
    projectId: string,
    invoiceAmount: number,
    projects: ProjectFinancialPlan[]
  ): Promise<{
    budgetImpact: 'safe' | 'warning' | 'critical';
    remainingBudget: number;
    utilizationPercentage: number;
    recommendation: string;
  }> {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const newSpentAmount = project.spentAmount + invoiceAmount;
      const remainingBudget = project.totalBudget - newSpentAmount;
      const utilizationPercentage =
        (newSpentAmount / project.totalBudget) * 100;

      let budgetImpact: 'safe' | 'warning' | 'critical';
      let recommendation: string;

      if (utilizationPercentage > 90) {
        budgetImpact = 'critical';
        recommendation =
          'Critical: This invoice would exceed 90% of project budget. Consider budget revision or alternative funding.';
      } else if (utilizationPercentage > 75) {
        budgetImpact = 'warning';
        recommendation =
          'Warning: This invoice would exceed 75% of project budget. Monitor spending closely.';
      } else {
        budgetImpact = 'safe';
        recommendation =
          'Safe: Budget utilization remains within acceptable limits.';
      }

      return {
        budgetImpact,
        remainingBudget,
        utilizationPercentage,
        recommendation,
      };
    } catch (error) {
      console.error('Error assessing budget impact:', error);
      return {
        budgetImpact: 'warning',
        remainingBudget: 0,
        utilizationPercentage: 0,
        recommendation:
          'Unable to assess budget impact - manual review required',
      };
    }
  }
}

export const invoiceAnalyzer = new InvoiceAnalyzer();
