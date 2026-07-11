"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AdminSidebar } from "@/components/admin-sidebar"
import { CashierSidebar } from "@/components/cashier-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { MobileBottomBar } from "@/components/mobile-bottom-bar"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<"admin" | "cashier" | null>(null)

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          toast.error("Silakan login terlebih dahulu.")
          router.push("/login")
          return
        }

        // Ambil profil pengguna
        console.log(`[DashboardLayout] Memuat profil user: ${user.id}`)
        
        const profilePromise = supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2500)
        )

        let profile = null
        try {
          const result = await Promise.race([profilePromise, timeoutPromise])
          profile = result.data
          if (result.error) {
            console.warn(`[DashboardLayout] Query profiles error: ${result.error.message}. Menggunakan fallback metadata.`)
          }
        } catch (err: any) {
          console.warn(`[DashboardLayout] Query profiles timed out or failed: ${err.message}. Menggunakan fallback metadata.`)
        }
 
        const metadataRole = user.user_metadata?.role || user.app_metadata?.role
        const userRole = profile?.role || metadataRole
        console.log(`[DashboardLayout] Role terdeteksi: ${userRole}`)

        if (!userRole) {
          toast.error("Gagal memuat profil pengguna.")
          router.push("/login")
          return
        }
 
        if (userRole === "admin" || userRole === "cashier") {
          setRole(userRole)
          setLoading(false)
        } else {
          toast.error("Anda tidak memiliki akses ke area Dashboard.")
          router.push("/customer")
        }
      } catch (err: any) {
        toast.error("Kesalahan autentikasi: " + err.message)
        router.push("/login")
      }
    }

    checkAuthAndRole()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 bg-background">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Memverifikasi akses staf...</p>
      </div>
    )
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
      {role === "admin" ? (
        <AdminSidebar variant="inset" />
      ) : (
        <CashierSidebar variant="inset" />
      )}
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col pb-24 md:pb-0">
          {children}
        </div>
      </SidebarInset>
      <MobileBottomBar role={role!} />
    </SidebarProvider>
  )
}
