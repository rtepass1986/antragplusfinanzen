# Vercel Deployment Guide

This guide will help you deploy your Fintech SaaS application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **PostgreSQL Database**: Set up a production database (recommended: Vercel Postgres, Neon, or Supabase)
4. **AWS Account**: For S3 storage and Textract OCR
5. **OpenAI API Key**: For AI-powered invoice processing

## Step 1: Database Setup

### Option A: Vercel Postgres (Recommended)

1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the `DATABASE_URL` connection string

### Option B: External PostgreSQL Provider

Use providers like:

- [Neon](https://neon.tech) (Serverless Postgres)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)
- AWS RDS

## Step 2: Environment Variables

Set up the following environment variables in Vercel:

### Required Variables

```bash
# AWS Configuration
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# S3 Configuration
S3_BUCKET_NAME=your-s3-bucket-name

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# NextAuth Configuration
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=your-random-secret-min-32-chars
```

### Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## Step 3: Deploy to Vercel

### Via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure your project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: .next
   - **Install Command**: `npm install`

4. Add all environment variables from Step 2
5. Click "Deploy"

### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Or deploy to production directly
vercel --prod
```

## Step 4: Post-Deployment Setup

### 1. Initialize Database Schema

After your first deployment, run Prisma migrations:

```bash
# Using Vercel CLI
vercel env pull .env.production.local
npx prisma generate
npx prisma db push

# Or via Vercel dashboard → Settings → Functions → Add Serverless Function
```

### 2. Seed Initial Permissions

Run the permission initialization script:

```bash
npm run init-permissions
```

Or create a one-time serverless function to run this.

### 3. Verify Deployment

Check these critical features:

- [ ] User authentication (sign up/sign in)
- [ ] Invoice upload and OCR processing
- [ ] Bank statement analysis
- [ ] Analytics dashboard
- [ ] Project management

## Step 5: AWS Configuration

### S3 Bucket Setup

1. Create an S3 bucket in your AWS account
2. Configure CORS for your Vercel domain:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://your-app-name.vercel.app"],
    "ExposeHeaders": []
  }
]
```

3. Set appropriate bucket policies for security

### IAM Permissions

Ensure your AWS IAM user has these permissions:

- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `textract:AnalyzeDocument`
- `textract:DetectDocumentText`

## Step 6: Domain Configuration (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update `NEXTAUTH_URL` environment variable to your custom domain

## Troubleshooting

### Build Errors

If you encounter TypeScript or ESLint errors during build:

- The project is configured to ignore these (`ignoreBuildErrors: true`)
- However, it's recommended to fix them before deploying

### Database Connection Issues

1. Ensure DATABASE_URL is correctly formatted
2. Check if your database provider allows connections from Vercel's IP ranges
3. For Vercel Postgres, use connection pooling: `?pgbouncer=true`

### Function Timeout Issues

Some API routes (invoice processing, bank statements) may take longer:

- Vercel Pro plan allows up to 60 seconds
- Hobby plan: 10 seconds max
- The `vercel.json` is configured with appropriate timeouts

### Environment Variables Not Working

1. Ensure variables are added in Vercel Dashboard → Settings → Environment Variables
2. Variables added after deployment require a redeploy
3. Check that variable names match exactly (case-sensitive)

## Monitoring & Logs

- **Logs**: Vercel Dashboard → Your Project → Deployments → Click deployment → Functions
- **Analytics**: Enable Vercel Analytics in project settings
- **Error Tracking**: Consider integrating Sentry or similar

## Security Checklist

- [ ] Strong NEXTAUTH_SECRET generated
- [ ] AWS credentials have minimal required permissions
- [ ] Database allows only necessary connections
- [ ] S3 bucket has proper CORS configuration
- [ ] API keys are stored in environment variables (never in code)
- [ ] HTTPS enforced (automatic with Vercel)

## Performance Optimization

1. **Edge Caching**: Configure appropriate cache headers
2. **Image Optimization**: Next.js automatically optimizes images
3. **Database Connection Pooling**: Use Prisma connection pooling
4. **CDN**: Vercel automatically uses their Edge Network

## Continuous Deployment

Once connected to GitHub:

- Every push to `main` branch automatically deploys to production
- Pull requests create preview deployments
- Configure branch protection rules for safety

## Cost Considerations

### Vercel Pricing

- **Hobby**: Free (suitable for development/testing)
- **Pro**: $20/month (recommended for production)

### External Services

- Database hosting
- AWS S3 storage & Textract usage
- OpenAI API usage

## Support & Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

---

## Quick Deploy Checklist

- [ ] Push code to GitHub
- [ ] Set up production database
- [ ] Configure environment variables in Vercel
- [ ] Deploy via Vercel dashboard or CLI
- [ ] Run database migrations
- [ ] Initialize permissions
- [ ] Test critical features
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring

Your fintech SaaS application should now be live on Vercel! 🚀
