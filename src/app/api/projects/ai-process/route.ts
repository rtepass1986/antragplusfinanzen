import { aiDocumentProcessor } from '@/lib/ai/document-processor';
import { projectDataExtractor } from '@/lib/projects/data-extractor';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const useAI = formData.get('useAI') === 'true';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed' },
        { status: 400 }
      );
    }

    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'image/png',
      'image/jpeg',
    ];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}` },
          { status: 400 }
        );
      }

      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit
        return NextResponse.json(
          { error: `File too large: ${file.name}` },
          { status: 400 }
        );
      }
    }

    let result;

    if (useAI && files.length === 1) {
      // Single file AI processing
      const processingResult = await aiDocumentProcessor.processDocument(
        files[0]
      );
      result = {
        projectInformation: processingResult.projectInformation,
        confidence: processingResult.confidence,
        processingNotes: `AI-processed (${processingResult.classification.type}, confidence: ${processingResult.confidence})`,
        documentType: processingResult.classification.type,
        processingTime: processingResult.processingTime,
      };
    } else if (useAI && files.length > 1) {
      // Multiple files AI processing
      const processingResults =
        await aiDocumentProcessor.processMultipleDocuments(files);
      const consolidatedData =
        await aiDocumentProcessor.consolidateProjectData(processingResults);

      result = {
        projectInformation: consolidatedData,
        confidence:
          processingResults.reduce((acc, r) => acc + r.confidence, 0) /
          processingResults.length,
        processingNotes: `AI-processed ${files.length} documents`,
        documentTypes: processingResults.map(r => r.classification.type),
        processingTime: processingResults.reduce(
          (acc, r) => acc + r.processingTime,
          0
        ),
      };
    } else {
      // Fallback to regex-based processing
      if (files.length === 1) {
        result = await projectDataExtractor.extractFromFile(files[0]);
      } else {
        result = await projectDataExtractor.extractFromMultipleFiles(files);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      filesProcessed: files.length,
      processingMethod: useAI ? 'AI' : 'Regex',
    });
  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      {
        error: 'Failed to process files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Project Processing API',
    supportedFormats: [
      'PDF',
      'Word (.docx, .doc)',
      'Excel (.xlsx, .xls)',
      'Text (.txt)',
      'JSON',
      'Images (PNG, JPG)',
    ],
    maxFiles: 10,
    maxFileSize: '50MB',
    features: [
      'AI-powered document classification',
      'Intelligent project information extraction',
      'Multi-document consolidation',
      'Quality analysis',
      'Budget breakdown extraction',
      'Risk assessment',
      'Milestone and deliverable detection',
    ],
  });
}
