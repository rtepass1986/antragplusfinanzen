export interface Invoice {
  id: string;
  filename: string;
  originalFile: string;
  extractedData: {
    vendor: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    taxAmount: number;
    subtotal: number;
    currency: string;
    lineItems: LineItem[];
    vendorAddress?: string;
    vendorTaxId?: string;
    paymentTerms?: string;
  };
  status: 'processing' | 'reviewed' | 'approved' | 'paid' | 'archived';
  category: string;
  project?: string;
  bankAccount?: string;
  processedAt: string;
  reviewedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
  tags: string[];
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  project?: string;
}

class InvoiceStorage {
  private invoices: Invoice[] = [];
  private nextId = 1;

  // Add new invoice
  addInvoice(invoice: Omit<Invoice, 'id' | 'processedAt'>): Invoice {
    const newInvoice: Invoice = {
      ...invoice,
      id: `inv_${this.nextId++}`,
      processedAt: new Date().toISOString(),
    };
    this.invoices.push(newInvoice);
    this.saveToLocalStorage();
    return newInvoice;
  }

  // Update invoice
  updateInvoice(id: string, updates: Partial<Invoice>): Invoice | null {
    const index = this.invoices.findIndex(inv => inv.id === id);
    if (index === -1) return null;

    const updatedInvoice = { ...this.invoices[index], ...updates };
    this.invoices[index] = updatedInvoice;
    this.saveToLocalStorage();
    return updatedInvoice;
  }

  // Get invoice by ID
  getInvoice(id: string): Invoice | null {
    return this.invoices.find(inv => inv.id === id) || null;
  }

  // Get all invoices
  getAllInvoices(): Invoice[] {
    return [...this.invoices];
  }

  // Get invoices by status
  getInvoicesByStatus(status: Invoice['status']): Invoice[] {
    return this.invoices.filter(inv => inv.status === status);
  }

  // Get invoices by category
  getInvoicesByCategory(category: string): Invoice[] {
    return this.invoices.filter(inv => inv.category === category);
  }

  // Get invoices by project
  getInvoicesByProject(project: string): Invoice[] {
    return this.invoices.filter(inv => inv.project === project);
  }

  // Get processing invoices (for OCR review)
  getProcessingInvoices(): Invoice[] {
    return this.invoices.filter(inv => inv.status === 'processing');
  }

  // Get approved invoices (for payment)
  getApprovedInvoices(): Invoice[] {
    return this.invoices.filter(inv => inv.status === 'approved');
  }

  // Get paid invoices (for reporting)
  getPaidInvoices(): Invoice[] {
    return this.invoices.filter(inv => inv.status === 'paid');
  }

  // Get statistics
  getStats() {
    const total = this.invoices.length;
    const totalAmount = this.invoices.reduce(
      (sum, inv) => sum + inv.extractedData.totalAmount,
      0
    );
    const processing = this.invoices.filter(
      inv => inv.status === 'processing'
    ).length;
    const approved = this.invoices.filter(
      inv => inv.status === 'approved'
    ).length;
    const paid = this.invoices.filter(inv => inv.status === 'paid').length;
    const outstanding = this.invoices.filter(
      inv => inv.status === 'approved'
    ).length;

    return {
      total,
      totalAmount,
      processing,
      approved,
      paid,
      outstanding,
    };
  }

  // Get cash flow data
  getCashFlowData() {
    const monthlyData = new Map<
      string,
      { income: number; expenses: number; net: number }
    >();

    this.invoices.forEach(invoice => {
      const month = new Date(invoice.extractedData.invoiceDate)
        .toISOString()
        .slice(0, 7);
      const current = monthlyData.get(month) || {
        income: 0,
        expenses: 0,
        net: 0,
      };

      if (invoice.status === 'paid') {
        current.expenses += invoice.extractedData.totalAmount;
        current.net -= invoice.extractedData.totalAmount;
      }

      monthlyData.set(month, current);
    });

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      ...data,
    }));
  }

  // Get category breakdown
  getCategoryBreakdown() {
    const breakdown = new Map<string, { count: number; totalAmount: number }>();

    this.invoices.forEach(invoice => {
      const category = invoice.category || 'Uncategorized';
      const current = breakdown.get(category) || { count: 0, totalAmount: 0 };

      current.count++;
      current.totalAmount += invoice.extractedData.totalAmount;

      breakdown.set(category, current);
    });

    return Array.from(breakdown.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));
  }

  // Search invoices
  searchInvoices(query: string): Invoice[] {
    const lowercaseQuery = query.toLowerCase();
    return this.invoices.filter(
      invoice =>
        invoice.extractedData.vendor.toLowerCase().includes(lowercaseQuery) ||
        invoice.extractedData.invoiceNumber
          .toLowerCase()
          .includes(lowercaseQuery) ||
        invoice.filename.toLowerCase().includes(lowercaseQuery) ||
        invoice.category.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Delete invoice
  deleteInvoice(id: string): boolean {
    const index = this.invoices.findIndex(inv => inv.id === id);
    if (index === -1) return false;

    this.invoices.splice(index, 1);
    this.saveToLocalStorage();
    return true;
  }

  // Bulk operations
  bulkUpdateStatus(ids: string[], status: Invoice['status']): number {
    let updated = 0;
    ids.forEach(id => {
      if (this.updateInvoice(id, { status })) {
        updated++;
      }
    });
    return updated;
  }

  // Export data
  exportData(): string {
    return JSON.stringify(this.invoices, null, 2);
  }

  // Import data
  importData(data: string): boolean {
    try {
      const invoices = JSON.parse(data);
      if (Array.isArray(invoices)) {
        this.invoices = invoices;
        this.saveToLocalStorage();
        return true;
      }
    } catch (error) {
      console.error('Failed to import data:', error);
    }
    return false;
  }

  // Clear all data
  clearAll(): void {
    this.invoices = [];
    this.nextId = 1;
    this.saveToLocalStorage();
  }

  private saveToLocalStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('invoices', JSON.stringify(this.invoices));
      localStorage.setItem('nextInvoiceId', this.nextId.toString());
    }
  }

  private loadFromLocalStorage(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('invoices');
      const nextId = localStorage.getItem('nextInvoiceId');

      if (stored) {
        this.invoices = JSON.parse(stored);
      }

      if (nextId) {
        this.nextId = parseInt(nextId, 10);
      }
    }
  }

  constructor() {
    this.loadFromLocalStorage();
  }
}

export const invoiceStorage = new InvoiceStorage();
