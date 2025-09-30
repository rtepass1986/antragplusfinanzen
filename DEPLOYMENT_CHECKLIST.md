# Vercel Deployment Checklist

## Pre-Deployment

### 1. Code Preparation

- [x] Updated `vercel.json` with correct API route configurations
- [x] Added `postinstall` script for Prisma generation
- [x] Created `.env.example` with all required variables
- [x] Created `.vercelignore` to exclude unnecessary files
- [ ] Committed all changes to Git
- [ ] Pushed to GitHub repository

### 2. External Services Setup

#### Database

- [ ] Set up production PostgreSQL database
  - Recommended: Vercel Postgres, Neon, or Supabase
- [ ] Copy `DATABASE_URL` connection string
- [ ] Test database connection

#### AWS Services

- [ ] Create S3 bucket for document storage
- [ ] Configure S3 CORS for production domain
- [ ] Set up IAM user with minimal permissions:
  - S3: PutObject, GetObject, DeleteObject
  - Textract: AnalyzeDocument, DetectDocumentText
- [ ] Copy AWS credentials (Access Key ID & Secret)

#### OpenAI

- [ ] Have OpenAI API key ready
- [ ] Verify API quota/limits for production use

## Deployment Steps

### 3. Vercel Project Setup

- [ ] Go to [vercel.com/new](https://vercel.com/new)
- [ ] Import GitHub repository
- [ ] Select project root directory

### 4. Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME
DATABASE_URL
OPENAI_API_KEY
NEXTAUTH_URL (https://your-app.vercel.app)
NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
```

- [ ] All environment variables added
- [ ] Variables set for Production environment
- [ ] NEXTAUTH_SECRET generated securely

### 5. Deploy

- [ ] Click "Deploy" in Vercel dashboard
- [ ] Wait for build to complete
- [ ] Check deployment logs for errors

## Post-Deployment

### 6. Database Initialization

Run these commands locally with production DATABASE_URL:

```bash
# Pull production environment variables
vercel env pull .env.production.local

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Initialize permissions
npm run init-permissions
```

- [ ] Database schema deployed
- [ ] Permissions initialized

### 7. Verification Testing

Test these critical features on production:

- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] User sign-in works
- [ ] Invoice upload and OCR processing
- [ ] Bank statement analysis
- [ ] Analytics dashboard displays
- [ ] Project management features
- [ ] User management and invitations

### 8. Security Verification

- [ ] All API endpoints require authentication
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Environment variables not exposed in client code
- [ ] AWS credentials have minimal permissions
- [ ] Database connection is secure

### 9. Performance Check

- [ ] Page load times acceptable
- [ ] API routes respond within timeout limits
- [ ] Images and assets loading properly
- [ ] No console errors in browser

### 10. Monitoring Setup

- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (optional: Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up deployment notifications

## Custom Domain (Optional)

### 11. Domain Configuration

- [ ] Go to Vercel → Settings → Domains
- [ ] Add custom domain
- [ ] Configure DNS records
- [ ] Update NEXTAUTH_URL to custom domain
- [ ] Redeploy to apply changes

## Ongoing Maintenance

### Regular Tasks

- [ ] Monitor error logs regularly
- [ ] Check database size and performance
- [ ] Review AWS billing (S3 & Textract usage)
- [ ] Monitor OpenAI API usage
- [ ] Update dependencies periodically
- [ ] Backup database regularly

## Troubleshooting

### If Build Fails

1. Check build logs in Vercel dashboard
2. Verify all environment variables are set
3. Ensure `package.json` scripts are correct
4. Check for TypeScript/ESLint errors (though ignored in config)

### If Functions Timeout

1. Verify `vercel.json` function configurations
2. Consider upgrading to Vercel Pro for 60s timeouts
3. Optimize long-running operations
4. Consider background job processing

### If Database Connection Fails

1. Verify DATABASE_URL format
2. Check database provider allows Vercel connections
3. Test connection with Prisma Studio
4. Ensure database is active and accessible

### If AWS Services Fail

1. Verify IAM permissions
2. Check S3 CORS configuration
3. Verify AWS credentials in environment variables
4. Check AWS service quotas

## Success Criteria

Your deployment is successful when:

- ✅ Application accessible at production URL
- ✅ Users can sign up and sign in
- ✅ Core features (invoices, bank, analytics) working
- ✅ No critical errors in logs
- ✅ All environment variables configured
- ✅ Database connected and seeded
- ✅ AWS services integrated
- ✅ Performance is acceptable

---

**Need Help?**

- See detailed guide: `VERCEL_DEPLOYMENT.md`
- Vercel Docs: https://vercel.com/docs
- Prisma Deployment: https://www.prisma.io/docs/guides/deployment

**Deployment Date:** **\*\***\_**\*\***
**Deployed By:** **\*\***\_**\*\***
**Production URL:** **\*\***\_**\*\***
