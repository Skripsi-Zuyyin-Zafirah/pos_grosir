"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { CustomerSiteHeader } from "@/components/customer-site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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

export default function UniversalProfilePage() {
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
        router.push("/login")
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

      toast.success("Password berhasil diperbarui!")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      toast.error("Gagal memperbarui password: " + err.message)
    } finally {
      setSubmittingPassword(false)
    }
  }

  // Render Loading
  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 bg-background">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Memuat profil Anda...</p>
      </div>
    )
  }

  // Pilih Sidebar dan Header sesuai dengan Role User
  const isCustomer = role === "customer"
  const SidebarComponent = isCustomer ? CustomerSidebar : AppSidebar
  const HeaderComponent = isCustomer ? CustomerSiteHeader : SiteHeader

  // Main Profile Page Content
  const pageContent = (
    <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Profil</h1>
        <p className="text-muted-foreground mt-1">
          Kelola informasi identitas, detail akun, dan keamanan password Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Ringkasan Pengguna */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 shadow-md">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-primary-foreground font-black text-2xl mb-4 shadow-md">
                {fullName ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "US"}
              </div>
              <h3 className="font-bold text-lg leading-snug">{fullName || "User POS"}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{email}</p>
              
              <div className="flex flex-wrap gap-1.5 justify-center">
                <Badge variant="outline" className="capitalize text-xs font-semibold px-2.5 py-0.5 border-primary/20 bg-primary/5 text-primary">
                  <IconShield className="size-3 mr-1" />
                  {role === "customer" ? "Pelanggan" : role}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Form Akun & Password */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Informasi Akun */}
          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconUser className="size-4 text-primary" />
                Informasi Akun
              </CardTitle>
              <CardDescription>Perbarui data diri Anda secara berkala</CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveInfo}>
              <CardContent className="space-y-4">
                {/* Email (Readonly) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5">
                    <IconMail className="size-4 text-muted-foreground" />
                    Alamat Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                  />
                </div>

                {/* Nama Lengkap */}
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

                {/* Nomor Telepon */}
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

                {/* Alamat Lengkap */}
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
                    placeholder="Tulis alamat pengiriman barang grosir Anda"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </CardContent>

              <CardFooter className="border-t pt-4 flex justify-end">
                <Button type="submit" disabled={submittingInfo}>
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

          {/* Card: Keamanan / Password */}
          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <IconLock className="size-4 text-amber-500" />
                Ubah Password
              </CardTitle>
              <CardDescription>Ganti password secara berkala untuk menjaga keamanan akun</CardDescription>
            </CardHeader>
            <form onSubmit={handleChangePassword}>
              <CardContent className="space-y-4">
                {/* Password Lama */}
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Password Saat Ini</Label>
                  <div className="relative">
                    <Input
                      id="oldPassword"
                      type={showOld ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      disabled={submittingPassword}
                      placeholder="Masukkan password lama Anda"
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

                <Separator />

                {/* Password Baru */}
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
                      placeholder="Minimal 6 karakter"
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

                {/* Konfirmasi Password Baru */}
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
      </div>
    </div>
  )

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <SidebarComponent variant="inset" />
      <SidebarInset>
        <HeaderComponent />
        {pageContent}
      </SidebarInset>
    </SidebarProvider>
  )
}
