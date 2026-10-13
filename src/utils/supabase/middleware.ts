import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const isAuthPage = ["/admin/login", "/admin/recovery"].includes(request.nextUrl.pathname);
  // Guard: if env vars are missing, skip session update silently
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (request.nextUrl.pathname.startsWith('/admin') && !isAuthPage) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const adminEmail = (
    process.env.ADMIN_EMAIL || ""
  ).toLowerCase().trim();

  const isAuthorizedAdmin =
    Boolean(user && user.email_confirmed_at && adminEmail) && user?.email?.toLowerCase().trim() === adminEmail;

  if (
    !isAuthorizedAdmin &&
    request.nextUrl.pathname.startsWith('/admin') &&
    !isAuthPage
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  const assurance = isAuthorizedAdmin && request.nextUrl.pathname === '/admin/login'
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel() : null;
  if (isAuthorizedAdmin && request.nextUrl.pathname === '/admin/login' &&
      !assurance?.error && assurance?.data?.currentLevel === 'aal2') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
