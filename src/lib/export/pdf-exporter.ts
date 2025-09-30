import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFExportOptions {
  title: string;
  subtitle?: string;
  company?: {
    name: string;
    address?: string;
    taxId?: string;
    logo?: string;
  };
  data: any;
  type:
    | 'financial-report'
    | 'budget-report'
    | 'cashflow-report'
    | 'executive-summary';
  dateRange?: string;
  includeCharts?: boolean;
}

export class PDFExporter {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  async exportReport(options: PDFExportOptions): Promise<void> {
    this.currentY = this.margin;

    // Add header
    this.addHeader(options);

    // Add content based on type
    switch (options.type) {
      case 'financial-report':
        this.addFinancialReport(options.data);
        break;
      case 'budget-report':
        this.addBudgetReport(options.data);
        break;
      case 'cashflow-report':
        this.addCashFlowReport(options.data);
        break;
      case 'executive-summary':
        this.addExecutiveSummary(options.data);
        break;
    }

    // Add footer
    this.addFooter();

    // Save PDF
    const filename = `${options.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(filename);
  }

  private addHeader(options: PDFExportOptions): void {
    // Company Name
    if (options.company) {
      this.doc.setFontSize(10);
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(options.company.name, this.margin, this.currentY);

      if (options.company.address) {
        this.currentY += 5;
        this.doc.text(options.company.address, this.margin, this.currentY);
      }

      if (options.company.taxId) {
        this.currentY += 5;
        this.doc.text(
          `Steuernummer: ${options.company.taxId}`,
          this.margin,
          this.currentY
        );
      }

      this.currentY += 10;
    }

    // Report Title
    this.doc.setFontSize(24);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(options.title, this.margin, this.currentY);
    this.currentY += 10;

    // Subtitle
    if (options.subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(options.subtitle, this.margin, this.currentY);
      this.currentY += 8;
    }

    // Date Range
    if (options.dateRange) {
      this.doc.setFontSize(10);
      this.doc.text(
        `Zeitraum: ${options.dateRange}`,
        this.margin,
        this.currentY
      );
      this.currentY += 5;
    }

    // Generation Date
    this.doc.text(
      `Erstellt am: ${new Date().toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      this.margin,
      this.currentY
    );
    this.currentY += 15;

    // Divider
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(
      this.margin,
      this.currentY,
      this.pageWidth - this.margin,
      this.currentY
    );
    this.currentY += 10;
  }

  private addFinancialReport(data: any): void {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Finanzbericht', this.margin, this.currentY);
    this.currentY += 10;

    // KPI Summary
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Wichtige Kennzahlen', this.margin, this.currentY);
    this.currentY += 8;

    const kpiData = [
      ['Metrik', 'Wert', 'Änderung'],
      ['Aktueller Saldo', '€852,000', '+12.5%'],
      ['Umsatz (YTD)', '€2,400,000', '+18.3%'],
      ['Ausgaben (YTD)', '€1,900,000', '+8.7%'],
      ['Nettogewinn', '€485,000', '+32.1%'],
      ['Gewinnmarge', '20.2%', '+2.5pp'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [kpiData[0]],
      body: kpiData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: this.margin, right: this.margin },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private addBudgetReport(data: any[]): void {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Budget vs. Tatsächliche Kosten', this.margin, this.currentY);
    this.currentY += 10;

    const tableData = data.map(item => [
      item.category,
      this.formatCurrency(item.budget),
      this.formatCurrency(item.actual),
      this.formatCurrency(item.variance),
      `${item.variancePercent > 0 ? '+' : ''}${item.variancePercent.toFixed(1)}%`,
      item.status === 'under'
        ? '✓ Unter Budget'
        : item.status === 'on-track'
          ? '→ Im Rahmen'
          : item.status === 'over'
            ? '! Über Budget'
            : '!! Kritisch',
    ]);

    const totalBudget = data.reduce((sum, item) => sum + item.budget, 0);
    const totalActual = data.reduce((sum, item) => sum + item.actual, 0);
    const totalVariance = totalActual - totalBudget;
    const totalVariancePercent = (totalVariance / totalBudget) * 100;

    autoTable(this.doc, {
      startY: this.currentY,
      head: [
        ['Kategorie', 'Budget', 'Tatsächlich', 'Abweichung', '%', 'Status'],
      ],
      body: tableData,
      foot: [
        [
          'Gesamt',
          this.formatCurrency(totalBudget),
          this.formatCurrency(totalActual),
          this.formatCurrency(totalVariance),
          `${totalVariancePercent > 0 ? '+' : ''}${totalVariancePercent.toFixed(1)}%`,
          '',
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: {
        fillColor: [243, 244, 246],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      margin: { left: this.margin, right: this.margin },
      didDrawCell: (data: any) => {
        // Color code variance cells
        if (data.column.index === 3 && data.section === 'body') {
          const variance = parseFloat(data.cell.raw.replace(/[€,.]/g, ''));
          if (variance < 0) {
            this.doc.setTextColor(16, 185, 129); // Green
          } else {
            this.doc.setTextColor(239, 68, 68); // Red
          }
        }
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addCashFlowReport(data: any[]): void {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Cash Flow Analyse', this.margin, this.currentY);
    this.currentY += 10;

    const tableData = data
      .slice(0, 12)
      .map(item => [
        new Date(item.date).toLocaleDateString('de-DE', {
          month: 'short',
          year: 'numeric',
        }),
        this.formatCurrency(item.inflow),
        this.formatCurrency(item.outflow),
        this.formatCurrency(item.inflow - item.outflow),
        this.formatCurrency(item.balance),
      ]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Monat', 'Einnahmen', 'Ausgaben', 'Netto', 'Saldo']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: this.margin, right: this.margin },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;

    // Summary
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Zusammenfassung', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);

    const avgInflow = data.reduce((sum, d) => sum + d.inflow, 0) / data.length;
    const avgOutflow =
      data.reduce((sum, d) => sum + d.outflow, 0) / data.length;
    const finalBalance = data[data.length - 1].balance;

    this.doc.text(
      `Durchschnittliche Einnahmen: ${this.formatCurrency(avgInflow)}`,
      this.margin,
      this.currentY
    );
    this.currentY += 6;
    this.doc.text(
      `Durchschnittliche Ausgaben: ${this.formatCurrency(avgOutflow)}`,
      this.margin,
      this.currentY
    );
    this.currentY += 6;
    this.doc.text(
      `Aktueller Saldo: ${this.formatCurrency(finalBalance)}`,
      this.margin,
      this.currentY
    );
  }

  private addExecutiveSummary(data: any): void {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', this.margin, this.currentY);
    this.currentY += 10;

    // Key Highlights
    this.doc.setFontSize(12);
    this.doc.text('Wichtigste Erkenntnisse', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    const highlights = [
      '✓ Umsatz um 18.3% gegenüber Vorjahr gestiegen',
      '✓ Gewinnmarge auf 20.2% verbessert',
      '✓ Liquidität stabil bei €852k',
      '! Reisekosten 23% über Budget',
      '→ Runway: 7.9 Monate bei aktuellem Burn Rate',
    ];

    highlights.forEach(highlight => {
      this.doc.text(`  ${highlight}`, this.margin + 5, this.currentY);
      this.currentY += 6;
    });

    this.currentY += 5;

    // Recommendations
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Empfehlungen', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    const recommendations = [
      '1. Reisekosten optimieren - Potenzial für 15% Einsparung',
      '2. Wachstumstrend nutzen - Expansion in neue Märkte prüfen',
      '3. IT-Kosten konsolidieren - Software-Lizenzen überprüfen',
      '4. Runway durch zusätzliche Finanzierung auf 12 Monate erhöhen',
    ];

    recommendations.forEach(rec => {
      this.doc.text(`  ${rec}`, this.margin + 5, this.currentY);
      this.currentY += 6;
    });
  }

  private addFooter(): void {
    const footerY = this.pageHeight - 15;

    this.doc.setFontSize(8);
    this.doc.setTextColor(150, 150, 150);
    this.doc.setFont('helvetica', 'normal');

    // Left: Generated by
    this.doc.text('Erstellt mit FinTech SaaS Platform', this.margin, footerY);

    // Center: Page number
    const pageCount = this.doc.getNumberOfPages();
    this.doc.text(`Seite ${pageCount}`, this.pageWidth / 2, footerY, {
      align: 'center',
    });

    // Right: Date
    this.doc.text(
      new Date().toLocaleDateString('de-DE'),
      this.pageWidth - this.margin,
      footerY,
      { align: 'right' }
    );
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  // Export specific report types
  static async exportFinancialReport(data: any): Promise<void> {
    const exporter = new PDFExporter();
    await exporter.exportReport({
      title: 'Finanzbericht',
      subtitle: 'Umfassende Finanzübersicht',
      company: {
        name: 'VISIONEERS gGmbH',
        address: 'Berlin, Germany',
        taxId: 'DE123456789',
      },
      data,
      type: 'financial-report',
      dateRange: 'September 2025',
    });
  }

  static async exportBudgetReport(data: any[]): Promise<void> {
    const exporter = new PDFExporter();
    await exporter.exportReport({
      title: 'Budget-Analyse',
      subtitle: 'Budget vs. Tatsächliche Kosten',
      company: {
        name: 'VISIONEERS gGmbH',
        address: 'Berlin, Germany',
        taxId: 'DE123456789',
      },
      data,
      type: 'budget-report',
      dateRange: 'September 2025',
    });
  }

  static async exportCashFlowReport(data: any[]): Promise<void> {
    const exporter = new PDFExporter();
    await exporter.exportReport({
      title: 'Cash Flow Bericht',
      subtitle: '12-Monats-Übersicht',
      company: {
        name: 'VISIONEERS gGmbH',
        address: 'Berlin, Germany',
        taxId: 'DE123456789',
      },
      data,
      type: 'cashflow-report',
      dateRange: 'Letzte 12 Monate',
    });
  }

  static async exportExecutiveSummary(data: any): Promise<void> {
    const exporter = new PDFExporter();
    await exporter.exportReport({
      title: 'Executive Summary',
      subtitle: 'Management-Übersicht',
      company: {
        name: 'VISIONEERS gGmbH',
        address: 'Berlin, Germany',
        taxId: 'DE123456789',
      },
      data,
      type: 'executive-summary',
      dateRange: new Date().toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      }),
    });
  }
}

export const pdfExporter = new PDFExporter();
