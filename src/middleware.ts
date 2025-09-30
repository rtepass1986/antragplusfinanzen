import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // You can add custom middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;

        // Public paths that don't require authentication
        const publicPaths = [
          '/auth/signin',
          '/auth/signup',
          '/auth/verify-email',
          '/auth/reset-password',
          '/terms',
          '/privacy',
        ];

        // Check if the current path is public
        if (publicPaths.some(publicPath => path.startsWith(publicPath))) {
          return true;
        }

        // All other paths require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
