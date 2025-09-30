# GitHub & Vercel Deployment Steps

## 🚀 Quick Deploy Guide

Your code is committed and ready! Follow these steps to deploy:

---

## Step 1: Create GitHub Repository

1. **Go to GitHub**: https://github.com/new
2. **Create new repository**:
   - Repository name: `fintech-saas` (or your preferred name)
   - Description: `Fintech SaaS with invoice management and cash flow forecasting`
   - Visibility: **Private** (recommended for production code)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. **Click "Create repository"**

---

## Step 2: Connect Your Local Repository

After creating the repository, run these commands:

```bash
# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/fintech-saas.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/fintech-saas.git

# Push your code
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

---

## Step 3: Import to Vercel

### Method A: Via Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com/new
2. **Import Git Repository**:
   - Select your GitHub repository: `fintech-saas`
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./`
   - Click "Import"

3. **Configure Environment Variables**:

   Click "Environment Variables" and add ALL of these:

   **Required:**

   ```bash
   # Email Service (Get from https://resend.com)
   RESEND_API_KEY=re_your_api_key
   EMAIL_FROM=noreply@yourdomain.com

   # Database (Get from Vercel Postgres or Neon)
   DATABASE_URL=postgresql://user:pass@host/db

   # NextAuth
   NEXTAUTH_URL=https://your-app-name.vercel.app
   NEXTAUTH_SECRET=<run: openssl rand -base64 32>

   # AWS (Already have these)
   AWS_REGION=eu-central-1
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   S3_BUCKET_NAME=your-s3-bucket-name

   # OpenAI (Already have this)
   OPENAI_API_KEY=your-openai-key
   ```

   **Highly Recommended:**

   ```bash
   # reCAPTCHA (Get from https://www.google.com/recaptcha/admin)
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
   RECAPTCHA_SECRET_KEY=your_secret_key

   # Upstash Redis for Rate Limiting (Get from https://upstash.com)
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token
   ```

4. **Click "Deploy"**

---

### Method B: Via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link to your GitHub repo and deploy
vercel --prod
```

The CLI will prompt you to add environment variables interactively.

---

## Step 4: Set Up External Services

### 🔑 Required Services Setup

#### 1. **Resend (Email Service)** - REQUIRED

1. Go to https://resend.com
2. Sign up (free tier: 3,000 emails/month)
3. Verify your domain (or use onboarding.resend.dev for testing)
4. Get API key from dashboard
5. Add to Vercel: `RESEND_API_KEY` and `EMAIL_FROM`

#### 2. **Database** - REQUIRED

**Option A: Vercel Postgres** (Easiest)

1. In Vercel Dashboard → Storage → Create Database → Postgres
2. Connect to your project
3. `DATABASE_URL` is automatically added

**Option B: Neon** (Recommended for Serverless)

1. Go to https://neon.tech
2. Create new project
3. Copy connection string
4. Add to Vercel: `DATABASE_URL`

#### 3. **reCAPTCHA v3** - Highly Recommended

1. Go to https://www.google.com/recaptcha/admin
2. Register new reCAPTCHA v3 site
3. Add domains:
   - `localhost` (for development)
   - `your-app.vercel.app` (your Vercel domain)
4. Copy Site Key and Secret Key
5. Add to Vercel:
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
   - `RECAPTCHA_SECRET_KEY`

#### 4. **Upstash Redis** - Optional (but recommended for production)

1. Go to https://upstash.com
2. Create new Redis database
3. Copy REST URL and Token
4. Add to Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## Step 5: Post-Deployment

After your first successful deployment:

### Initialize Database

```bash
# Pull production environment variables
vercel env pull .env.production.local

# Run Prisma migrations
npx prisma generate
npx prisma db push

# Initialize permissions (if using Vercel Postgres)
npm run init-permissions
```

**Or** run these via Vercel serverless function if you prefer.

---

## Step 6: Test Production

Visit your deployed app and test:

- ✅ Sign up with real email
- ✅ Receive verification email
- ✅ Click verification link
- ✅ Sign in with verified account
- ✅ Try rapid signups (test rate limiting)
- ✅ Access protected routes without auth (should redirect)

---

## 🔧 Quick Commands Reference

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Check deployment status
vercel

# View deployment logs
vercel logs

# Pull production environment variables
vercel env pull .env.production.local

# Redeploy (after adding env vars)
vercel --prod
```

---

## ⚠️ Important Notes

### Environment Variables

- **Set for "Production" environment** in Vercel
- After adding new variables, **redeploy** for them to take effect
- Never commit `.env.local` or `.env.production.local`

### First Deployment

The app works **without** reCAPTCHA and Upstash (uses fallbacks), but:

- **Resend API key is REQUIRED** for email verification
- **DATABASE_URL is REQUIRED** for the app to function

### Domain Configuration

After deployment, update `NEXTAUTH_URL`:

```bash
# In Vercel env vars, change from:
NEXTAUTH_URL=https://your-app-name.vercel.app

# To your actual Vercel URL (shown after deployment):
NEXTAUTH_URL=https://fintech-saas-xyz123.vercel.app
```

Then redeploy for the change to take effect.

---

## 🎯 Deployment Checklist

Before deploying:

- [ ] GitHub repository created
- [ ] Local repo pushed to GitHub
- [ ] Vercel account ready
- [ ] Resend account created (get API key)
- [ ] Database ready (Vercel Postgres or Neon)

During deployment:

- [ ] Repository imported to Vercel
- [ ] All environment variables added
- [ ] Deployment successful

After deployment:

- [ ] Database schema deployed (`prisma db push`)
- [ ] Permissions initialized
- [ ] Test signup → email → verify → login flow
- [ ] All critical features working

---

## 🐛 Common Issues

### Build Fails

- Check build logs in Vercel dashboard
- Verify all required environment variables are set
- Check Prisma can connect to database

### Email Not Sending

- Verify `RESEND_API_KEY` is correct
- Check domain is verified in Resend
- View Resend logs for errors

### Database Connection Failed

- Verify `DATABASE_URL` format is correct
- Check database is accessible from Vercel
- For Vercel Postgres, ensure it's connected to project

### reCAPTCHA Errors (Optional)

- Verify both `SITE_KEY` and `SECRET_KEY` are set
- Check domain is added in reCAPTCHA admin
- App works without it (logs warning)

---

## 📚 Helpful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Vercel Docs**: https://vercel.com/docs
- **Resend Dashboard**: https://resend.com/dashboard
- **reCAPTCHA Admin**: https://www.google.com/recaptcha/admin
- **Upstash Console**: https://console.upstash.com

---

## ✨ You're All Set!

Your code is committed and ready to deploy. Just:

1. Create GitHub repo
2. Push your code
3. Import to Vercel
4. Add environment variables
5. Deploy! 🚀

**Need help?** See `SECURITY_SETUP_GUIDE.md` for detailed configuration.

---

**Status**: ✅ Code committed, ready for GitHub push
**Next**: Create GitHub repository and follow steps above
