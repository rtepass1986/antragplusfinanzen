import { emailService } from '@/lib/email/email-service';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (new Date() > verificationToken.expires) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { token },
      });

      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Find and update the user
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email already verified', alreadyVerified: true },
        { status: 200 }
      );
    }

    // Update user to mark as verified and active
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        isActive: true,
      },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { token },
    });

    // Log the verification
    const userCompany = await prisma.userCompany.findFirst({
      where: { userId: user.id },
    });

    if (userCompany) {
      await prisma.auditLog.create({
        data: {
          companyId: userCompany.companyId,
          userId: user.id,
          action: 'EMAIL_VERIFIED',
          entity: 'User',
          entityId: user.id,
        },
      });
    }

    // Send welcome email (non-blocking)
    emailService
      .sendWelcomeEmail(user.email!, user.name || 'User')
      .catch(error => {
        console.error('Failed to send welcome email:', error);
      });

    return NextResponse.json(
      {
        message: 'Email verified successfully!',
        verified: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json(
        { message: 'If this email exists, a verification email will be sent.' },
        { status: 200 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // Delete old tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Generate new token
    const { nanoid } = await import('nanoid');
    const token = nanoid(32);
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, token, user.name || 'User');

    return NextResponse.json(
      { message: 'Verification email sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}
