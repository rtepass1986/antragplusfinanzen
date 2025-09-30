import { AIDocumentProcessor } from '@/lib/ai/document-processor';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed' },
        { status: 400 }
      );
    }

    console.log(`Processing ${files.length} project documents with AI...`);

    const processor = new AIDocumentProcessor();

    // Process all documents
    const results = await processor.processMultipleDocuments(files);

    // Consolidate project data from all documents
    const consolidatedData = await processor.consolidateProjectData(results);

    console.log(`Successfully processed ${files.length} documents`);

    return NextResponse.json({
      success: true,
      results,
      consolidatedData,
      summary: {
        totalDocuments: files.length,
        averageConfidence:
          results.reduce((acc, r) => acc + r.confidence, 0) / results.length,
        documentTypes: results.map(r => r.classification.type),
      },
    });
  } catch (error) {
    console.error('Error processing project documents:', error);
    return NextResponse.json(
      {
        error: 'Failed to process documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Project document processing API',
    supportedFormats: ['PDF', 'DOCX', 'XLSX', 'TXT', 'JSON'],
    maxFiles: 10,
    features: [
      'AI-powered document classification',
      'Multi-document consolidation',
      'Project data extraction',
      'Budget and timeline detection',
      'Grant giver identification',
    ],
  });
}
