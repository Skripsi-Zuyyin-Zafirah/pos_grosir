import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ─── Tipe Role ─────────────────────────────────────────────────────────────────
type UserRole = 'admin' | 'cashier' | 'customer'

// ─── Aturan Akses Route ────────────────────────────────────────────────────────
//
// Peta akses:
//  /login, /register       → Hanya untuk tamu (belum login)
//  /dashboard/**           → admin, cashier
//  /dashboard/products/**  → admin saja
//  /dashboard/picking-time → admin saja
//  /dashboard/reports      → admin saja
//  /dashboard/settings     → admin saja
//  /dashboard/queue        → admin, cashier
//  /dashboard/cashier      → admin, cashier
//  /customer/**            → customer saja
//  /profile                → semua yang sudah login
//
// ──────────────────────────────────────────────────────────────────────────────

const DASHBOARD_ADMIN_ONLY_ROUTES = [
  '/dashboard/products',
  '/dashboard/picking-time',
  '/dashboard/reports',
  '/dashboard/settings',
]

function redirectTo(url: string, request: NextRequest) {
  return NextResponse.redirect(new URL(url, request.url))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Tentukan grup route
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isCustomerRoute = pathname.startsWith('/customer')
  const isProfileRoute = pathname === '/profile'
  const isAdminOnlyRoute = DASHBOARD_ADMIN_ONLY_ROUTES.some((r) =>
    pathname.startsWith(r)
  )

  // Buat response dasar agar cookie Supabase bisa di-refresh
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Ambil sesi user — getUser() lebih aman dari getSession() di server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log(`[Middleware] Pathname: ${pathname}, User ID: ${user?.id || 'Tamu'}`)

  // ── TAMU (belum login) ──────────────────────────────────────────────────────
  if (!user) {
    if (isDashboardRoute || isCustomerRoute || isProfileRoute) {
      console.log(`[Middleware] Tamu mencoba mengakses rute terproteksi. Redirect ke /login`)
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    // Izinkan akses ke /login, /register, dan rute publik
    return supabaseResponse
  }

  // ── TERAUTENTIKASI — ambil role ─────────────────────────────────────────────
  let role: UserRole = 'customer'
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.warn(`[Middleware] Gagal mengambil profile untuk user ${user.id}: ${profileError.message}`)
    }

    // Gunakan metadata user sebagai fallback jika query ke public.profiles gagal (misal karena RLS)
    const metadataRole = user.user_metadata?.role || user.app_metadata?.role
    role = (profile?.role as UserRole) || (metadataRole as UserRole) || 'customer'
    console.log(`[Middleware] User: ${user.id}, DB Role: ${profile?.role || 'null'}, Meta Role: ${metadataRole || 'null'}, Selected Role: ${role}`)
  } catch (err: any) {
    console.error(`[Middleware] Error mengambil data role:`, err)
    const metadataRole = user.user_metadata?.role || user.app_metadata?.role
    role = (metadataRole as UserRole) || 'customer'
  }

  // Jika sudah login dan mencoba akses /login atau /register → redirect sesuai role
  if (isAuthRoute) {
    console.log(`[Middleware] User sudah login dengan role ${role}. Redirect ke halaman yang sesuai.`)
    if (role === 'admin' || role === 'cashier') {
      return redirectTo('/dashboard', request)
    }
    return redirectTo('/customer', request)
  }

  // ── PROTEKSI DASHBOARD ─────────────────────────────────────────────────────
  if (isDashboardRoute) {
    // Customer tidak boleh akses dashboard sama sekali
    if (role === 'customer') {
      return redirectTo('/customer', request)
    }

    // Sub-route yang hanya boleh diakses admin
    if (isAdminOnlyRoute && role !== 'admin') {
      // Cashier diarahkan ke halaman yang boleh mereka akses
      return redirectTo('/dashboard/queue', request)
    }
  }

  // ── PROTEKSI AREA CUSTOMER ─────────────────────────────────────────────────
  if (isCustomerRoute) {
    // Admin dan cashier tidak boleh akses area customer
    if (role === 'admin' || role === 'cashier') {
      return redirectTo('/dashboard', request)
    }
  }

  // Izinkan akses — semua kondisi lolos
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua path request kecuali:
     * - _next/static (berkas statis)
     * - _next/image (optimasi gambar)
     * - favicon.ico
     * - Berkas gambar (svg, png, jpg, dll.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
