"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { IconLoader2, IconLock, IconMail, IconAlertCircle, IconArrowLeft, IconEye, IconEyeOff } from "@tabler/icons-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const next = searchParams.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        toast.error(error.message)
        return
      }

      toast.success("Login berhasil!")

      // Fetch user profile to redirect correctly based on role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      const role = profile?.role || "customer"

      if (role === "admin" || role === "cashier") {
        router.push("/dashboard")
      } else {
        router.push(next)
      }
      router.refresh()
    } catch (err: any) {
      const msg = err.message || "Terjadi kesalahan"
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
          <CardTitle className="text-2xl font-bold tracking-tight">POS Grosir</CardTitle>
          <CardDescription>
            Masuk ke akun Anda untuk melanjutkan transaksi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <IconAlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <IconMail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <IconLock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-8 pr-8"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 text-center text-sm text-muted-foreground">
          <div>
            Belum punya akun?{" "}
            <Link
              href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Daftar Sekarang
            </Link>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <Link href="/">
              <IconArrowLeft className="size-4 mr-1.5" /> Kembali ke Beranda
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center bg-radial from-background via-muted/50 to-muted">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
