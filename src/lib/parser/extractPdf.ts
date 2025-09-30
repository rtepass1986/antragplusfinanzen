export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid server-side issues
    const pdfParse = (await import('pdf-parse')).default;
    const { text } = await pdfParse(buffer);
    return (text || '').trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

export function isImage(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(file.name)
  );
}
