import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

// Pastikan pemanggil adalah admin yang sedang login
async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Tidak terautentikasi", status: 401 }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: "Hanya admin yang boleh mengelola pengguna", status: 403 }
  }
  return { userId: user.id }
}

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diatur di .env.local (ambil dari Supabase Dashboard > Settings > API)"
    )
  }
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET: daftar semua pengguna (auth + profil)
export async function GET() {
  const guard = await requireAdmin()
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const admin = getAdminClient()
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (authErr) throw authErr

    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, full_name, role, phone_number, address, updated_at")
    if (profErr) throw profErr

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
    const users = authData.users.map((u) => {
      const p = profileMap.get(u.id)
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: p?.full_name || "",
        role: p?.role || "customer",
        phone_number: p?.phone_number || "",
      }
    })

    return NextResponse.json({ users })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: buat pengguna baru
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const { email, password, full_name, phone_number, role } = await req.json()
    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: "Email, password, nama lengkap, dan role wajib diisi" },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone_number: phone_number || "" },
    })
    if (error) throw error

    // Trigger handle_new_user membuat profil dengan role 'customer';
    // set role sesuai pilihan admin
    if (role !== "customer") {
      const { error: roleErr } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", data.user.id)
      if (roleErr) throw roleErr
    }

    return NextResponse.json({ user: data.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH: perbarui profil / role / password pengguna
export async function PATCH(req: Request) {
  const guard = await requireAdmin()
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const { id, full_name, phone_number, role, password } = await req.json()
    if (!id) return NextResponse.json({ error: "ID pengguna wajib diisi" }, { status: 400 })

    if (id === guard.userId && role && role !== "admin") {
      return NextResponse.json(
        { error: "Anda tidak dapat menurunkan role akun sendiri" },
        { status: 400 }
      )
    }

    const admin = getAdminClient()

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 })
      }
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password })
      if (pwErr) throw pwErr
    }

    const updates: Record<string, any> = {}
    if (full_name !== undefined) updates.full_name = full_name
    if (phone_number !== undefined) updates.phone_number = phone_number
    if (role !== undefined) updates.role = role
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      const { error: profErr } = await admin.from("profiles").update(updates).eq("id", id)
      if (profErr) throw profErr
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: hapus pengguna
export async function DELETE(req: Request) {
  const guard = await requireAdmin()
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "ID pengguna wajib diisi" }, { status: 400 })
    if (id === guard.userId) {
      return NextResponse.json({ error: "Anda tidak dapat menghapus akun sendiri" }, { status: 400 })
    }

    const admin = getAdminClient()
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
