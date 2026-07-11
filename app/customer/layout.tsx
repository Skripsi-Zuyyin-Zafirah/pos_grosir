"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { CustomerSiteHeader } from "@/components/customer-site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CustomerMobileBottomBar } from "@/components/customer-mobile-bottom-bar"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          toast.error("Silakan login terlebih dahulu.")
          router.push("/login")
          return
        }

        // Ambil profil untuk mengecek role
        console.log(`[CustomerLayout] Memuat profil user: ${user.id}`)
        
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
            console.warn(`[CustomerLayout] Query profiles error: ${result.error.message}. Menggunakan fallback metadata.`)
          }
        } catch (err: any) {
          console.warn(`[CustomerLayout] Query profiles timed out or failed: ${err.message}. Menggunakan fallback metadata.`)
        }
 
        const metadataRole = user.user_metadata?.role || user.app_metadata?.role
        const userRole = profile?.role || metadataRole || "customer"
        console.log(`[CustomerLayout] Role terdeteksi: ${userRole}`)

        if (!userRole) {
          toast.error("Gagal memuat profil pengguna.")
          router.push("/login")
          return
        }
 
        if (userRole !== "customer") {
          toast.error("Anda tidak memiliki akses ke area Customer.")
          // Jika admin/staff/cashier, arahkan ke dashboard admin
          if (["admin", "cashier", "staff", "warehouse"].includes(userRole)) {
            router.push("/dashboard")
          } else {
            router.push("/login")
          }
          return
        }

        // Lolos verifikasi
        setLoading(false)
      } catch (err: any) {
        toast.error("Terjadi kesalahan autentikasi: " + err.message)
        router.push("/login")
      }
    }

    checkAuthAndRole()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 bg-background">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Memverifikasi akses Anda...</p>
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
      <CustomerSidebar variant="inset" />
      <SidebarInset>
        <CustomerSiteHeader />
        <div className="pb-24 md:pb-0">{children}</div>
      </SidebarInset>
      <CustomerMobileBottomBar />
    </SidebarProvider>
  )
}
