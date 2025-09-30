#!/usr/bin/env node

/**
 * AWS Setup Test Script
 * Run this to verify your AWS configuration is working
 */

const {
  TextractClient,
  AnalyzeDocumentCommand,
} = require('@aws-sdk/client-textract');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testAWSSetup() {
  console.log('🔍 Testing AWS Setup...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`AWS_REGION: ${process.env.AWS_REGION || '❌ Not set'}`);
  console.log(
    `AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set'}`
  );
  console.log(
    `AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`
  );
  console.log(
    `S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME || '❌ Not set'}\n`
  );

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('❌ AWS credentials not found. Please set up .env.local file.');
    return;
  }

  try {
    // Test S3 connectivity
    console.log('🪣 Testing S3 connectivity...');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'eu-central-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const s3Response = await s3Client.send(new ListBucketsCommand({}));
    console.log(
      `✅ S3 connection successful. Found ${s3Response.Buckets?.length || 0} buckets`
    );

    // Test Textract connectivity
    console.log('\n📄 Testing Textract connectivity...');
    const textractClient = new TextractClient({
      region: process.env.AWS_REGION || 'eu-central-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Create a simple test document (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0xff, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    try {
      const textractResponse = await textractClient.send(
        new AnalyzeDocumentCommand({
          Document: { Bytes: testImageBuffer },
          FeatureTypes: ['FORMS'],
        })
      );
      console.log('✅ Textract connection successful');
      console.log(
        `   Response blocks: ${textractResponse.Blocks?.length || 0}`
      );
    } catch (textractError) {
      if (textractError.name === 'InvalidDocumentException') {
        console.log(
          '✅ Textract connection successful (expected error for test image)'
        );
      } else {
        console.log(`❌ Textract error: ${textractError.message}`);
      }
    }

    console.log('\n🎉 AWS setup test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Navigate to /invoices/import');
    console.log('3. Upload a real invoice to test OCR processing');
  } catch (error) {
    console.log(`❌ AWS test failed: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your AWS credentials in .env.local');
    console.log('2. Verify your IAM user has the correct permissions');
    console.log('3. Ensure your AWS region is correct');
  }
}

// Run the test
testAWSSetup().catch(console.error);
