"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  IconLoader2,
  IconUser,
  IconLock,
  IconMail,
  IconDeviceFloppy,
  IconShieldLock,
  IconPhone,
  IconMapPin,
} from "@tabler/icons-react"

export default function CustomerProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("customer")

  // Profile form
  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [address, setAddress] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setLoading(false)
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

        setFullName(profile?.full_name || "")
        setRole(profile?.role || "customer")
        setPhoneNumber(profile?.phone_number || "")
        setAddress(profile?.address || "")
      } catch (err: any) {
        toast.error("Gagal memuat profil: " + err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!fullName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong.")
      return
    }
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", userId)
      if (error) throw error
      toast.success("Profil berhasil diperbarui!")
    } catch (err: any) {
      toast.error("Gagal menyimpan profil: " + err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.")
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success("Password berhasil diganti!")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      toast.error("Gagal mengganti password: " + err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const getRoleLabel = (r: string) => {
    switch (r) {
      case "admin":
        return "Admin"
      case "cashier":
        return "Kasir"
      default:
        return "Pelanggan"
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
      <CustomerSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Memuat profil...</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Profil Akun</h1>
              <p className="text-muted-foreground mt-1">
                Kelola informasi akun dan keamanan Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
              {/* Informasi Profil */}
              <Card className="border-border/50 shadow-md">
                <form onSubmit={handleSaveProfile}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconUser className="size-5 text-primary" /> Informasi Profil
                    </CardTitle>
                    <CardDescription>Perbarui nama yang tampil pada pesanan Anda.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Peran Akun</Label>
                      <div>
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-bold">
                          {getRoleLabel(role)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <IconMail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <Input id="email" type="email" value={email} className="pl-9" disabled />
                      </div>
                      <p className="text-xs text-muted-foreground">Email tidak dapat diubah.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nama Lengkap</Label>
                      <div className="relative">
                        <IconUser className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="Nama lengkap Anda"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-9"
                          required
                          disabled={savingProfile}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">No. Telepon</Label>
                      <div className="relative">
                        <IconPhone className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="08xxxxxxxxxx"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="pl-9"
                          disabled={savingProfile}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Alamat Lengkap</Label>
                      <div className="relative">
                        <IconMapPin className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <textarea
                          id="address"
                          placeholder="Nama jalan, nomor rumah, kecamatan, kota..."
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          disabled={savingProfile}
                          className="w-full min-h-[80px] pl-9 pr-3 py-2 border rounded-md text-sm bg-background border-input focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border/50 pt-4 mt-4">
                    <Button type="submit" disabled={savingProfile}>
                      {savingProfile ? (
                        <>
                          <IconLoader2 className="mr-2 size-4 animate-spin" /> Menyimpan...
                        </>
                      ) : (
                        <>
                          <IconDeviceFloppy className="mr-2 size-4" /> Simpan Profil
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>

              {/* Keamanan / Ganti Password */}
              <Card className="border-border/50 shadow-md">
                <form onSubmit={handleChangePassword}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconShieldLock className="size-5 text-primary" /> Keamanan
                    </CardTitle>
                    <CardDescription>Ganti password akun Anda secara berkala.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Password Baru</Label>
                      <div className="relative">
                        <IconLock className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          type="password"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-9"
                          required
                          minLength={6}
                          disabled={savingPassword}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                      <div className="relative">
                        <IconLock className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-9"
                          required
                          minLength={6}
                          disabled={savingPassword}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Minimal 6 karakter.</p>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border/50 pt-4 mt-4">
                    <Button type="submit" variant="outline" disabled={savingPassword}>
                      {savingPassword ? (
                        <>
                          <IconLoader2 className="mr-2 size-4 animate-spin" /> Mengganti...
                        </>
                      ) : (
                        <>
                          <IconLock className="mr-2 size-4" /> Ganti Password
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
