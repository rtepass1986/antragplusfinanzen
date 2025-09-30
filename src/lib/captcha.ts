/**
 * Server-side reCAPTCHA verification
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // If no secret key is configured, skip verification in development
  if (!secretKey) {
    console.warn('RECAPTCHA_SECRET_KEY not configured, skipping verification');
    return true; // Allow in development without reCAPTCHA
  }

  try {
    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secretKey}&response=${token}`,
      }
    );

    const data = await response.json();

    // For reCAPTCHA v3, check score (0.0 to 1.0, higher is better)
    if (data.success && data.score !== undefined) {
      // Require score of 0.5 or higher (you can adjust this threshold)
      return data.score >= 0.5;
    }

    // For reCAPTCHA v2, just check success
    return data.success === true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    // In case of error, we might want to fail closed (return false)
    // Or fail open (return true) depending on your security requirements
    return false; // Fail closed - reject on error
  }
}

/**
 * Validate that a captcha token is present
 */
export function validateCaptchaToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 0;
}
