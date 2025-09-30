import LayoutWrapper from '@/components/layout/LayoutWrapper';
import { RecaptchaProvider } from '@/components/providers/RecaptchaProvider';
import SessionProvider from '@/components/providers/SessionProvider';
import type { Metadata } from 'next';
import { Inter, Lexend } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
});

export const metadata: Metadata = {
  title: 'FinTech SaaS - Invoice & Cash Flow Management',
  description:
    'Professional financial management platform with DATEV export capabilities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.variable} ${lexend.variable} h-full scroll-smooth bg-white antialiased`}
      >
        <RecaptchaProvider>
          <SessionProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </SessionProvider>
        </RecaptchaProvider>
      </body>
    </html>
  );
}
