"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  IconLoader2,
  IconUser,
  IconMail,
  IconShield,
  IconDeviceFloppy,
  IconPhone,
  IconMapPin,
  IconLock,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  // Loading states
  const [loading, setLoading] = useState(true)
  const [submittingInfo, setSubmittingInfo] = useState(false)
  const [submittingPassword, setSubmittingPassword] = useState(false)

  // Profile info state
  const [userId, setUserId] = useState("")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [address, setAddress] = useState("")
  const [role, setRole] = useState("")

  // Password state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
        .select("full_name, role, phone_number, address")
        .eq("id", session.user.id)
        .single()

      if (error) throw error

      if (profile) {
        setFullName(profile.full_name || "")
        setRole(profile.role || "")
        setPhoneNumber(profile.phone_number || "")
        setAddress(profile.address || "")
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

  // ─── Handler: Simpan informasi akun ────────────────────────────────────────
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong")
      return
    }

    setSubmittingInfo(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim() || null,
          address: address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)

      if (error) throw error
      toast.success("Informasi akun berhasil diperbarui!")
      router.refresh()
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message)
    } finally {
      setSubmittingInfo(false)
    }
  }

  // ─── Handler: Ubah password ─────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Semua field password harus diisi")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok")
      return
    }

    setSubmittingPassword(true)
    try {
      // Re-authenticate with old password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      })
      if (signInError) {
        toast.error("Password lama tidak sesuai")
        return
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) throw updateError

      toast.success("Password berhasil diubah!")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      toast.error("Gagal mengubah password: " + err.message)
    } finally {
      setSubmittingPassword(false)
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

  const getRoleBadgeColor = (roleStr: string) => {
    switch (roleStr) {
      case "admin":
        return "bg-violet-500 hover:bg-violet-600 border-none text-white"
      case "kasir":
        return "bg-blue-500 hover:bg-blue-600 border-none text-white"
      default:
        return "bg-emerald-500 hover:bg-emerald-600 border-none text-white"
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

          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profil Saya</h1>
            <p className="text-muted-foreground mt-1">
              Kelola informasi profil pribadi dan keamanan akun POS Anda.
            </p>
          </div>

          {loading ? (
            <Card className="border-border/50 shadow-md max-w-2xl">
              <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Memuat informasi profil...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="max-w-2xl space-y-6">

              {/* ── Card 1: Informasi Akun ───────────────────────────────────── */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconUser className="size-5 text-primary" />
                    Informasi Akun
                  </CardTitle>
                  <CardDescription>
                    Perbarui nama lengkap, nomor telepon, dan alamat Anda.
                  </CardDescription>
                </CardHeader>

                <form onSubmit={handleSaveInfo}>
                  <CardContent className="space-y-5">

                    {/* Role badge (read-only display) */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <IconShield className="size-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Hak Akses / Peran</p>
                        <p className="text-sm font-semibold">{formatRole(role)}</p>
                      </div>
                      <Badge className={getRoleBadgeColor(role)}>
                        {role || "-"}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-1.5">
                        <IconMail className="size-4 text-muted-foreground" />
                        E-mail Akun
                        <span className="ml-auto text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                          Tidak dapat diubah
                        </span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                      />
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="flex items-center gap-1.5">
                        <IconUser className="size-4 text-primary" />
                        Nama Lengkap
                        <span className="text-destructive ml-0.5">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        disabled={submittingInfo}
                        placeholder="Masukkan nama lengkap Anda"
                        className="bg-background"
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="flex items-center gap-1.5">
                        <IconPhone className="size-4 text-primary" />
                        Nomor Telepon
                      </Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={submittingInfo}
                        placeholder="Contoh: 08123456789"
                        className="bg-background"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label htmlFor="address" className="flex items-center gap-1.5">
                        <IconMapPin className="size-4 text-primary" />
                        Alamat Lengkap
                      </Label>
                      <textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={submittingInfo}
                        placeholder="Masukkan alamat lengkap Anda"
                        rows={3}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none bg-background"
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button type="submit" disabled={submittingInfo} className="font-semibold">
                      {submittingInfo ? (
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

              {/* ── Card 2: Keamanan Akun ────────────────────────────────────── */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconLock className="size-5 text-amber-500" />
                    Keamanan Akun
                  </CardTitle>
                  <CardDescription>
                    Ubah password akun Anda. Pastikan password baru cukup kuat (minimal 6 karakter).
                  </CardDescription>
                </CardHeader>

                <form onSubmit={handleChangePassword}>
                  <CardContent className="space-y-5">

                    {/* Old Password */}
                    <div className="space-y-2">
                      <Label htmlFor="oldPassword" className="flex items-center gap-1.5">
                        <IconLock className="size-4 text-muted-foreground" />
                        Password Lama
                      </Label>
                      <div className="relative">
                        <Input
                          id="oldPassword"
                          type={showOld ? "text" : "password"}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          disabled={submittingPassword}
                          placeholder="Masukkan password lama"
                          className="bg-background pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOld((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showOld ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="flex items-center gap-1.5">
                        <IconLock className="size-4 text-primary" />
                        Password Baru
                      </Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={submittingPassword}
                          placeholder="Min. 6 karakter"
                          className="bg-background pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showNew ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                        </button>
                      </div>
                      {newPassword.length > 0 && newPassword.length < 6 && (
                        <p className="text-xs text-destructive mt-1">Password minimal 6 karakter</p>
                      )}
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="flex items-center gap-1.5">
                        <IconLock className="size-4 text-primary" />
                        Konfirmasi Password Baru
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={submittingPassword}
                          placeholder="Ulangi password baru"
                          className="bg-background pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirm ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive mt-1">Password tidak cocok</p>
                      )}
                    </div>

                  </CardContent>

                  <CardFooter className="border-t pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={submittingPassword}
                      variant="outline"
                      className="font-semibold border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                    >
                      {submittingPassword ? (
                        <>
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                          Mengubah Password...
                        </>
                      ) : (
                        <>
                          <IconLock className="mr-2 size-4" />
                          Ubah Password
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>

            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
