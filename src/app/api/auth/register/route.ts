import { validateCaptchaToken, verifyCaptcha } from '@/lib/captcha';
import { emailService } from '@/lib/email/email-service';
import { prisma } from '@/lib/prisma';
import {
  checkRateLimit,
  getClientIdentifier,
  registrationLimiter,
} from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting - Check before processing anything
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(
      registrationLimiter,
      `register:${identifier}`
    );

    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    const { name, email, password, companyName, captchaToken } =
      await request.json();

    // 2. Validate required fields
    if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // 3. Verify CAPTCHA (if configured)
    if (process.env.RECAPTCHA_SECRET_KEY) {
      if (!validateCaptchaToken(captchaToken)) {
        return NextResponse.json(
          { error: 'Invalid captcha token' },
          { status: 400 }
        );
      }

      const captchaValid = await verifyCaptcha(captchaToken);
      if (!captchaValid) {
        return NextResponse.json(
          { error: 'Captcha verification failed. Please try again.' },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 4. Validate password strength (enhanced requirements)
    if (password.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters long' },
        { status: 400 }
      );
    }

    // Check password complexity
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          error:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        },
        { status: 400 }
      );
    }

    // 5. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Don't reveal if email exists (prevent email enumeration)
      return NextResponse.json(
        {
          message:
            'If this email is valid, you will receive a verification email shortly.',
        },
        { status: 200 }
      );
    }

    // 6. Generate email verification token
    const verificationToken = nanoid(32);
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry

    // 7. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 8. Create user and company in a transaction
    const result = await prisma.$transaction(async tx => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: companyName,
          email: email,
          isActive: true,
        },
      });

      // Create user (email not verified yet)
      const user = await tx.user.create({
        data: {
          name,
          email,
          hashedPassword,
          role: 'ADMIN', // First user becomes admin
          isActive: false, // Inactive until email verified
          emailVerified: null, // Not verified yet
        },
      });

      // Create user-company relationship
      await tx.userCompany.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: 'OWNER', // First user becomes owner
          isActive: true,
        },
      });

      // Create default permissions for the owner
      const permissions = await tx.permission.findMany({
        where: {
          OR: [
            { resource: 'invoices' },
            { resource: 'users' },
            { resource: 'reports' },
            { resource: 'settings' },
            { resource: 'company' },
          ],
        },
      });

      // Grant all permissions to the owner
      for (const permission of permissions) {
        await tx.userPermission.create({
          data: {
            userId: user.id,
            companyId: company.id,
            permissionId: permission.id,
            granted: true,
            grantedBy: user.id,
          },
        });
      }

      // Store verification token
      await tx.verificationToken.create({
        data: {
          identifier: user.email,
          token: verificationToken,
          expires: verificationExpires,
        },
      });

      return { user, company };
    });

    // 9. Send verification email (don't wait for it)
    emailService
      .sendVerificationEmail(
        result.user.email!,
        verificationToken,
        result.user.name || 'User'
      )
      .catch(error => {
        console.error('Failed to send verification email:', error);
        // Don't fail the registration if email fails
      });

    // 10. Log the registration
    await prisma.auditLog.create({
      data: {
        companyId: result.company.id,
        userId: result.user.id,
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: result.user.id,
        newValue: {
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          emailVerified: false,
        },
      },
    });

    return NextResponse.json(
      {
        message:
          'Registration successful! Please check your email to verify your account.',
        requiresVerification: true,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
