import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session (required by @supabase/ssr — must call getUser())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // /app/* and /admin/* require authentication
  if (pathname.startsWith('/app') || pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // /onboarding requires authentication (but authenticated users stay here — no redirect to /app)
  if (pathname.startsWith('/onboarding')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // /login and /signup: redirect authenticated users to the dashboard
  if (pathname === '/login' || pathname === '/signup') {
    if (user) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return response
  }

  // All other routes (homepage, landing pages, /p/*, /r/*): allow freely
  return response
}

// Only run on routes that need auth checks
export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/onboarding/:path*',
    '/onboarding',
  ],
}
