import { S3Client } from '@aws-sdk/client-s3';
import { TextractClient } from '@aws-sdk/client-textract';

// AWS Configuration
export const awsConfig = {
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

// Initialize AWS clients
export const textractClient = new TextractClient(awsConfig);
export const s3Client = new S3Client({
  ...awsConfig,
  forcePathStyle: false,
});

// S3 Configuration
export const s3Config = {
  bucketName: process.env.S3_BUCKET_NAME || 'your-invoice-bucket-name',
  region: process.env.AWS_REGION || 'eu-central-1',
};
