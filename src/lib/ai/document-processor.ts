interface DocumentMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  mimeType: string;
}

interface DocumentContent {
  text: string;
  structuredData?: any;
  images?: string[];
  tables?: Array<{
    headers: string[];
    rows: string[][];
  }>;
}

interface DocumentClassification {
  type:
    | 'project_proposal'
    | 'budget_plan'
    | 'contract'
    | 'report'
    | 'invoice'
    | 'other';
  confidence: number;
  reasoning: string;
  suggestedFields: string[];
}

interface ProjectInformation {
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
  reportingFrequency?: string;
  projectManager?: string;
  teamMembers?: string[];
  categories?: string[];
  milestones?: Array<{
    name: string;
    date: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  deliverables?: Array<{
    name: string;
    dueDate: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
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
}

interface ProcessingResult {
  documentId: string;
  metadata: DocumentMetadata;
  classification: DocumentClassification;
  extractedContent: DocumentContent;
  projectInformation: ProjectInformation;
  confidence: number;
  processingTime: number;
  errors?: string[];
}

export class AIDocumentProcessor {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  async processDocument(file: File): Promise<ProcessingResult> {
    const startTime = Date.now();
    const documentId = this.generateDocumentId();

    try {
      // Extract metadata
      const metadata = this.extractMetadata(file);

      // Extract content based on file type
      const extractedContent = await this.extractContent(file);

      // Classify document type
      const classification = await this.classifyDocument(
        extractedContent,
        metadata
      );

      // Extract project information using AI
      const projectInformation = await this.extractProjectInformation(
        extractedContent,
        classification
      );

      // Calculate overall confidence
      const confidence = this.calculateConfidence(
        classification,
        projectInformation
      );

      const processingTime = Date.now() - startTime;

      return {
        documentId,
        metadata,
        classification,
        extractedContent,
        projectInformation,
        confidence,
        processingTime,
      };
    } catch (error) {
      console.error('Error processing document:', error);
      return {
        documentId,
        metadata: this.extractMetadata(file),
        classification: {
          type: 'other',
          confidence: 0,
          reasoning: 'Processing failed',
          suggestedFields: [],
        },
        extractedContent: { text: '' },
        projectInformation: {},
        confidence: 0,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async processMultipleDocuments(files: File[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    // Process documents in parallel for better performance
    const processingPromises = files.map(file => this.processDocument(file));
    const processingResults = await Promise.allSettled(processingPromises);

    processingResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(
          `Failed to process file ${files[index].name}:`,
          result.reason
        );
        // Create error result
        results.push({
          documentId: this.generateDocumentId(),
          metadata: this.extractMetadata(files[index]),
          classification: {
            type: 'other',
            confidence: 0,
            reasoning: 'Processing failed',
            suggestedFields: [],
          },
          extractedContent: { text: '' },
          projectInformation: {},
          confidence: 0,
          processingTime: 0,
          errors: [
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error',
          ],
        });
      }
    });

    return results;
  }

  async consolidateProjectData(
    results: ProcessingResult[]
  ): Promise<ProjectInformation> {
    try {
      const prompt = this.buildConsolidationPrompt(results);
      const response = await this.callOpenAI(prompt);
      return this.parseConsolidationResponse(response);
    } catch (error) {
      console.error('Error consolidating project data:', error);
      return this.mergeProjectData(results);
    }
  }

  private extractMetadata(file: File): DocumentMetadata {
    return {
      fileName: file.name,
      fileType: this.getFileExtension(file.name),
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      mimeType: file.type,
    };
  }

  private async extractContent(file: File): Promise<DocumentContent> {
    const fileType = this.getFileExtension(file.name).toLowerCase();

    switch (fileType) {
      case 'pdf':
        return await this.extractPdfContent(file);
      case 'docx':
      case 'doc':
        return await this.extractWordContent(file);
      case 'xlsx':
      case 'xls':
        return await this.extractExcelContent(file);
      case 'txt':
        return await this.extractTextContent(file);
      case 'json':
        return await this.extractJsonContent(file);
      case 'png':
      case 'jpg':
      case 'jpeg':
        return await this.extractImageContent(file);
      default:
        return { text: file.name };
    }
  }

  private async extractPdfContent(file: File): Promise<DocumentContent> {
    // In production, use a PDF parsing library like pdf-parse or pdf2pic
    // For now, simulate extraction
    const text = await this.simulatePdfExtraction(file.name);
    return { text };
  }

  private async extractWordContent(file: File): Promise<DocumentContent> {
    // In production, use mammoth.js
    const text = await this.simulateWordExtraction(file.name);
    return { text };
  }

  private async extractExcelContent(file: File): Promise<DocumentContent> {
    // In production, use xlsx library
    const text = await this.simulateExcelExtraction(file.name);
    const tables = this.extractTablesFromText(text);
    return { text, tables };
  }

  private async extractTextContent(file: File): Promise<DocumentContent> {
    const text = await file.text();
    return { text };
  }

  private async extractJsonContent(file: File): Promise<DocumentContent> {
    const text = await file.text();
    try {
      const structuredData = JSON.parse(text);
      return { text, structuredData };
    } catch {
      return { text };
    }
  }

  private async extractImageContent(file: File): Promise<DocumentContent> {
    // In production, use OCR services like Tesseract.js or cloud OCR APIs
    const text = await this.simulateImageExtraction(file.name);
    return { text, images: [file.name] };
  }

  private async classifyDocument(
    content: DocumentContent,
    metadata: DocumentMetadata
  ): Promise<DocumentClassification> {
    try {
      const prompt = this.buildClassificationPrompt(content, metadata);
      const response = await this.callOpenAI(prompt);
      return this.parseClassificationResponse(response);
    } catch (error) {
      console.error('Error classifying document:', error);
      return {
        type: 'other',
        confidence: 0.5,
        reasoning: 'Classification failed',
        suggestedFields: ['name', 'description'],
      };
    }
  }

  private async extractProjectInformation(
    content: DocumentContent,
    classification: DocumentClassification
  ): Promise<ProjectInformation> {
    try {
      const prompt = this.buildExtractionPrompt(content, classification);
      const response = await this.callOpenAI(prompt);
      return this.parseExtractionResponse(response);
    } catch (error) {
      console.error('Error extracting project information:', error);
      return this.extractBasicInformation(content.text);
    }
  }

  private buildClassificationPrompt(
    content: DocumentContent,
    metadata: DocumentMetadata
  ): string {
    return `
Analyze this document and classify its type for project management purposes.

DOCUMENT METADATA:
- File Name: ${metadata.fileName}
- File Type: ${metadata.fileType}
- File Size: ${metadata.fileSize} bytes

DOCUMENT CONTENT:
${content.text.substring(0, 2000)}${content.text.length > 2000 ? '...' : ''}

${content.tables ? `TABLES FOUND: ${content.tables.length} tables` : ''}
${content.images ? `IMAGES FOUND: ${content.images.length} images` : ''}

CLASSIFICATION OPTIONS:
1. project_proposal - Project proposals, grant applications, funding requests
2. budget_plan - Budget plans, financial projections, cost breakdowns
3. contract - Contracts, agreements, terms and conditions
4. report - Progress reports, status updates, deliverables
5. invoice - Invoices, bills, payment requests
6. other - Other document types

RESPONSE FORMAT (JSON):
{
  "type": "project_proposal|budget_plan|contract|report|invoice|other",
  "confidence": 0.85,
  "reasoning": "Detailed explanation of classification decision",
  "suggestedFields": ["name", "description", "budget", "startDate", "endDate"]
}

Provide your analysis in valid JSON format only.
`;
  }

  private buildExtractionPrompt(
    content: DocumentContent,
    classification: DocumentClassification
  ): string {
    return `
Extract project information from this ${classification.type} document.

DOCUMENT TYPE: ${classification.type}
CONFIDENCE: ${classification.confidence}
REASONING: ${classification.reasoning}

DOCUMENT CONTENT:
${content.text.substring(0, 3000)}${content.text.length > 3000 ? '...' : ''}

${content.tables ? `TABLES: ${JSON.stringify(content.tables.slice(0, 2))}` : ''}

EXTRACTION REQUIREMENTS:
Extract the following project information if available:

1. Basic Information:
   - Project name/title
   - Project code/reference number
   - Description/summary
   - Start and end dates
   - Project manager/lead

2. Financial Information:
   - Total budget amount
   - Currency
   - Budget breakdown by categories
   - Funding source/grant giver

3. Grant/Funding Information:
   - Grant giver name and contact details
   - Grant reference number
   - Reporting requirements
   - Funding terms

4. Project Structure:
   - Team members
   - Categories/tags
   - Milestones and deliverables
   - Risk factors

5. Timeline and Deadlines:
   - Project phases
   - Key milestones
   - Deliverable due dates

RESPONSE FORMAT (JSON):
{
  "name": "Project Name",
  "code": "PROJ-2024-001",
  "description": "Project description...",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "totalBudget": 100000,
  "currency": "EUR",
  "grantGiverName": "Funding Organization",
  "grantGiverContact": "Contact Person",
  "grantGiverEmail": "contact@org.com",
  "grantGiverPhone": "+49 123 456789",
  "grantGiverAddress": "Address",
  "grantReference": "REF-123456",
  "reportingFrequency": "MONTHLY",
  "projectManager": "John Doe",
  "teamMembers": ["Member 1", "Member 2"],
  "categories": ["Software", "Research"],
  "milestones": [
    {
      "name": "Milestone 1",
      "date": "2024-03-31",
      "status": "pending"
    }
  ],
  "deliverables": [
    {
      "name": "Deliverable 1",
      "dueDate": "2024-06-30",
      "status": "pending"
    }
  ],
  "budgetBreakdown": [
    {
      "category": "Personnel",
      "amount": 60000,
      "percentage": 60
    }
  ],
  "risks": [
    {
      "description": "Risk description",
      "impact": "medium",
      "probability": "low"
    }
  ]
}

Provide your analysis in valid JSON format only. Use null for missing fields.
`;
  }

  private buildConsolidationPrompt(results: ProcessingResult[]): string {
    const documentsInfo = results
      .map(
        (result, index) => `
Document ${index + 1} (${result.metadata.fileName}):
- Type: ${result.classification.type}
- Confidence: ${result.classification.confidence}
- Project Info: ${JSON.stringify(result.projectInformation, null, 2)}
`
      )
      .join('\n');

    return `
Consolidate project information from multiple documents into a single, comprehensive project profile.

DOCUMENTS PROCESSED:
${documentsInfo}

CONSOLIDATION REQUIREMENTS:
1. Merge information from all documents, prioritizing higher confidence extractions
2. Resolve conflicts by choosing the most complete or recent information
3. Create a unified project profile with all available information
4. Identify any missing critical information
5. Ensure data consistency and completeness

RESPONSE FORMAT (JSON):
{
  "name": "Consolidated Project Name",
  "code": "PROJ-2024-001",
  "description": "Comprehensive project description...",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "totalBudget": 100000,
  "currency": "EUR",
  "grantGiverName": "Primary Funding Organization",
  "grantGiverContact": "Contact Person",
  "grantGiverEmail": "contact@org.com",
  "grantGiverPhone": "+49 123 456789",
  "grantGiverAddress": "Address",
  "grantReference": "REF-123456",
  "reportingFrequency": "MONTHLY",
  "projectManager": "John Doe",
  "teamMembers": ["Member 1", "Member 2"],
  "categories": ["Software", "Research"],
  "milestones": [
    {
      "name": "Milestone 1",
      "date": "2024-03-31",
      "status": "pending"
    }
  ],
  "deliverables": [
    {
      "name": "Deliverable 1",
      "dueDate": "2024-06-30",
      "status": "pending"
    }
  ],
  "budgetBreakdown": [
    {
      "category": "Personnel",
      "amount": 60000,
      "percentage": 60
    }
  ],
  "risks": [
    {
      "description": "Risk description",
      "impact": "medium",
      "probability": "low"
    }
  ],
  "consolidationNotes": "Notes about the consolidation process and any conflicts resolved"
}

Provide your analysis in valid JSON format only.
`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

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
              'You are an AI document processor specializing in project management. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 2000,
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

  private parseClassificationResponse(
    response: string
  ): DocumentClassification {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        type: parsed.type || 'other',
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedFields: parsed.suggestedFields || [],
      };
    } catch (error) {
      console.error('Error parsing classification response:', error);
      return {
        type: 'other',
        confidence: 0.5,
        reasoning: 'Failed to parse classification',
        suggestedFields: ['name', 'description'],
      };
    }
  }

  private parseExtractionResponse(response: string): ProjectInformation {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name || undefined,
        code: parsed.code || undefined,
        description: parsed.description || undefined,
        startDate: parsed.startDate || undefined,
        endDate: parsed.endDate || undefined,
        totalBudget: parsed.totalBudget || undefined,
        currency: parsed.currency || undefined,
        grantGiverName: parsed.grantGiverName || undefined,
        grantGiverContact: parsed.grantGiverContact || undefined,
        grantGiverEmail: parsed.grantGiverEmail || undefined,
        grantGiverPhone: parsed.grantGiverPhone || undefined,
        grantGiverAddress: parsed.grantGiverAddress || undefined,
        grantReference: parsed.grantReference || undefined,
        reportingFrequency: parsed.reportingFrequency || undefined,
        projectManager: parsed.projectManager || undefined,
        teamMembers: parsed.teamMembers || undefined,
        categories: parsed.categories || undefined,
        milestones: parsed.milestones || undefined,
        deliverables: parsed.deliverables || undefined,
        budgetBreakdown: parsed.budgetBreakdown || undefined,
        risks: parsed.risks || undefined,
      };
    } catch (error) {
      console.error('Error parsing extraction response:', error);
      return {};
    }
  }

  private parseConsolidationResponse(response: string): ProjectInformation {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name || undefined,
        code: parsed.code || undefined,
        description: parsed.description || undefined,
        startDate: parsed.startDate || undefined,
        endDate: parsed.endDate || undefined,
        totalBudget: parsed.totalBudget || undefined,
        currency: parsed.currency || undefined,
        grantGiverName: parsed.grantGiverName || undefined,
        grantGiverContact: parsed.grantGiverContact || undefined,
        grantGiverEmail: parsed.grantGiverEmail || undefined,
        grantGiverPhone: parsed.grantGiverPhone || undefined,
        grantGiverAddress: parsed.grantGiverAddress || undefined,
        grantReference: parsed.grantReference || undefined,
        reportingFrequency: parsed.reportingFrequency || undefined,
        projectManager: parsed.projectManager || undefined,
        teamMembers: parsed.teamMembers || undefined,
        categories: parsed.categories || undefined,
        milestones: parsed.milestones || undefined,
        deliverables: parsed.deliverables || undefined,
        budgetBreakdown: parsed.budgetBreakdown || undefined,
        risks: parsed.risks || undefined,
      };
    } catch (error) {
      console.error('Error parsing consolidation response:', error);
      return this.mergeProjectData([]);
    }
  }

  private mergeProjectData(results: ProcessingResult[]): ProjectInformation {
    const merged: ProjectInformation = {};

    // Simple merging strategy - take the first non-null value for each field
    results.forEach(result => {
      const info = result.projectInformation;
      if (info.name && !merged.name) merged.name = info.name;
      if (info.code && !merged.code) merged.code = info.code;
      if (info.description && !merged.description)
        merged.description = info.description;
      if (info.startDate && !merged.startDate)
        merged.startDate = info.startDate;
      if (info.endDate && !merged.endDate) merged.endDate = info.endDate;
      if (info.totalBudget && !merged.totalBudget)
        merged.totalBudget = info.totalBudget;
      if (info.currency && !merged.currency) merged.currency = info.currency;
      if (info.grantGiverName && !merged.grantGiverName)
        merged.grantGiverName = info.grantGiverName;
      if (info.grantGiverContact && !merged.grantGiverContact)
        merged.grantGiverContact = info.grantGiverContact;
      if (info.grantGiverEmail && !merged.grantGiverEmail)
        merged.grantGiverEmail = info.grantGiverEmail;
      if (info.grantGiverPhone && !merged.grantGiverPhone)
        merged.grantGiverPhone = info.grantGiverPhone;
      if (info.grantGiverAddress && !merged.grantGiverAddress)
        merged.grantGiverAddress = info.grantGiverAddress;
      if (info.grantReference && !merged.grantReference)
        merged.grantReference = info.grantReference;
      if (info.reportingFrequency && !merged.reportingFrequency)
        merged.reportingFrequency = info.reportingFrequency;
      if (info.projectManager && !merged.projectManager)
        merged.projectManager = info.projectManager;
      if (info.teamMembers && !merged.teamMembers)
        merged.teamMembers = info.teamMembers;
      if (info.categories && !merged.categories)
        merged.categories = info.categories;
      if (info.milestones && !merged.milestones)
        merged.milestones = info.milestones;
      if (info.deliverables && !merged.deliverables)
        merged.deliverables = info.deliverables;
      if (info.budgetBreakdown && !merged.budgetBreakdown)
        merged.budgetBreakdown = info.budgetBreakdown;
      if (info.risks && !merged.risks) merged.risks = info.risks;
    });

    return merged;
  }

  private extractBasicInformation(text: string): ProjectInformation {
    // Basic regex-based extraction as fallback
    const name = this.extractProjectName(text);
    const code = this.extractProjectCode(text);
    const description = this.extractDescription(text);
    const budget = this.extractBudget(text);

    return {
      name: name || undefined,
      code: code || undefined,
      description: description || undefined,
      totalBudget: budget.amount || undefined,
      currency: budget.currency || undefined,
    };
  }

  private extractProjectName(text: string): string | null {
    const patterns = [
      /Projekt[:\s]+(.+?)(?:\n|$)/i,
      /Titel[:\s]+(.+?)(?:\n|$)/i,
      /Name[:\s]+(.+?)(?:\n|$)/i,
      /"(.+?)"/,
      /'(.+?)'/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 3) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractProjectCode(text: string): string | null {
    const patterns = [
      /Projektcode[:\s]+([A-Z0-9-]+)/i,
      /Code[:\s]+([A-Z0-9-]+)/i,
      /Referenz[:\s]+([A-Z0-9-]+)/i,
      /([A-Z]{2,}-[0-9]{4}-[0-9]{3})/,
      /([A-Z]{3,}-[0-9]{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractDescription(text: string): string | null {
    const patterns = [
      /Beschreibung[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Zusammenfassung[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
      /Abstract[:\s]+(.+?)(?:\n\n|\n[A-Z]|$)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractBudget(text: string): { amount?: number; currency?: string } {
    const patterns = [
      /Budget[:\s]+([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/i,
      /Gesamtkosten[:\s]+([0-9.,\s]+)\s*([€$£]|[A-Z]{3})/i,
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
          maxAmount = amount;
          currency = match[2] || 'EUR';
        }
      }
    }

    return maxAmount > 0 ? { amount: maxAmount, currency } : {};
  }

  private extractTablesFromText(
    text: string
  ): Array<{ headers: string[]; rows: string[][] }> {
    // Simple table extraction - in production, use proper table parsing
    const lines = text.split('\n');
    const tables: Array<{ headers: string[]; rows: string[][] }> = [];

    let currentTable: { headers: string[]; rows: string[][] } | null = null;

    for (const line of lines) {
      if (line.includes('|') || line.includes('\t')) {
        const cells = line
          .split(/[|\t]/)
          .map(cell => cell.trim())
          .filter(cell => cell);

        if (cells.length > 1) {
          if (!currentTable) {
            currentTable = { headers: cells, rows: [] };
          } else {
            currentTable.rows.push(cells);
          }
        }
      } else if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
        currentTable = null;
      }
    }

    if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
    }

    return tables;
  }

  private calculateConfidence(
    classification: DocumentClassification,
    projectInfo: ProjectInformation
  ): number {
    let confidence = classification.confidence;

    // Boost confidence based on extracted information completeness
    const fields = Object.values(projectInfo).filter(
      value => value !== undefined && value !== null && value !== ''
    ).length;

    const totalFields = Object.keys(projectInfo).length;
    const completeness = fields / totalFields;

    confidence = (confidence + completeness) / 2;

    return Math.min(confidence, 1.0);
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
  }

  // Simulation methods for different file types
  private async simulatePdfExtraction(fileName: string): Promise<string> {
    // Simulate PDF content based on filename
    if (fileName.toLowerCase().includes('proposal')) {
      return `
        Projektantrag: KI-basierte Automatisierung
        Projektcode: KI-AUTO-2024

        Beschreibung:
        Entwicklung einer KI-basierten Automatisierungslösung für Geschäftsprozesse mit Fokus auf Effizienzsteigerung und Kostenreduktion.

        Zeitraum: 01.03.2024 - 28.02.2025
        Budget: 150.000 €

        Fördergeber: Bundesministerium für Wirtschaft und Klimaschutz
        Referenz: BMWK-KI-2024-003

        Projektleiter: Dr. Maria Schmidt
        Team: 5 Entwickler, 2 Data Scientists, 1 Projektmanager

        Meilensteine:
        - Anforderungsanalyse: 30.04.2024
        - Prototyp: 31.08.2024
        - Beta-Version: 30.11.2024
        - Finale Version: 28.02.2025

        Kategorien: Software, Forschung, Entwicklung, Personalkosten
      `;
    }

    return `PDF-Dokument: ${fileName}`;
  }

  private async simulateWordExtraction(fileName: string): Promise<string> {
    return this.simulatePdfExtraction(fileName);
  }

  private async simulateExcelExtraction(fileName: string): Promise<string> {
    return `
      Projektname: ${fileName.replace(/\.[^/.]+$/, '')}
      Budget: 75.000 €
      Startdatum: 01.06.2024
      Enddatum: 31.12.2024

      Budgetaufteilung:
      - Personalkosten: 45.000 € (60%)
      - Hardware: 15.000 € (20%)
      - Software: 10.000 € (13%)
      - Sonstiges: 5.000 € (7%)
    `;
  }

  private async simulateImageExtraction(fileName: string): Promise<string> {
    return `OCR-Text aus Bild: ${fileName}`;
  }
}

export const aiDocumentProcessor = new AIDocumentProcessor();
