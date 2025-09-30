# Production Security Checklist - Registration/Authentication

## 🚨 CRITICAL - Must Fix Before Production

### 1. Email Verification System

**Status**: ❌ Not Implemented
**Priority**: CRITICAL

**What to do:**

- [ ] Create email verification token on registration
- [ ] Send verification email with unique link
- [ ] Create `/auth/verify-email` page
- [ ] Block login until email is verified (or allow with warning)
- [ ] Add resend verification email functionality
- [ ] Set `emailVerified` timestamp on verification

**Files to modify:**

- `src/app/api/auth/register/route.ts` - Add token generation
- Create `src/app/api/auth/verify-email/route.ts`
- Create `src/app/auth/verify-email/page.tsx`
- `src/lib/auth.ts` - Check emailVerified in authorize()

**Email Service Options:**

- Resend (https://resend.com) - Modern, developer-friendly
- SendGrid - Enterprise-grade
- AWS SES - If already using AWS
- Postmark - Transactional emails

---

### 2. Rate Limiting

**Status**: ❌ Not Implemented
**Priority**: CRITICAL

**What to do:**

- [ ] Install rate limiting library: `npm install @upstash/ratelimit @upstash/redis`
- [ ] Add rate limiting to registration endpoint (5 requests per hour per IP)
- [ ] Add rate limiting to login endpoint (10 requests per hour per IP)
- [ ] Add rate limiting to password reset (3 requests per hour per email)
- [ ] Return 429 (Too Many Requests) with retry-after header

**Example Implementation:**

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 h'),
});

// In route handler
const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
const { success } = await ratelimit.limit(identifier);
if (!success) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 }
  );
}
```

**Alternative (Vercel):** Use Vercel's built-in rate limiting

---

### 3. Bot Protection

**Status**: ❌ Not Implemented
**Priority**: CRITICAL

**What to do:**

- [ ] Add reCAPTCHA v3 or hCaptcha
- [ ] Install: `npm install react-google-recaptcha-v3`
- [ ] Get reCAPTCHA keys from Google
- [ ] Add to signup form
- [ ] Verify token on backend

**Files to modify:**

- `src/app/auth/signup/page.tsx` - Add CAPTCHA component
- `src/app/api/auth/register/route.ts` - Verify CAPTCHA token
- `.env.example` - Add RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY

---

### 4. Enable Middleware Protection

**Status**: ⚠️ DISABLED
**Priority**: CRITICAL

**What to do:**

- [ ] Enable authentication middleware
- [ ] Protect all authenticated routes
- [ ] Add proper redirects to login
- [ ] Handle public vs protected routes

**Fix src/middleware.ts:**

```typescript
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add custom middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Protect all routes except auth pages
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

### 5. Google OAuth Configuration

**Status**: ❌ Not Configured
**Priority**: HIGH

**What to do:**

- [ ] Create Google Cloud project
- [ ] Enable Google OAuth 2.0
- [ ] Get Client ID and Client Secret
- [ ] Add to .env.local and Vercel environment variables
- [ ] Add authorized redirect URIs
- [ ] Test Google sign-up flow
- [ ] OR: Remove Google button from UI if not using

**Environment Variables Needed:**

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

### 6. Password Strength Requirements

**Status**: ⚠️ WEAK
**Priority**: HIGH

**Current:** Only 8 characters minimum
**Recommended:** 12+ chars with complexity

**What to do:**

- [ ] Increase minimum to 12 characters
- [ ] Require at least one uppercase letter
- [ ] Require at least one number
- [ ] Require at least one special character
- [ ] Use password strength library (zxcvbn)
- [ ] Show password strength meter to users

**Files to modify:**

- `src/app/auth/signup/page.tsx` - Add strength validation
- `src/app/api/auth/register/route.ts` - Server-side validation

**Example:**

```typescript
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
if (!passwordRegex.test(password)) {
  return NextResponse.json(
    {
      error:
        'Password must be 12+ chars with uppercase, number, and special char',
    },
    { status: 400 }
  );
}
```

---

### 7. Account Lockout Protection

**Status**: ❌ Not Implemented
**Priority**: HIGH

**What to do:**

- [ ] Track failed login attempts in database
- [ ] Lock account after 5 failed attempts
- [ ] Require email verification or waiting period to unlock
- [ ] Log suspicious activity
- [ ] Notify user of failed attempts

**Database Changes:**
Add to User model:

```prisma
failedLoginAttempts Int      @default(0)
lockedUntil         DateTime?
```

---

### 8. Create Legal Pages

**Status**: ❌ Missing
**Priority**: HIGH (Legal Requirement)

**What to do:**

- [ ] Create Terms of Service page (`/app/terms/page.tsx`)
- [ ] Create Privacy Policy page (`/app/privacy/page.tsx`)
- [ ] Consult legal team for content
- [ ] Add GDPR compliance notices
- [ ] Add cookie consent banner
- [ ] Update signup form links

**Legal Considerations:**

- GDPR (EU users)
- CCPA (California users)
- Data retention policies
- Right to deletion
- Data export capabilities

---

## 🔒 RECOMMENDED - Security Enhancements

### 9. Prevent Email Enumeration

**Status**: ⚠️ Vulnerable
**Priority**: MEDIUM

**Current Issue:**

```typescript
if (existingUser) {
  return NextResponse.json(
    { error: 'User with this email already exists' },
    { status: 409 }
  );
}
```

**Fix:** Return generic message

```typescript
if (existingUser) {
  // Don't reveal if email exists
  return NextResponse.json(
    { error: 'If this email is valid, you will receive a confirmation email' },
    { status: 200 }
  );
}
```

---

### 10. Add Security Headers

**Status**: ❌ Not Implemented
**Priority**: MEDIUM

**What to do:**

- [ ] Add security headers in `next.config.ts`
- [ ] CSP (Content Security Policy)
- [ ] HSTS (HTTP Strict Transport Security)
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options

**Add to next.config.ts:**

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};
```

---

### 11. Session Management

**Status**: ⚠️ Basic
**Priority**: MEDIUM

**What to do:**

- [ ] Configure session expiration (currently JWT, no expiry set)
- [ ] Add session refresh mechanism
- [ ] Implement "Remember Me" functionality
- [ ] Add ability to view/revoke active sessions
- [ ] Track login locations/devices

---

### 12. Two-Factor Authentication (2FA)

**Status**: ❌ Schema exists, not implemented
**Priority**: MEDIUM (Future enhancement)

**Database supports it:**

```prisma
twoFactorEnabled Boolean @default(false)
twoFactorSecret String?
```

**What to do:**

- [ ] Implement TOTP (Time-based One-Time Password)
- [ ] Use library like `otplib`
- [ ] Add 2FA setup flow in settings
- [ ] Add 2FA verification on login
- [ ] Provide backup codes

---

### 13. Password Reset Flow

**Status**: ❌ Schema exists, not implemented
**Priority**: MEDIUM

**Database supports it:**

```prisma
passwordResetToken String?
passwordResetExpires DateTime?
```

**What to do:**

- [ ] Create "Forgot Password" page
- [ ] Generate secure reset tokens
- [ ] Send reset email
- [ ] Create reset password page
- [ ] Expire tokens after 1 hour
- [ ] Invalidate token after use

---

### 14. Audit Logging Enhancement

**Status**: ✅ Basic implementation
**Priority**: LOW

**Currently logs:** Registration events
**Should also log:**

- [ ] Login attempts (successful and failed)
- [ ] Password changes
- [ ] Email changes
- [ ] 2FA enable/disable
- [ ] Session creation/destruction
- [ ] Suspicious activities

---

## 🎯 Deployment Checklist

Before deploying to production:

- [ ] All CRITICAL items completed
- [ ] All HIGH priority items completed
- [ ] Email verification tested
- [ ] Rate limiting tested
- [ ] Security headers verified
- [ ] Legal pages reviewed by legal team
- [ ] Privacy policy compliant with GDPR/CCPA
- [ ] All environment variables set in Vercel
- [ ] Test registrations from different IPs
- [ ] Test account lockout mechanism
- [ ] Penetration testing completed
- [ ] Security audit performed

---

## 📚 Resources

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [GDPR Compliance Guide](https://gdpr.eu/)
- [Vercel Security Best Practices](https://vercel.com/docs/security)

---

## ⏱️ Estimated Implementation Time

- **Critical Items (1-4):** 2-3 days
- **High Priority (5-8):** 2-3 days
- **Medium Priority (9-14):** 3-5 days

**Total:** 7-11 days for full production readiness

---

**Status**: ❌ NOT PRODUCTION READY
**Required Work**: CRITICAL issues must be resolved before deploying to production

Last Updated: September 30, 2025
