import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Magic-link phiên tập — hằng số inline (KHÔNG import lib/workout-token vào đây:
// nó dùng node `crypto`, sẽ vỡ edge bundle của proxy). Việc verify chữ ký HMAC +
// chặn path khác do (dashboard)/layout.tsx (Node runtime) đảm nhận. Proxy chỉ
// quyết định "cho đi tiếp tới layout" vs "đá về /login".
const WORKOUT_COOKIE_NAME = 'bodix_workout_token'
const WORKOUT_TOKEN_PATHS = ['/app/program/workout', '/app/trial/workout']
const isWorkoutTokenPath = (p: string) =>
  WORKOUT_TOKEN_PATHS.some((x) => p.startsWith(x))

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // x-pathname để Server Component layout biết path hiện tại.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  let response = NextResponse.next({
    request: { headers: requestHeaders },
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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /app/* cần đăng nhập — KHÔNG CHECK ONBOARDING
  if (pathname.startsWith('/app') || pathname.startsWith('/admin')) {
    if (!user) {
      // Magic-link: chỉ ROUTE WORKOUT + có cookie workout-token mới được đi tiếp
      // (layout sẽ verify chữ ký). /admin KHÔNG bao giờ. Mọi path khác → /login.
      if (
        !pathname.startsWith('/admin') &&
        isWorkoutTokenPath(pathname) &&
        request.cookies.get(WORKOUT_COOKIE_NAME)?.value
      ) {
        return response
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // /login, /signup: đã đăng nhập thì đi /app
  if (pathname === '/login' || pathname === '/signup') {
    if (user) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return response
  }

  // /onboarding: cần đăng nhập — KHÔNG CHECK ONBOARDING
  if (pathname.startsWith('/onboarding')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  return response
}

export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/onboarding/:path*',
  ],
}
