import { projectDataExtractor } from '@/lib/projects/data-extractor';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
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

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Analyze document quality
    const qualityAnalysis =
      await projectDataExtractor.analyzeDocumentQuality(file);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        quality: qualityAnalysis.quality,
        issues: qualityAnalysis.issues,
        recommendations: qualityAnalysis.recommendations,
        analysisDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error analyzing document quality:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze document quality',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Document Quality Analysis API',
    checks: [
      'File size validation',
      'Text content length',
      'Project name detection',
      'Budget information presence',
      'Date information presence',
      'Description completeness',
    ],
    qualityLevels: [
      'excellent - No issues found',
      'good - Minor issues detected',
      'fair - Some issues found',
      'poor - Multiple issues detected',
    ],
  });
}
