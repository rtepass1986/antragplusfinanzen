/**
 * Mock OCR Service for Demo and Development
 * Provides realistic demo data when AWS services are not available
 */

import { InvoiceData, InvoiceItem } from '../aws/textract';

export class MockOCRService {
  async processDocument(file: File): Promise<{
    success: true;
    data: {
      invoiceData: InvoiceData;
      extractedFields: Array<{key: string; value: string; confidence: number}>;
      rawText: string;
      s3Url: string;
      processingTime: number;
    };
  }> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockInvoiceData: InvoiceData = {
      invoiceNumber: `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customerName: this.getRandomCustomer(),
      customerAddress: this.getRandomAddress(),
      items: this.getRandomItems(),
      subtotal: 0,
      taxRate: 19,
      taxAmount: 0,
      total: 0,
      currency: 'EUR',
      paymentTerms: 'Net 30',
      rawText: this.generateMockRawText(),
      confidence: 0.92
    };

    // Calculate totals
    invoiceData.subtotal = invoiceData.items.reduce((sum, item) => sum + item.total, 0);
    invoiceData.taxAmount = Math.round(invoiceData.subtotal * (invoiceData.taxRate! / 100) * 100) / 100;
    invoiceData.total = Math.round((invoiceData.subtotal + invoiceData.taxAmount) * 100) / 100;

    const extractedFields = [
      { key: 'invoice number', value: invoiceData.invoiceNumber!, confidence: 0.95 },
      { key: 'date', value: invoiceData.date!, confidence: 0.90 },
      { key: 'due date', value: invoiceData.dueDate!, confidence: 0.88 },
      { key: 'customer', value: invoiceData.customerName!, confidence: 0.93 },
      { key: 'total', value: invoiceData.total!.toString(), confidence: 0.96 },
      { key: 'currency', value: invoiceData.currency!, confidence: 0.99 }
    ];

    return {
      success: true,
      data: {
        invoiceData,
        extractedFields,
        rawText: invoiceData.rawText,
        s3Url: `https://demo-bucket.s3.eu-central-1.amazonaws.com/invoices/demo-${Date.now()}.pdf`,
        processingTime: 2150
      }
    };
  }

  private getRandomCustomer(): string {
    const customers = [
      'ACME Corporation GmbH',
      'TechFlow Solutions AG',
      'Digital Innovations Ltd',
      'ProServices International',
      'Modern Business Solutions',
      'Future Tech Systems GmbH',
      'Global Enterprise Co.',
      'Smart Business Partners'
    ];
    return customers[Math.floor(Math.random() * customers.length)];
  }

  private getRandomAddress(): string {
    const addresses = [
      'Hauptstraße 123\n10117 Berlin\nDeutschland',
      'Maximilianstraße 45\n80539 München\nDeutschland',
      'Königsallee 27\n40212 Düsseldorf\nDeutschland',
      'Zeil 112\n60313 Frankfurt am Main\nDeutschland',
      'Mönckebergstraße 17\n20095 Hamburg\nDeutschland'
    ];
    return addresses[Math.floor(Math.random() * addresses.length)];
  }

  private getRandomItems(): InvoiceItem[] {
    const services = [
      { description: 'Consulting Services', basePrice: 1200 },
      { description: 'Software Development', basePrice: 2500 },
      { description: 'Project Management', basePrice: 800 },
      { description: 'Technical Support', basePrice: 450 },
      { description: 'System Integration', basePrice: 1800 },
      { description: 'Data Analysis', basePrice: 950 },
      { description: 'Cloud Migration', basePrice: 3200 },
      { description: 'Security Audit', basePrice: 1500 }
    ];

    const itemCount = Math.floor(Math.random() * 4) + 1;
    const items: InvoiceItem[] = [];
    
    for (let i = 0; i < itemCount; i++) {
      const service = services[Math.floor(Math.random() * services.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = service.basePrice + (Math.random() * 500 - 250); // ±250 variation
      const total = Math.round(quantity * unitPrice * 100) / 100;

      items.push({
        description: service.description,
        quantity,
        unitPrice: Math.round(unitPrice * 100) / 100,
        total
      });
    }

    return items;
  }

  private generateMockRawText(): string {
    return `RECHNUNG / INVOICE

Rechnungsnummer: INV-2024-001
Datum: ${new Date().toLocaleDateString('de-DE')}
Fälligkeitsdatum: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}

An:
ACME Corporation GmbH
Hauptstraße 123
10117 Berlin
Deutschland

Leistungsbeschreibung:
- Consulting Services: 1x 1,200.00 EUR
- Technical Support: 2x 450.00 EUR

Zwischensumme: 2,100.00 EUR
MwSt. (19%): 399.00 EUR
Gesamtbetrag: 2,499.00 EUR

Zahlungsbedingungen: Netto 30 Tage
Währung: EUR

Vielen Dank für Ihr Vertrauen!`;
  }
}

export const mockOCRService = new MockOCRService();