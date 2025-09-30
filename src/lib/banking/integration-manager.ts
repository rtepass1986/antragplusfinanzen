import { prisma } from '../prisma';
import axios from 'axios';

interface BankConnection {
  bankId: string;
  bankName: string;
  country: string;
  bic: string;
  authMethod: 'PSD2' | 'HBCI' | 'API_KEY' | 'OAUTH';
  endpoints: {
    auth: string;
    accounts: string;
    transactions: string;
    balance: string;
  };
  credentials: {
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;
    userId?: string;
    pin?: string;
  };
}

interface BankAccount {
  iban: string;
  bic?: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance?: {
    amount: number;
    date: Date;
  };
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  date: Date;
  valueDate?: Date;
  counterparty?: {
    name?: string;
    iban?: string;
    bic?: string;
  };
  category?: string;
  type: 'DEBIT' | 'CREDIT';
}

interface BankingProvider {
  connect(credentials: any): Promise<string>; // Returns access token
  getAccounts(accessToken: string): Promise<BankAccount[]>;
  getTransactions(accessToken: string, iban: string, fromDate?: Date, toDate?: Date): Promise<Transaction[]>;
  getBalance(accessToken: string, iban: string): Promise<{ amount: number; currency: string; date: Date }>;
  initiatePayment?(accessToken: string, payment: PaymentInstruction): Promise<string>;
}

interface PaymentInstruction {
  fromIban: string;
  toIban: string;
  toBic?: string;
  amount: number;
  currency: string;
  reference: string;
  recipientName: string;
  executionDate?: Date;
}

export class BankingIntegrationManager {
  private providers: Map<string, BankingProvider> = new Map();

  constructor() {
    // Initialize banking providers
    this.providers.set('NORDIGEN', new NordigenProvider());
    this.providers.set('SALTEDGE', new SaltEdgeProvider());
    this.providers.set('PLAID', new PlaidProvider());
    this.providers.set('YAPILY', new YapilyProvider());
  }

  /**
   * Connects to a bank and stores the connection
   */
  async connectBank(
    companyId: string,
    bankConfig: {
      provider: string;
      bankId: string;
      credentials: any;
      accountSelection?: string[]; // IBANs to sync
    }
  ): Promise<string> {
    const provider = this.providers.get(bankConfig.provider);
    if (!provider) {
      throw new Error(`Banking provider ${bankConfig.provider} not supported`);
    }

    try {
      // Establish connection with bank
      const accessToken = await provider.connect(bankConfig.credentials);
      
      // Get available accounts
      const accounts = await provider.getAccounts(accessToken);
      
      // Filter accounts if selection was provided
      const selectedAccounts = bankConfig.accountSelection
        ? accounts.filter(acc => bankConfig.accountSelection!.includes(acc.iban))
        : accounts;

      // Store bank accounts in database
      const bankAccountIds: string[] = [];
      
      for (const account of selectedAccounts) {
        const bankAccount = await prisma.bankAccount.upsert({
          where: {
            companyId_iban: {
              companyId,
              iban: account.iban
            }
          },
          update: {
            name: account.accountName,
            bankName: bankConfig.bankId,
            balance: account.balance?.amount,
            isActive: true
          },
          create: {
            companyId,
            name: account.accountName,
            iban: account.iban,
            bic: account.bic || '',
            bankName: bankConfig.bankId,
            accountType: account.accountType,
            balance: account.balance?.amount,
            isActive: true
          }
        });
        
        bankAccountIds.push(bankAccount.id);
      }

      // Store integration configuration
      const integrationConfig = await prisma.integrationConfig.create({
        data: {
          companyId,
          type: 'BANK_API',
          name: bankConfig.bankId,
          config: {
            provider: bankConfig.provider,
            bankId: bankConfig.bankId,
            accessToken: this.encryptToken(accessToken),
            connectedAccounts: selectedAccounts.map(acc => acc.iban),
            lastSync: new Date().toISOString()
          }
        }
      });

      // Initial transaction sync
      await this.syncTransactions(integrationConfig.id);

      return integrationConfig.id;

    } catch (error) {
      throw new Error(`Failed to connect to bank: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Syncs transactions for all connected bank accounts
   */
  async syncAllTransactions(companyId: string): Promise<void> {
    const integrations = await prisma.integrationConfig.findMany({
      where: {
        companyId,
        type: 'BANK_API',
        isActive: true
      }
    });

    for (const integration of integrations) {
      try {
        await this.syncTransactions(integration.id);
      } catch (error) {
        console.error(`Failed to sync transactions for integration ${integration.id}:`, error);
        
        // Mark integration as having sync issues
        await prisma.integrationConfig.update({
          where: { id: integration.id },
          data: {
            config: {
              ...(integration.config as any),
              lastSyncError: error instanceof Error ? error.message : 'Unknown error',
              lastSyncErrorAt: new Date().toISOString()
            }
          }
        });
      }
    }
  }

  /**
   * Syncs transactions for a specific integration
   */
  async syncTransactions(integrationId: string, fromDate?: Date): Promise<number> {
    const integration = await prisma.integrationConfig.findUnique({
      where: { id: integrationId },
      include: { company: { include: { bankAccounts: true } } }
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const config = integration.config as any;
    const provider = this.providers.get(config.provider);
    
    if (!provider) {
      throw new Error(`Provider ${config.provider} not found`);
    }

    const accessToken = this.decryptToken(config.accessToken);
    const syncFromDate = fromDate || this.getLastSyncDate(config);
    
    let totalTransactions = 0;

    // Sync each connected account
    for (const iban of config.connectedAccounts) {
      const bankAccount = integration.company.bankAccounts.find(acc => acc.iban === iban);
      if (!bankAccount) continue;

      try {
        // Get transactions from bank
        const transactions = await provider.getTransactions(
          accessToken, 
          iban, 
          syncFromDate,
          new Date()
        );

        // Process and store transactions
        for (const transaction of transactions) {
          await this.storeTransaction(bankAccount.id, transaction);
          totalTransactions++;
        }

        // Update account balance
        const balance = await provider.getBalance(accessToken, iban);
        await prisma.bankAccount.update({
          where: { id: bankAccount.id },
          data: { balance: balance.amount }
        });

      } catch (error) {
        console.error(`Failed to sync transactions for account ${iban}:`, error);
      }
    }

    // Update last sync time
    await prisma.integrationConfig.update({
      where: { id: integrationId },
      data: {
        lastSync: new Date(),
        config: {
          ...config,
          lastSyncAt: new Date().toISOString(),
          lastTransactionCount: totalTransactions
        }
      }
    });

    return totalTransactions;
  }

  /**
   * Initiates a payment through bank integration
   */
  async initiatePayment(
    companyId: string,
    payment: PaymentInstruction
  ): Promise<string> {
    // Find the integration for the source account
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        companyId,
        iban: payment.fromIban
      },
      include: {
        company: {
          include: {
            integrationConfigs: {
              where: {
                type: 'BANK_API',
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!bankAccount) {
      throw new Error('Source bank account not found');
    }

    // Find matching integration
    const integration = bankAccount.company.integrationConfigs.find(
      integration => (integration.config as any).connectedAccounts?.includes(payment.fromIban)
    );

    if (!integration) {
      throw new Error('No active banking integration found for this account');
    }

    const config = integration.config as any;
    const provider = this.providers.get(config.provider);

    if (!provider || !provider.initiatePayment) {
      throw new Error('Payment initiation not supported by this provider');
    }

    const accessToken = this.decryptToken(config.accessToken);
    
    try {
      const paymentId = await provider.initiatePayment(accessToken, payment);
      
      // Log the payment initiation
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: 'SYSTEM', // This should be the actual user ID
          action: 'PAYMENT_INITIATED',
          entity: 'Payment',
          entityId: paymentId,
          metadata: {
            fromIban: payment.fromIban,
            toIban: payment.toIban,
            amount: payment.amount,
            reference: payment.reference
          }
        }
      });

      return paymentId;

    } catch (error) {
      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets real-time balance for all connected accounts
   */
  async getAccountBalances(companyId: string): Promise<{ iban: string; balance: number; currency: string; date: Date }[]> {
    const integrations = await prisma.integrationConfig.findMany({
      where: {
        companyId,
        type: 'BANK_API',
        isActive: true
      }
    });

    const balances: { iban: string; balance: number; currency: string; date: Date }[] = [];

    for (const integration of integrations) {
      const config = integration.config as any;
      const provider = this.providers.get(config.provider);
      
      if (!provider) continue;

      const accessToken = this.decryptToken(config.accessToken);

      for (const iban of config.connectedAccounts) {
        try {
          const balance = await provider.getBalance(accessToken, iban);
          balances.push({
            iban,
            balance: balance.amount,
            currency: balance.currency,
            date: balance.date
          });
        } catch (error) {
          console.error(`Failed to get balance for ${iban}:`, error);
        }
      }
    }

    return balances;
  }

  /**
   * Categorizes transactions automatically
   */
  private async categorizeTransaction(transaction: Transaction): Promise<string> {
    // Simple rule-based categorization
    const description = transaction.description.toLowerCase();
    
    if (description.includes('salary') || description.includes('gehalt')) return 'SALARY';
    if (description.includes('rent') || description.includes('miete')) return 'RENT';
    if (description.includes('insurance') || description.includes('versicherung')) return 'INSURANCE';
    if (description.includes('tax') || description.includes('steuer')) return 'TAX';
    if (description.includes('invoice') || description.includes('rechnung')) return 'INVOICE_PAYMENT';
    
    // Default categorization based on amount and type
    if (transaction.type === 'CREDIT') return 'INCOME';
    if (transaction.amount > 1000) return 'LARGE_EXPENSE';
    
    return 'OTHER';
  }

  /**
   * Stores transaction in database
   */
  private async storeTransaction(bankAccountId: string, transaction: Transaction): Promise<void> {
    // Check if transaction already exists
    const existing = await prisma.transaction.findFirst({
      where: {
        bankAccountId,
        reference: transaction.reference || transaction.id,
        amount: transaction.amount,
        date: transaction.date
      }
    });

    if (existing) return; // Skip duplicate

    const category = await this.categorizeTransaction(transaction);

    await prisma.transaction.create({
      data: {
        bankAccountId,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        reference: transaction.reference || transaction.id,
        type: transaction.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
        status: 'COMPLETED',
        date: transaction.date,
        valueDate: transaction.valueDate || transaction.date
      }
    });
  }

  private getLastSyncDate(config: any): Date {
    if (config.lastSyncAt) {
      return new Date(config.lastSyncAt);
    }
    
    // Default to 90 days ago for first sync
    return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }

  private encryptToken(token: string): string {
    // In production, use proper encryption
    return Buffer.from(token).toString('base64');
  }

  private decryptToken(encryptedToken: string): string {
    // In production, use proper decryption
    return Buffer.from(encryptedToken, 'base64').toString();
  }
}

/**
 * Nordigen (GoCardless) Provider - Free PSD2 provider
 */
class NordigenProvider implements BankingProvider {
  private baseUrl = 'https://ob.nordigen.com/api/v2';

  async connect(credentials: { secretId: string; secretKey: string }): Promise<string> {
    // Get access token
    const tokenResponse = await axios.post(`${this.baseUrl}/token/new/`, {
      secret_id: credentials.secretId,
      secret_key: credentials.secretKey
    });

    return tokenResponse.data.access;
  }

  async getAccounts(accessToken: string): Promise<BankAccount[]> {
    const response = await axios.get(`${this.baseUrl}/accounts/`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return response.data.results.map((account: any) => ({
      iban: account.iban,
      bic: account.bic,
      accountName: account.name || account.iban,
      accountType: account.product || 'CURRENT',
      currency: account.currency || 'EUR'
    }));
  }

  async getTransactions(accessToken: string, iban: string, fromDate?: Date, toDate?: Date): Promise<Transaction[]> {
    const params: any = {};
    if (fromDate) params.date_from = fromDate.toISOString().split('T')[0];
    if (toDate) params.date_to = toDate.toISOString().split('T')[0];

    const response = await axios.get(`${this.baseUrl}/accounts/${iban}/transactions/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params
    });

    return response.data.transactions.booked.map((tx: any) => ({
      id: tx.transactionId,
      amount: Math.abs(parseFloat(tx.transactionAmount.amount)),
      currency: tx.transactionAmount.currency,
      description: tx.remittanceInformationUnstructured || tx.additionalInformation || 'No description',
      reference: tx.endToEndId,
      date: new Date(tx.bookingDate),
      valueDate: tx.valueDate ? new Date(tx.valueDate) : undefined,
      type: parseFloat(tx.transactionAmount.amount) > 0 ? 'CREDIT' : 'DEBIT',
      counterparty: tx.creditorName ? {
        name: tx.creditorName,
        iban: tx.creditorAccount?.iban
      } : tx.debtorName ? {
        name: tx.debtorName,
        iban: tx.debtorAccount?.iban
      } : undefined
    }));
  }

  async getBalance(accessToken: string, iban: string): Promise<{ amount: number; currency: string; date: Date }> {
    const response = await axios.get(`${this.baseUrl}/accounts/${iban}/balances/`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const balance = response.data.balances[0];
    return {
      amount: parseFloat(balance.balanceAmount.amount),
      currency: balance.balanceAmount.currency,
      date: new Date(balance.referenceDate)
    };
  }
}

/**
 * Placeholder providers - would need actual implementation
 */
class SaltEdgeProvider implements BankingProvider {
  async connect(credentials: any): Promise<string> {
    throw new Error('SaltEdge provider not implemented');
  }
  
  async getAccounts(accessToken: string): Promise<BankAccount[]> {
    throw new Error('SaltEdge provider not implemented');
  }
  
  async getTransactions(accessToken: string, iban: string): Promise<Transaction[]> {
    throw new Error('SaltEdge provider not implemented');
  }
  
  async getBalance(accessToken: string, iban: string): Promise<{ amount: number; currency: string; date: Date }> {
    throw new Error('SaltEdge provider not implemented');
  }
}

class PlaidProvider implements BankingProvider {
  async connect(credentials: any): Promise<string> {
    throw new Error('Plaid provider not implemented');
  }
  
  async getAccounts(accessToken: string): Promise<BankAccount[]> {
    throw new Error('Plaid provider not implemented');
  }
  
  async getTransactions(accessToken: string, iban: string): Promise<Transaction[]> {
    throw new Error('Plaid provider not implemented');
  }
  
  async getBalance(accessToken: string, iban: string): Promise<{ amount: number; currency: string; date: Date }> {
    throw new Error('Plaid provider not implemented');
  }
}

class YapilyProvider implements BankingProvider {
  async connect(credentials: any): Promise<string> {
    throw new Error('Yapily provider not implemented');
  }
  
  async getAccounts(accessToken: string): Promise<BankAccount[]> {
    throw new Error('Yapily provider not implemented');
  }
  
  async getTransactions(accessToken: string, iban: string): Promise<Transaction[]> {
    throw new Error('Yapily provider not implemented');
  }
  
  async getBalance(accessToken: string, iban: string): Promise<{ amount: number; currency: string; date: Date }> {
    throw new Error('Yapily provider not implemented');
  }
}

export const bankingIntegrationManager = new BankingIntegrationManager();