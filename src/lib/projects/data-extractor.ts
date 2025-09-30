interface ProjectData {
  name?: string;
  code?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  totalBudget?: number;
  currency?: string;
  grantGiverName?: string;
  grantGiverContact?: string;
  grantGiverEmail?: string;
  grantGiverPhone?: string;
  grantGiverAddress?: string;
  grantReference?: string;
  grantAgreementUrl?: string;
  reportingFrequency?: string;
  reportingTemplate?: string;
  projectManager?: string;
  teamMembers?: string[];
  categories?: string[];
  milestones?: any[];
  deliverables?: any[];
  budgetBreakdown?: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  risks?: Array<{
    description: string;
    impact: 'low' | 'medium' | 'high';
    probability: 'low' | 'medium' | 'high';
  }>;
  confidence?: number;
  processingNotes?: string;
}

interface GrantTemplate {
  id: string;
  name: string;
  patterns: {
    name?: string[];
    reference?: string[];
    email?: string[];
    phone?: string[];
    address?: string[];
  };
  defaults: Partial<ProjectData>;
}

export class ProjectDataExtractor {
  private aiProcessor: any;
  private useAI: boolean = false;

  constructor() {
    // AI processor is now called via API endpoint from the client
    // This class only provides fallback/basic extraction
    this.useAI = false;
  }

  private grantTemplates: GrantTemplate[] = [
    {
      id: 'bmwk',
      name: 'Bundesministerium für Wirtschaft und Klimaschutz',
      patterns: {
        name: [
          'BMWK',
          'Bundesministerium für Wirtschaft',
          'Wirtschaftsministerium',
        ],
        reference: ['BMWK-', 'BMWi-', 'Wirtschaft-'],
        email: ['@bmwk.bund.de', '@bmwi.bund.de'],
        phone: ['030', '+49 30'],
        address: ['Scharnhorststraße', 'Berlin'],
      },
      defaults: {
        grantGiverName: 'Bundesministerium für Wirtschaft und Klimaschutz',
        grantGiverEmail: 'info@bmwk.bund.de',
        grantGiverPhone: '+49 30 18615-0',
        grantGiverAddress: 'Scharnhorststraße 34-37, 10115 Berlin',
        reportingFrequency: 'MONTHLY',
        reportingTemplate: 'BMWK Standard Report',
        currency: 'EUR',
      },
    },
    {
      id: 'eu-horizon',
      name: 'EU Horizon Europe',
      patterns: {
        name: ['Horizon Europe', 'EU Horizon', 'European Commission'],
        reference: ['HORIZON-', 'EU-', 'GA-'],
        email: ['@horizon-europe.eu', '@ec.europa.eu'],
        address: ['Brussels', 'Belgium'],
      },
      defaults: {
        grantGiverName: 'European Commission - Horizon Europe',
        grantGiverEmail: 'support@horizon-europe.eu',
        grantGiverPhone: '+32 2 299 11 11',
        grantGiverAddress: 'Rue de la Loi 200, 1049 Brussels, Belgium',
        reportingFrequency: 'QUARTERLY',
        reportingTemplate: 'Horizon Europe Progress Report',
        currency: 'EUR',
      },
    },
    {
      id: 'dfg',
      name: 'Deutsche Forschungsgemeinschaft',
      patterns: {
        name: ['DFG', 'Deutsche Forschungsgemeinschaft'],
        reference: ['DFG-', 'SFB-', 'TRR-'],
        email: ['@dfg.de'],
        address: ['Bonn', 'Kennedyallee'],
      },
      defaults: {
        grantGiverName: 'Deutsche Forschungsgemeinschaft',
        grantGiverEmail: 'info@dfg.de',
        grantGiverPhone: '+49 228 885-1',
        grantGiverAddress: 'Kennedyallee 40, 53175 Bonn',
        reportingFrequency: 'BIANNUALLY',
        reportingTemplate: 'DFG Progress Report',
        currency: 'EUR',
      },
    },
    {
      id: 'bmbf',
      name: 'Bundesministerium für Bildung und Forschung',
      patterns: {
        name: ['BMBF', 'Bundesministerium für Bildung', 'Bildungsministerium'],
        reference: ['BMBF-', 'Bildung-'],
        email: ['@bmbf.bund.de'],
        address: ['Kapelle-Ufer', 'Berlin'],
      },
      defaults: {
        grantGiverName: 'Bundesministerium für Bildung und Forschung',
        grantGiverEmail: 'info@bmbf.bund.de',
        grantGiverPhone: '+49 30 1857-0',
        grantGiverAddress: 'Kapelle-Ufer 1, 10117 Berlin',
        reportingFrequency: 'MONTHLY',
        reportingTemplate: 'BMBF Project Report',
        currency: 'EUR',
      },
    },
  ];

  private commonCategories = [
    'Software',
    'Hardware',
    'Personalkosten',
    'Beratung',
    'Schulungen',
    'Forschung',
    'Entwicklung',
    'Innovation',
    'Ausstattung',
    'Reisen',
    'Energieeffizienz',
    'Abfallmanagement',
    'Veranstaltungen',
    'Marketing',
  ];

  async extractFromFile(file: File): Promise<ProjectData> {
    if (this.useAI && this.aiProcessor) {
      try {
        // Use AI-powered extraction
        const result = await this.aiProcessor.processDocument(file);
        return {
          ...result.projectInformation,
          confidence: result.confidence,
          processingNotes: `AI-processed (${result.classification.type}, confidence: ${result.confidence})`,
        };
      } catch (error) {
        console.error(
          'AI processing failed, falling back to regex extraction:',
          error
        );
      }
    }

    // Fallback to regex-based extraction
    const fileType = this.getFileType(file);
    const text = await this.extractText(file, fileType);

    const extractedData = await this.parseText(text, file.name);

    // Apply grant template if detected
    const grantTemplate = this.detectGrantTemplate(text);
    if (grantTemplate) {
      Object.assign(extractedData, grantTemplate.defaults);
    }

    return {
      ...extractedData,
      confidence: 0.6, // Lower confidence for regex-based extraction
      processingNotes: 'Regex-based extraction',
    };
  }

  async extractFromMultipleFiles(files: File[]): Promise<ProjectData> {
    if (this.useAI && this.aiProcessor) {
      try {
        // Use AI-powered multi-document processing
        const results = await this.aiProcessor.processMultipleDocuments(files);
        const consolidatedData =
          await this.aiProcessor.consolidateProjectData(results);

        return {
          ...consolidatedData,
          confidence:
            results.reduce((acc, r) => acc + r.confidence, 0) / results.length,
          processingNotes: `AI-processed ${files.length} documents`,
        };
      } catch (error) {
        console.error(
          'AI multi-document processing failed, falling back to single file processing:',
          error
        );
      }
    }

    // Fallback: process files individually and merge
    const results = await Promise.all(
      files.map(file => this.extractFromFile(file))
    );
    return this.mergeProjectData(results);
  }

  private getFileType(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'docx':
      case 'doc':
        return 'word';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'txt':
        return 'text';
      case 'json':
        return 'json';
      default:
        return 'unknown';
    }
  }

  private async extractText(file: File, fileType: string): Promise<string> {
    switch (fileType) {
      case 'text':
        return await file.text();

      case 'json':
        const jsonContent = await file.text();
        return JSON.stringify(JSON.parse(jsonContent), null, 2);

      case 'pdf':
        // In a real implementation, you would use a PDF parsing library like pdf-parse
        return this.simulatePdfExtraction(file.name);

      case 'word':
        // In a real implementation, you would use a library like mammoth
        return this.simulateWordExtraction(file.name);

      case 'excel':
        // In a real implementation, you would use a library like xlsx
        return this.simulateExcelExtraction(file.name);

      default:
        return file.name;
    }
  }

  private async parseText(
    text: string,
    fileName: string
  ): Promise<ProjectData> {
    const data: ProjectData = {};

    // Extract project name
    data.name = this.extractProjectName(text, fileName);

    // Extract project code
    data.code = this.extractProjectCode(text);

    // Extract description
    data.description = this.extractDescription(text);

    // Extract dates
    const dates = this.extractDates(text);
    if (dates.start) data.startDate = dates.start;
    if (dates.end) data.endDate = dates.end;

    // Extract budget
    const budget = this.extractBudget(text);
    if (budget.amount) data.totalBudget = budget.amount;
    if (budget.currency) data.currency = budget.currency;

    // Extract grant information
    data.grantGiverName = this.extractGrantGiverName(text);
    data.grantReference = this.extractGrantReference(text);
    data.grantGiverEmail = this.extractEmail(text);
    data.grantGiverPhone = this.extractPhone(text);
    data.grantGiverAddress = this.extractAddress(text);

    // Extract categories
    data.categories = this.extractCategories(text);

    // Extract milestones
    data.milestones = this.extractMilestones(text);

    // Extract deliverables
    data.deliverables = this.extractDeliverables(text);

    // Extract team information
    data.projectManager = this.extractProjectManager(text);
    data.teamMembers = this.extractTeamMembers(text);

    return data;
  }

  private extractProjectName(text: string, fileName: string): string {
    // Try to extract from common patterns
    const patterns = [
      /Projekt[:\s]+(.+?)(?:\n|$)/i,
      /Titel[:\s]+(.+?)(?:\n|$)/i,
      /Name[:\s]+(.+?)(?:\n|$)/i,
      /Projektname[:\s]+(.+?)(?:\n|$)/i,
      /"(.+?)"/,
      /'(.+?)'/,
      /^(.+?)(?:\s*-\s*Projekt|\s*-\s*Initiative|\s*-\s*Programm)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 3) {
        return match[1].trim();
      }
    }

    // Fallback to filename
    return fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }

  private extractProjectCode(text: string): string | undefined {
    const patterns = [
      /Projektcode[:\s]+([A-Z0-9-]+)/i,
      /Code[:\s]+([A-Z0-9-]+)/i,
      /Referenz[:\s]+([A-Z0-9-]+)/i,
      /Kennung[:\s]+([A-Z0-9-]+)/i,
      /([A-Z]{2,}-[0-9]{4}-[0-9]{3})/,
      /([A-Z]{3,}-[0-9]{4})/,
      /([A-Z]{2,}-[0-9]{3,})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractDescription(text: string): string | undefined {
    const patterns = [
      /Beschreibung[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Zusammenfassung[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Abstract[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Ziel[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Hintergrund[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractDates(text: string): { start?: string; end?: string } {
    const result: { start?: string; end?: string } = {};

    // Date patterns
    const datePatterns = [
      /(\d{1,2})[./](\d{1,2})[./](\d{4})/g,
      /(\d{4})[./](\d{1,2})[./](\d{1,2})/g,
      /(\d{1,2})\s+(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\w*\s+(\d{4})/gi,
    ];

    const dates: string[] = [];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        dates.push(match[0]);
      }
    }

    // Look for start/end indicators
    const startPatterns = [
      /Start[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
      /Beginn[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
      /Von[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    ];

    const endPatterns = [
      /Ende[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
      /Bis[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
      /Abschluss[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    ];

    for (const pattern of startPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.start = this.normalizeDate(match[1]);
        break;
      }
    }

    for (const pattern of endPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.end = this.normalizeDate(match[1]);
        break;
      }
    }

    return result;
  }

  private extractBudget(text: string): { amount?: number; currency?: string } {
    const result: { amount?: number; currency?: string } = {};

    // Budget patterns
    const patterns = [
      /Budget[:\s]+([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/i,
      /Gesamtkosten[:\s]+([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/i,
      /Kosten[:\s]+([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/i,
      /Betrag[:\s]+([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/i,
      /([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/g,
    ];

    let maxAmount = 0;
    let currency = 'EUR';

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amountStr = match[1].replace(/[.,\s]/g, '');
        const amount = parseInt(amountStr);

        if (amount > maxAmount && amount > 1000) {
          // Reasonable budget threshold
          maxAmount = amount;
          currency = match[2] || 'EUR';
        }
      }
    }

    if (maxAmount > 0) {
      result.amount = maxAmount;
      result.currency = currency;
    }

    return result;
  }

  private extractGrantGiverName(text: string): string | undefined {
    const patterns = [
      /Fördergeber[:\s]+(.+?)(?:\n|$)/i,
      /Antragsteller[:\s]+(.+?)(?:\n|$)/i,
      /Finanzierung[:\s]+(.+?)(?:\n|$)/i,
      /Auftraggeber[:\s]+(.+?)(?:\n|$)/i,
      /Sponsor[:\s]+(.+?)(?:\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 3) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractGrantReference(text: string): string | undefined {
    const patterns = [
      /Förderkennzeichen[:\s]+([A-Z0-9-]+)/i,
      /Referenz[:\s]+([A-Z0-9-]+)/i,
      /Antragsnummer[:\s]+([A-Z0-9-]+)/i,
      /Vertragsnummer[:\s]+([A-Z0-9-]+)/i,
      /([A-Z]{2,}-[0-9]{4}-[0-9]{3})/,
      /([A-Z]{3,}-[0-9]{4})/,
      /([A-Z]{2,}-[0-9]{3,})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractEmail(text: string): string | undefined {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailPattern);
    return matches ? matches[0] : undefined;
  }

  private extractPhone(text: string): string | undefined {
    const patterns = [
      /(\+49\s*\d{2,4}\s*\d{3,4}\s*\d{3,4})/,
      /(0\d{2,4}\s*\d{3,4}\s*\d{3,4})/,
      /(\+\d{1,3}\s*\d{2,4}\s*\d{3,4}\s*\d{3,4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractAddress(text: string): string | undefined {
    const patterns = [
      /Adresse[:\s]+(.+?)(?:\n|$)/i,
      /Anschrift[:\s]+(.+?)(?:\n|$)/i,
      /([A-Za-zäöüß\s]+\s+\d+,\s*\d+\s+[A-Za-zäöüß\s]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 10) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractCategories(text: string): string[] {
    const foundCategories: string[] = [];

    for (const category of this.commonCategories) {
      if (text.toLowerCase().includes(category.toLowerCase())) {
        foundCategories.push(category);
      }
    }

    return foundCategories.length > 0 ? foundCategories : ['Allgemein'];
  }

  private extractMilestones(text: string): any[] {
    const milestones: any[] = [];

    // Look for milestone patterns
    const patterns = [
      /Meilenstein[:\s]+(.+?)(?:\s*-\s*)(\d{1,2}[./]\d{1,2}[./]\d{4})/gi,
      /Phase[:\s]+(.+?)(?:\s*-\s*)(\d{1,2}[./]\d{1,2}[./]\d{4})/gi,
      /Termin[:\s]+(.+?)(?:\s*-\s*)(\d{1,2}[./]\d{1,2}[./]\d{4})/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        milestones.push({
          name: match[1].trim(),
          date: this.normalizeDate(match[2]),
          status: 'pending',
        });
      }
    }

    return milestones;
  }

  private extractDeliverables(text: string): any[] {
    const deliverables: any[] = [];

    // Look for deliverable patterns
    const patterns = [
      /Liefergegenstand[:\s]+(.+?)(?:\s*-\s*)(\d{1,2}[./]\d{1,2}[./]\d{4})/gi,
      /Ergebnis[:\s]+(.+?)(?:\s*-\s*)(\d{1,2}[./]\d{1,2}[./]\d{4})/gi,
      /Produkt[:\s]+(.+?)(?:\s*-\s*)(\d{1,2}[./]\d{1,2}[./]\d{4})/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        deliverables.push({
          name: match[1].trim(),
          dueDate: this.normalizeDate(match[2]),
          status: 'pending',
        });
      }
    }

    return deliverables;
  }

  private extractProjectManager(text: string): string | undefined {
    const patterns = [
      /Projektleiter[:\s]+(.+?)(?:\n|$)/i,
      /Projektmanager[:\s]+(.+?)(?:\n|$)/i,
      /Leitung[:\s]+(.+?)(?:\n|$)/i,
      /Verantwortlich[:\s]+(.+?)(?:\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractTeamMembers(text: string): string[] {
    const members: string[] = [];

    // Look for team member patterns
    const patterns = [
      /Team[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Mitarbeiter[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Beteiligte[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const memberList = match[1]
          .split(/[,;]/)
          .map(member => member.trim())
          .filter(member => member.length > 2);

        members.push(...memberList);
      }
    }

    return members;
  }

  private detectGrantTemplate(text: string): GrantTemplate | undefined {
    for (const template of this.grantTemplates) {
      for (const [field, patterns] of Object.entries(template.patterns)) {
        if (patterns) {
          for (const pattern of patterns) {
            if (text.includes(pattern)) {
              return template;
            }
          }
        }
      }
    }

    return undefined;
  }

  private normalizeDate(dateStr: string): string {
    // Convert various date formats to YYYY-MM-DD
    const cleanDate = dateStr.replace(/[./]/g, '-');
    const parts = cleanDate.split('-');

    if (parts.length === 3) {
      // Handle DD-MM-YYYY or MM-DD-YYYY
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return cleanDate;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    return dateStr;
  }

  // Simulation methods for different file types
  private simulatePdfExtraction(fileName: string): string {
    // This would use a real PDF parsing library in production
    if (fileName.toLowerCase().includes('digitalisierung')) {
      return `
        Projekt: Digitalisierung Initiative 2024
        Projektcode: DIGI-2024

        Beschreibung:
        Umfassende Digitalisierung der Geschäftsprozesse mit Fokus auf Automatisierung und Effizienzsteigerung.

        Zeitraum: 01.01.2024 - 31.12.2024
        Budget: 50.000 €

        Fördergeber: Bundesministerium für Wirtschaft und Klimaschutz
        Referenz: BMWK-2024-001

        Meilensteine:
        - Projektstart: 01.01.2024
        - Anforderungsanalyse: 15.02.2024
        - Systemauswahl: 31.03.2024

        Kategorien: Software, Hardware, Schulungen
      `;
    }

    return fileName;
  }

  private simulateWordExtraction(fileName: string): string {
    // This would use mammoth.js or similar in production
    return this.simulatePdfExtraction(fileName);
  }

  private simulateExcelExtraction(fileName: string): string {
    // This would use xlsx library in production
    return `
      Projektname: ${fileName.replace(/\.[^/.]+$/, '')}
      Budget: 25.000 €
      Startdatum: 01.02.2024
      Enddatum: 31.08.2024
    `;
  }

  private mergeProjectData(results: ProjectData[]): ProjectData {
    const merged: ProjectData = {};

    // Merge all non-null values, prioritizing higher confidence extractions
    const sortedResults = results.sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );

    sortedResults.forEach(result => {
      if (result.name && !merged.name) merged.name = result.name;
      if (result.code && !merged.code) merged.code = result.code;
      if (result.description && !merged.description)
        merged.description = result.description;
      if (result.startDate && !merged.startDate)
        merged.startDate = result.startDate;
      if (result.endDate && !merged.endDate) merged.endDate = result.endDate;
      if (result.totalBudget && !merged.totalBudget)
        merged.totalBudget = result.totalBudget;
      if (result.currency && !merged.currency)
        merged.currency = result.currency;
      if (result.grantGiverName && !merged.grantGiverName)
        merged.grantGiverName = result.grantGiverName;
      if (result.grantGiverContact && !merged.grantGiverContact)
        merged.grantGiverContact = result.grantGiverContact;
      if (result.grantGiverEmail && !merged.grantGiverEmail)
        merged.grantGiverEmail = result.grantGiverEmail;
      if (result.grantGiverPhone && !merged.grantGiverPhone)
        merged.grantGiverPhone = result.grantGiverPhone;
      if (result.grantGiverAddress && !merged.grantGiverAddress)
        merged.grantGiverAddress = result.grantGiverAddress;
      if (result.grantReference && !merged.grantReference)
        merged.grantReference = result.grantReference;
      if (result.reportingFrequency && !merged.reportingFrequency)
        merged.reportingFrequency = result.reportingFrequency;
      if (result.projectManager && !merged.projectManager)
        merged.projectManager = result.projectManager;
      if (result.teamMembers && !merged.teamMembers)
        merged.teamMembers = result.teamMembers;
      if (result.categories && !merged.categories)
        merged.categories = result.categories;
      if (result.milestones && !merged.milestones)
        merged.milestones = result.milestones;
      if (result.deliverables && !merged.deliverables)
        merged.deliverables = result.deliverables;
      if (result.budgetBreakdown && !merged.budgetBreakdown)
        merged.budgetBreakdown = result.budgetBreakdown;
      if (result.risks && !merged.risks) merged.risks = result.risks;
    });

    // Calculate average confidence
    const totalConfidence = results.reduce(
      (sum, r) => sum + (r.confidence || 0),
      0
    );
    merged.confidence = totalConfidence / results.length;

    // Combine processing notes
    const notes = results.map(r => r.processingNotes).filter(Boolean);
    merged.processingNotes = notes.join('; ');

    return merged;
  }

  async analyzeDocumentQuality(file: File): Promise<{
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    recommendations: string[];
  }> {
    const fileType = this.getFileType(file);
    const text = await this.extractText(file, fileType);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check file size
    if (file.size > 10 * 1024 * 1024) {
      // 10MB
      issues.push('File size is very large');
      recommendations.push(
        'Consider compressing the file or splitting into smaller documents'
      );
    }

    // Check text length
    if (text.length < 100) {
      issues.push('Document contains very little text');
      recommendations.push(
        'Ensure the document contains sufficient project information'
      );
    }

    // Check for key project information
    const hasProjectName = /projekt|project|titel|title/i.test(text);
    const hasBudget = /budget|kosten|cost|€|\$/i.test(text);
    const hasDates = /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(text);
    const hasDescription = text.length > 200;

    if (!hasProjectName) {
      issues.push('No clear project name identified');
      recommendations.push('Include a clear project title or name');
    }

    if (!hasBudget) {
      issues.push('No budget information found');
      recommendations.push('Include budget details or financial information');
    }

    if (!hasDates) {
      issues.push('No dates found');
      recommendations.push('Include project start and end dates');
    }

    if (!hasDescription) {
      issues.push('Limited project description');
      recommendations.push('Provide a detailed project description');
    }

    // Determine overall quality
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (issues.length === 0) {
      quality = 'excellent';
    } else if (issues.length <= 2) {
      quality = 'good';
    } else if (issues.length <= 4) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    return { quality, issues, recommendations };
  }
}

export const projectDataExtractor = new ProjectDataExtractor();
