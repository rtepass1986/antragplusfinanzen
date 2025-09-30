import { s3Client, s3Config } from './config';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private bucketName: string;

  constructor() {
    this.bucketName = s3Config.bucketName;
  }

  // Upload file to S3
  async uploadFile(file: File, key: string): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(uploadCommand);
      return `https://${this.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  // Generate presigned URL for secure upload
  async generatePresignedUrl(
    key: string,
    contentType: string
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
      });
      return presignedUrl;
    } catch (error) {
      console.error('Presigned URL generation error:', error);
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }

  // Get file from S3
  async getFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await s3Client.send(command);
      if (!response.Body) {
        throw new Error('No file body received');
      }

      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('S3 get file error:', error);
      throw new Error(`Failed to get file: ${error}`);
    }
  }

  // Delete file from S3
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }
}

export const s3Service = new S3Service();
