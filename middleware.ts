import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_MARKETING_ROUTES = ['/', '/bodix-21', '/bodix-6w', '/bodix-12w']
const AUTH_ROUTES = ['/login', '/signup', '/onboarding']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Marketing & public referral/affiliate landing pages — always allow
  if (PUBLIC_MARKETING_ROUTES.includes(pathname)) {
    return await updateSession(request)
  }

  // Refresh session tokens on every request (required by @supabase/ssr)
  const response = await updateSession(request)

  // Read the user from the refreshed session cookie (no network call — JWT is local)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Read-only copy — cookie writes are handled by updateSession above
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute  = AUTH_ROUTES.some((r) => pathname.startsWith(r))
  const isAppRoute   = pathname.startsWith('/app')
  const isAdminRoute = pathname.startsWith('/admin')

  // Authenticated user hitting /login or /signup → send to app
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  // Unauthenticated user hitting any protected route → /login
  // /app/*   — dashboard & program routes
  // /admin/* — admin-only routes (role check handled by AdminLayout + verifyAdmin())
  if ((isAppRoute || isAdminRoute) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname) // preserve intended destination
    return NextResponse.redirect(loginUrl)
  }

  // Security headers on every response
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, images, svgs
     * - auth/callback (Supabase OAuth redirect)
     * - api/webhooks (payment webhooks must not be blocked)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.svg|auth/callback|api/webhooks).*)',
  ],
}
