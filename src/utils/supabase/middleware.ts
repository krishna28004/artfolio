import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/shared/services/supabase-admin'

export async function updateSession(request: NextRequest) {
  // Guard: if env vars are missing, skip session update silently
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
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

  if (request.nextUrl.pathname.startsWith('/admin') && request.nextUrl.pathname !== '/admin/login') {
    let permitted = Boolean(user?.email_confirmed_at && adminEmail &&
      user?.email?.toLowerCase().trim() === adminEmail);
    if (permitted && user) {
      try {
        const [{ data: assurance }, { data: verifiedClaims }] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.getClaims(),
        ]);
        const claims = verifiedClaims?.claims;
        const sessionId = claims?.session_id;
        permitted = assurance?.currentLevel === 'aal2' && claims?.aal === 'aal2' && claims?.sub === user.id &&
          typeof sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
        if (permitted && typeof sessionId === 'string') {
          const admin = getSupabaseAdmin();
          const [{ data: active, error: activeError }, { data: alert, error: alertError }] = await Promise.all([
            admin.rpc('is_owner_session_active', { p_session_id: sessionId, p_user_id: user.id }),
            admin.from('owner_login_alerts').select('session_id').eq('session_id', sessionId)
              .eq('user_id', user.id).maybeSingle(),
          ]);
          permitted = !activeError && active === true && !alertError && !!alert;
        }
      } catch {
        permitted = false;
      }
    }
    if (!permitted) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = ''
      return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    supabaseResponse.headers.set('Cache-Control', 'private, no-store')
  }

  return supabaseResponse
}
