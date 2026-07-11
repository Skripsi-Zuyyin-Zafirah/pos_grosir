"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { IconLoader2, IconLock, IconMail, IconUser, IconAlertCircle, IconPhone, IconArrowLeft } from "@tabler/icons-react"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/"

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value)
    if (password && value && value !== password) {
      setConfirmPasswordError("Password tidak sama")
    } else {
      setConfirmPasswordError(null)
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError("Password tidak sama")
    } else {
      setConfirmPasswordError(null)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirmPassword) {
      setConfirmPasswordError("Password tidak sama")
      return
    }

    setLoading(true)

    try {
      const signUpResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          data: {
            full_name: fullName,
            phone,
            phone_number: phone,
            role: "customer",
          },
        }),
      })

      const data = await signUpResponse.json().catch(() => null)

      if (!signUpResponse.ok) {
        let rawMsg = "Supabase Auth mengembalikan error server tanpa detail. Periksa trigger signup database."
        if (data && typeof data === "object") {
          const body = data as Record<string, unknown>
          rawMsg = String(body.msg || body.message || body.error_description || body.error || rawMsg)
        }

        let msg = rawMsg
        const lowerMsg = rawMsg.toLowerCase()

        if (lowerMsg.includes("user already registered") || lowerMsg.includes("already been registered")) {
          msg = "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain."
        } else if (lowerMsg.includes("invalid email")) {
          msg = "Format email tidak valid."
        } else if (lowerMsg.includes("weak password") || lowerMsg.includes("password should be")) {
          msg = "Password terlalu lemah. Gunakan minimal 6 karakter."
        } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("email rate limit exceeded")) {
          msg = "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi."
        } else if (lowerMsg.includes("signup is disabled")) {
          msg = "Pendaftaran akun saat ini tidak tersedia. Hubungi administrator."
        } else if (lowerMsg.includes("database error") || lowerMsg.includes("db error")) {
          // Error database trigger (misal: trigger handle_new_user gagal)
          msg = `Gagal menyimpan data pengguna ke database. Detail: ${rawMsg}`
        } else if (signUpResponse.status === 422) {
          msg = `Data tidak valid (422): ${rawMsg}`
        } else if (signUpResponse.status === 429) {
          msg = "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi."
        } else if (signUpResponse.status >= 500) {
          msg = `Kesalahan server (${signUpResponse.status}): ${rawMsg}`
        }

        setErrorMsg(msg)
        toast.error(msg)
        return
      }

      // Cek apakah user berhasil dibuat atau perlu konfirmasi email
      if (data?.user && !data.user.confirmed_at && data.user.identities?.length === 0) {
        // Email sudah terdaftar tapi belum dikonfirmasi / sudah ada
        const msg = "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain."
        setErrorMsg(msg)
        toast.error(msg)
        return
      }

      toast.success("Registrasi berhasil! Silakan masuk.")
      router.push(`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`)
    } catch (err: unknown) {
      let msg = "Terjadi kesalahan tidak terduga saat mendaftar."
      if (err instanceof Error) {
        msg = err.message || msg
      } else if (typeof err === "object" && err !== null) {
        const anyErr = err as Record<string, unknown>
        if (typeof anyErr.message === "string" && anyErr.message) {
          msg = anyErr.message
        } else if (typeof anyErr.error_description === "string") {
          msg = anyErr.error_description
        } else {
          msg = `Error tidak diketahui: ${JSON.stringify(err)}`
        }
      }
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center px-4 py-12 bg-radial from-background via-muted/50 to-muted">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      <Card className="w-full max-w-md border-border/50 shadow-2xl backdrop-blur-sm bg-background/95">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="text-xl font-bold tracking-wider">PG</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Daftar Akun</CardTitle>
          <CardDescription>
            Buat akun baru untuk mulai berbelanja grosir
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <IconAlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Nama Lengkap */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <div className="relative">
                <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Nomor Telepon */}
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor Telepon</Label>
              <div className="relative">
                <IconPhone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Konfirmasi Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <div className="relative">
                <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  className={`pl-9 ${confirmPasswordError ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                  required
                  disabled={loading}
                />
              </div>
              {confirmPasswordError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <IconAlertCircle className="size-3.5 shrink-0" />
                  {confirmPasswordError}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading || !!confirmPasswordError}>
              {loading ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mendaftar...
                </>
              ) : (
                "Daftar"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 text-center text-sm text-muted-foreground">
          <div>
            Sudah memiliki akun?{" "}
            <Link
              href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Masuk
            </Link>
          </div>
          <Link
            href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft className="size-4" />
            Kembali ke Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center bg-radial from-background via-muted/50 to-muted">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
