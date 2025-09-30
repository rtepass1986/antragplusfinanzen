import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (token && path.startsWith('/auth/signin')) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // You can add more custom middleware logic here
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
          '/auth/forgot-password',
          '/auth/accept-invitation',
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
    pages: {
      signIn: '/auth/signin', // Redirect to this page when unauthorized
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
