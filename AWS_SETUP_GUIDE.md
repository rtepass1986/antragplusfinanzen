# 🚀 AWS Production Setup Guide

## 📋 Prerequisites

- AWS Account with billing enabled
- IAM user with appropriate permissions
- S3 bucket for invoice storage

## 🔑 Step 1: Create IAM User

### Create IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:AnalyzeDocument",
        "textract:DetectDocumentText",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "*"
    }
  ]
}
```

### Create IAM User

1. Go to IAM Console
2. Create new user: `fintech-ocr-user`
3. Attach the policy above
4. Generate access keys

## 🪣 Step 2: Create S3 Bucket

```bash
# Create bucket (replace with your name)
aws s3 mb s3://your-company-invoices --region eu-central-1

# Enable CORS for web uploads
aws s3api put-bucket-cors --bucket your-company-invoices --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "POST", "PUT"],
      "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'
```

## ⚙️ Step 3: Environment Variables

Create `.env.local` file:

```bash
# AWS Configuration
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=AKIA...your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# S3 Configuration
S3_BUCKET_NAME=your-company-invoices
```

## 🧪 Step 4: Test OCR Processing

1. **Start development server:**

   ```bash
   npm run dev
   ```

2. **Upload test invoice:**
   - Navigate to `/invoices/import`
   - Upload a PDF or image invoice
   - Watch real AWS Textract processing

3. **Check AWS Console:**
   - Textract: Processing history
   - S3: Uploaded files
   - CloudWatch: Logs and metrics

## 💰 Cost Optimization

### Free Tier Usage

- **First 3 months:** 1,000 pages free
- **Forms & Tables:** $0.015/page after
- **Simple Text:** $0.006/page (if you don't need structured data)

### Cost Control

```typescript
// In textract.ts, you can add cost controls
const input: AnalyzeDocumentCommandInput = {
  Document: document,
  FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
  // Add cost controls
  MaxResults: 100, // Limit results
};
```

## 🔒 Security Best Practices

1. **IAM Least Privilege:** Only necessary permissions
2. **S3 Bucket Policy:** Restrict access to your app only
3. **Environment Variables:** Never commit credentials
4. **VPC Endpoints:** For production, use VPC endpoints

## 📊 Monitoring & Alerts

### CloudWatch Alarms

- Textract API errors > 5%
- S3 upload failures
- Processing time > 30 seconds

### Cost Alerts

- Monthly Textract costs > $50
- S3 storage > 10GB

## 🚀 Production Deployment

1. **Environment Variables:** Set in your hosting platform
2. **S3 Bucket:** Use production bucket name
3. **CORS:** Update with production domain
4. **Monitoring:** Enable CloudWatch logging

## 🎯 Next Steps

1. ✅ Set up AWS credentials
2. ✅ Test with real invoices
3. ✅ Monitor costs and performance
4. ✅ Deploy to production
5. 🚧 Implement expense management (Phase 3)

---

**Status:** 🎉 OCR System Production Ready
**Next:** Test with real AWS credentials
