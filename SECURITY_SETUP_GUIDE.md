# Security Setup Guide

## ✅ Critical Security Features Implemented

All critical production security issues have been resolved! Here's what was implemented:

### 1. ✅ Email Verification System

- Users receive verification emails upon registration
- Email must be verified before login
- 24-hour token expiration
- Resend verification email option
- Welcome email sent upon verification

### 2. ✅ Rate Limiting

- Registration: 5 requests per hour per IP
- Login: 10 requests per 15 minutes per IP
- In-memory fallback for development
- Production-ready with Upstash Redis (optional)

### 3. ✅ Bot Protection

- Google reCAPTCHA v3 integration
- Graceful fallback if not configured
- Server-side verification

### 4. ✅ Middleware Protection

- NextAuth middleware enabled
- All routes protected except public pages
- Automatic redirect to sign-in

### 5. ✅ Enhanced Password Security

- Minimum 12 characters (increased from 8)
- Requires uppercase, lowercase, number, special character
- Real-time password strength meter
- Complexity validation on client and server

### 6. ✅ Email Enumeration Prevention

- Generic messages on registration
- Don't reveal if email exists
- Consistent response times

---

## 🔧 Environment Variables Setup

### Required for Production

```bash
# Email Service - Resend (https://resend.com)
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=noreply@yourdomain.com
```

**Setup Resend:**

1. Sign up at https://resend.com
2. Get your API key from dashboard
3. Verify your sending domain
4. Update `.env.local` and Vercel environment variables

---

### Required for reCAPTCHA

```bash
# Google reCAPTCHA v3
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
```

**Setup reCAPTCHA:**

1. Go to https://www.google.com/recaptcha/admin
2. Create a new site (reCAPTCHA v3)
3. Add your domains (localhost for dev, your production domain)
4. Copy site key and secret key
5. Update `.env.local` and Vercel environment variables

**Note:** The app works without reCAPTCHA configured, but it's highly recommended for production.

---

### Optional for Production Rate Limiting

```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

**Setup Upstash (Recommended for Production):**

1. Sign up at https://upstash.com
2. Create a new Redis database
3. Copy REST URL and Token
4. Update Vercel environment variables

**Note:** Without Upstash, the app uses in-memory rate limiting which works for development but doesn't scale across serverless functions in production.

---

## 📝 Quick Start for Development

### 1. Install Dependencies

Already done! Packages installed:

- `resend` - Email service
- `react-google-recaptcha-v3` - reCAPTCHA integration
- `@upstash/ratelimit` & `@upstash/redis` - Rate limiting
- `nanoid` - Secure token generation

### 2. Update `.env.local`

```bash
# Copy from .env.example
cp .env.example .env.local

# Add your credentials
# Minimum required:
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=... (optional for dev)
RECAPTCHA_SECRET_KEY=... (optional for dev)
```

### 3. Run Database Migration

The email verification uses the existing `VerificationToken` model from Prisma.

```bash
npx prisma generate
npx prisma db push
```

### 4. Test the Flow

1. Start dev server: `npm run dev`
2. Go to http://localhost:3000/auth/signup
3. Register with a real email
4. Check your email for verification link
5. Click link to verify
6. Sign in with verified account

---

## 🚀 Deployment to Vercel

### 1. Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

**Required:**

```
RESEND_API_KEY
EMAIL_FROM
NEXTAUTH_URL (your production URL)
NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
```

**Recommended:**

```
NEXT_PUBLIC_RECAPTCHA_SITE_KEY
RECAPTCHA_SECRET_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

**Already set (from previous setup):**

```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME
DATABASE_URL
OPENAI_API_KEY
```

### 2. Update EMAIL_FROM

Make sure EMAIL_FROM matches a verified domain in Resend:

```
EMAIL_FROM=noreply@yourdomain.com
```

Or use your Vercel domain:

```
EMAIL_FROM=noreply@your-app.vercel.app
```

### 3. Deploy

```bash
git add .
git commit -m "Add email verification, rate limiting, CAPTCHA, and middleware protection"
git push origin main
```

Vercel will automatically deploy.

### 4. Verify Production Setup

Test these scenarios:

- [ ] Sign up with new email
- [ ] Receive verification email
- [ ] Click verification link
- [ ] Sign in with verified account
- [ ] Try to sign in without verification (should fail)
- [ ] Try rapid registration attempts (rate limit test)
- [ ] Access protected routes without auth (should redirect)

---

## 📋 Feature Breakdown

### Email Verification Flow

1. User registers → Account created (inactive)
2. Verification email sent with 24-hour token
3. User clicks link → Email verified, account activated
4. Welcome email sent
5. User can now sign in

**Files:**

- `/api/auth/register/route.ts` - Registration with email token
- `/api/auth/verify-email/route.ts` - Verification endpoint
- `/auth/verify-email/page.tsx` - Verification page
- `/lib/email/email-service.ts` - Email templates

### Rate Limiting

**Limits:**

- Registration: 5/hour per IP
- Login: 10/15min per IP
- Password Reset: 3/hour per IP
- General API: 100/minute per IP

**How it works:**

- Checks IP address from headers
- Uses Upstash Redis if configured
- Falls back to in-memory for development
- Returns 429 with Retry-After header

**Files:**

- `/lib/rate-limit.ts` - Rate limiting logic

### reCAPTCHA Protection

**Features:**

- reCAPTCHA v3 (invisible, score-based)
- Score threshold: 0.5 (adjustable)
- Graceful degradation if not configured
- Server-side verification

**Files:**

- `/lib/captcha.ts` - CAPTCHA verification
- `/components/providers/RecaptchaProvider.tsx` - React provider

### Middleware Protection

**Protected:**

- All routes except public paths

**Public Paths:**

- `/auth/signin`
- `/auth/signup`
- `/auth/verify-email`
- `/auth/reset-password`
- `/terms`
- `/privacy`

**Files:**

- `/middleware.ts` - NextAuth middleware
- `/lib/auth.ts` - Email verification check

---

## 🔒 Security Best Practices Implemented

✅ **Email Verification** - Prevents fake accounts
✅ **Rate Limiting** - Prevents brute force attacks
✅ **Bot Protection** - Prevents automated abuse
✅ **Middleware Protection** - Secures all routes
✅ **Strong Passwords** - 12+ chars with complexity
✅ **Email Enumeration Prevention** - Generic error messages
✅ **Secure Tokens** - nanoid for cryptographic strength
✅ **Token Expiration** - 24-hour email tokens
✅ **Password Hashing** - bcrypt with 12 rounds
✅ **Last Login Tracking** - Audit trail
✅ **Account Activation** - Manual control

---

## ⚠️ Important Notes

### Development vs Production

**Development (without external services):**

- In-memory rate limiting works
- CAPTCHA gracefully skipped
- Email service required (use Resend dev API key)

**Production (recommended setup):**

- Upstash Redis for rate limiting
- reCAPTCHA v3 configured
- Resend with verified domain
- All environment variables set

### Email Service

**Resend is required** - there's no fallback for email sending. You need at least a free Resend account for development.

**Free Tier:**

- 3,000 emails/month
- 100 emails/day
- Perfect for development and small production

### reCAPTCHA

**Optional but recommended** - the app works without it by logging a warning and allowing the request. For production, you should configure it.

### Rate Limiting

**Works without Upstash** using in-memory storage, but this doesn't work across multiple serverless function instances in production. For production with Vercel, use Upstash.

---

## 🐛 Troubleshooting

### Emails not sending

1. Check RESEND_API_KEY is set correctly
2. Verify EMAIL_FROM domain in Resend dashboard
3. Check Resend API logs
4. Look at server logs for errors

### reCAPTCHA errors

1. Verify both SITE_KEY and SECRET_KEY are set
2. Check domain is added in reCAPTCHA admin
3. For localhost, ensure localhost is in allowed domains
4. Check browser console for client-side errors

### Rate limiting not working

1. For development, in-memory works
2. For production, verify Upstash credentials
3. Check Upstash Redis logs
4. Verify IP detection (check x-forwarded-for header)

### Middleware redirect loop

1. Check `/auth/signin` is in public paths
2. Verify NEXTAUTH_URL is correct
3. Check NEXTAUTH_SECRET is set
4. Clear browser cookies and try again

---

## 📚 Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Google reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [Upstash Redis Documentation](https://upstash.com/docs/redis)
- [NextAuth.js Middleware](https://next-auth.js.org/configuration/nextjs#middleware)

---

## ✨ Next Steps

Now that critical security is in place, you can:

1. **Test thoroughly** in development
2. **Set up production services** (Resend, reCAPTCHA, Upstash)
3. **Deploy to Vercel**
4. **Create Terms of Service and Privacy Policy pages**
5. **Implement password reset flow** (foundation is ready)
6. **Add Two-Factor Authentication** (database schema ready)
7. **Set up monitoring and alerts**

---

**Status**: ✅ Production Ready (with proper environment variables)
**Last Updated**: September 30, 2025

Your authentication system is now secure and production-ready! 🎉
