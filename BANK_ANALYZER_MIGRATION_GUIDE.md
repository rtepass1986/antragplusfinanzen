# 🔄 Bank Statement Analyzer Migration Guide

## Quick Start

Follow these steps to deploy the upgraded Bank Statement Analyzer:

---

## Step 1: Update Database Schema

The Transaction model has been updated to support the new features. Run the Prisma migration:

```bash
# Navigate to project directory
cd /Users/roberttepass/Desktop/Agenti_Build/fintech-saas

# Generate and apply migration
npx prisma migrate dev --name add_bank_statement_features

# Regenerate Prisma Client
npx prisma generate
```

---

## Step 2: Verify Environment Variables

Ensure all required environment variables are set in `.env.local`:

```env
# OpenAI API (Required for AI features)
OPENAI_API_KEY=sk-proj-...

# AWS Credentials (Required for PDF processing)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Database (Required)
DATABASE_URL=postgresql://user:password@localhost:5432/fintech_saas

# NextAuth (Required for API authentication)
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

### How to Get API Keys:

**OpenAI API Key:**

1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and paste into `OPENAI_API_KEY`

**AWS Credentials:**

1. Go to AWS Console → IAM
2. Create a new user with Textract and S3 permissions
3. Generate access keys
4. Copy credentials

**S3 Bucket:**

1. Go to AWS Console → S3
2. Create a new bucket (e.g., `fintech-saas-bank-statements`)
3. Add CORS configuration to allow uploads

---

## Step 3: Test the Analyzer

### Test with CSV (Simplest)

Create a test CSV file (`test-statement.csv`):

```csv
Date,Description,Amount,Balance
2024-01-01,Office Depot - Supplies,-125.50,5000.00
2024-01-02,Client Payment ABC Inc,2500.00,7500.00
2024-01-03,Amazon AWS Services,-89.99,7410.01
2024-01-05,Sparkasse Monthly Fee,-5.90,7404.11
```

### Test via UI:

1. Start the development server:

```bash
npm run dev
```

2. Navigate to: http://localhost:3000/bank

3. Upload `test-statement.csv`

4. Verify:
   - ✅ Transactions are parsed
   - ✅ AI suggests categories
   - ✅ Currency is detected
   - ✅ Counterparties are extracted

### Test via API:

```bash
curl -X POST http://localhost:3000/api/bank/process-statement \
  -F "file=@test-statement.csv" \
  -F "companyId=your-company-id" \
  -F "saveToDatabase=false"
```

---

## Step 4: Test PDF Processing (Optional)

**Note:** PDF processing requires AWS Textract which incurs costs.

1. Download a sample bank statement PDF (or use your own)

2. Upload via UI or API

3. Verify:
   - ✅ Text is extracted with Textract
   - ✅ AI parses structured data
   - ✅ Transactions are identified
   - ✅ S3 files are cleaned up

---

## Step 5: Deploy to Production

### Update Production Environment Variables

Add all environment variables to your hosting platform:

**Vercel:**

```bash
vercel env add OPENAI_API_KEY
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
# ... etc
```

**Other Platforms:**

- Add via dashboard or CLI
- Ensure all variables are set for production environment

### Deploy

```bash
# If using Vercel
vercel --prod

# If using other platforms
git push origin main
```

---

## Step 6: Monitor and Validate

### Check Logs

```bash
# Local
npm run dev
# Watch for "Bank PDF processing..." messages

# Production (Vercel)
vercel logs
```

### Validate Features

Test each feature in production:

✅ **CSV Import:**

- Upload CSV statement
- Verify transactions appear in database
- Check categories are suggested

✅ **Excel Import:**

- Upload XLS/XLSX statement
- Verify column detection works
- Check multi-language support (German/English)

✅ **PDF Import:**

- Upload PDF statement
- Verify Textract extraction
- Verify AI parsing
- Check S3 cleanup

✅ **Duplicate Detection:**

- Import same statement twice
- Verify duplicates are flagged
- Verify duplicates are not saved

✅ **Reconciliation:**

- Create an invoice
- Import matching transaction
- Verify automatic matching

---

## Troubleshooting

### Issue: "OPENAI_API_KEY environment variable is required"

**Solution:**

```bash
# Check if variable is set
echo $OPENAI_API_KEY

# If not, add to .env.local
echo "OPENAI_API_KEY=sk-proj-..." >> .env.local

# Restart dev server
npm run dev
```

### Issue: "AWS Textract failed"

**Possible Causes:**

1. Invalid AWS credentials
2. S3 bucket doesn't exist
3. Missing IAM permissions

**Solution:**

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://your-bucket-name

# If permissions missing, add these policies:
# - AmazonTextractFullAccess
# - AmazonS3FullAccess (or scoped to your bucket)
```

### Issue: "Failed to save to database"

**Possible Causes:**

1. Prisma Client not regenerated
2. Database migration not applied
3. Database connection issues

**Solution:**

```bash
# Regenerate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Test connection
npx prisma db pull
```

### Issue: "Balance field not found"

**Solution:**
The Prisma schema was updated but client wasn't regenerated:

```bash
npx prisma generate
```

Then restart your dev server.

### Issue: "Transaction type must be INCOME or EXPENSE"

**Cause:** The Transaction model uses enums, not strings.

**Solution:** This is already handled in the code. If you see this error, ensure you're using the latest code from the upgrade.

---

## Rollback Plan

If you need to rollback:

### 1. Revert Database Migration

```bash
# View migrations
npx prisma migrate status

# Rollback last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

### 2. Revert Code Changes

```bash
# Revert to previous commit
git log --oneline
git revert <commit-hash>

# Or reset hard (WARNING: Loses changes)
git reset --hard <commit-hash>
```

---

## Performance Optimization

### Database Indexes

Add indexes for better performance:

```prisma
// In prisma/schema.prisma
model Transaction {
  // ... existing fields ...

  @@index([date])
  @@index([bankAccountId, date])
  @@index([aiProcessed])
}
```

Then run:

```bash
npx prisma migrate dev --name add_transaction_indexes
```

### Caching

Consider adding Redis caching for:

- Existing transactions lookup
- AI analysis results
- Bank format detection

---

## Cost Estimates

### OpenAI API Costs:

- **GPT-4o:** ~$0.005 per 1K input tokens
- **Average statement:** ~2K tokens input + 500 tokens output
- **Cost per statement:** ~$0.015 (1.5 cents)

### AWS Textract Costs:

- **Text Detection:** $0.0015 per page
- **Average statement:** 3 pages
- **Cost per PDF:** ~$0.0045 (0.45 cents)

### AWS S3 Costs:

- **Storage:** $0.023 per GB/month (minimal - files deleted after processing)
- **Requests:** $0.0004 per 1,000 PUT requests

**Total Cost Per Statement:** ~2 cents

**For 1,000 statements/month:** ~$20

---

## Support and Next Steps

### Documentation:

- Full feature list: `BANK_STATEMENT_ANALYZER_UPGRADE.md`
- Code documentation: Inline comments in `bank-statement-analyzer.ts`

### Getting Help:

1. Check inline code comments
2. Review API endpoint: `GET /api/bank/process-statement`
3. Check Prisma schema documentation

### Next Features to Build:

- [ ] Batch import UI (multiple statements at once)
- [ ] Statement history page
- [ ] Transaction editing UI
- [ ] Category management
- [ ] Reconciliation dashboard

---

**Migration Status:** ✅ Complete
**Last Updated:** September 30, 2025
**Version:** 2.0.0
