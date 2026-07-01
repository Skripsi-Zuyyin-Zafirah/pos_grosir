"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconUser, IconMail, IconShield, IconDeviceFloppy } from "@tabler/icons-react"

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState("")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("")

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        toast.error("Sesi tidak ditemukan. Silakan login kembali.")
        return
      }

      setUserId(session.user.id)
      setEmail(session.user.email || "")

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (error) throw error

      if (profile) {
        setFullName(profile.full_name || "")
        setRole(profile.role || "")
      }
    } catch (err: any) {
      toast.error("Gagal memuat profil: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong")
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)

      if (error) throw error
      toast.success("Profil berhasil diperbarui!")
      routerRefresh()
    } catch (err: any) {
      toast.error("Gagal menyimpan profil: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const routerRefresh = () => {
    // Refresh to update header/sidebar user data
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  const formatRole = (roleStr: string) => {
    switch (roleStr) {
      case "admin":
        return "Administrator"
      case "kasir":
        return "Kasir Gudang / POS"
      case "pelanggan":
        return "Pelanggan Grosir"
      default:
        return roleStr ? roleStr.toUpperCase() : "-"
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profil Saya</h1>
            <p className="text-muted-foreground mt-1">
              Kelola informasi profil pribadi dan pengaturan akun POS Anda.
            </p>
          </div>

          <div className="max-w-2xl">
            {loading ? (
              <Card className="border-border/50 shadow-md">
                <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat informasi profil...</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconUser className="size-5 text-primary" /> Detail Akun Pengguna
                  </CardTitle>
                  <CardDescription>Perbarui nama akun Anda di bawah ini.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    {/* E-mail (Read-only) */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-1.5">
                        <IconMail className="size-4 text-muted-foreground" /> E-mail Akun
                      </Label>
                      <Input
                        id="email"
                        value={email}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                      />
                    </div>

                    {/* Role (Read-only) */}
                    <div className="space-y-2">
                      <Label htmlFor="role" className="flex items-center gap-1.5">
                        <IconShield className="size-4 text-muted-foreground" /> Hak Akses / Peran
                      </Label>
                      <Input
                        id="role"
                        value={formatRole(role)}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed font-semibold"
                      />
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="flex items-center gap-1.5">
                        <IconUser className="size-4 text-primary" /> Nama Lengkap
                      </Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        disabled={submitting}
                        placeholder="Masukkan nama lengkap Anda"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button type="submit" disabled={submitting} className="font-semibold text-xs">
                      {submitting ? (
                        <>
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <IconDeviceFloppy className="mr-2 size-4" />
                          Simpan Perubahan
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
