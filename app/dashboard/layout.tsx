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
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          toast.error("Silakan login terlebih dahulu.")
          router.push("/login")
          return
        }

        // Ambil profil pengguna
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()

        if (error || !profile) {
          toast.error("Gagal memuat profil pengguna.")
          router.push("/login")
          return
        }

        const userRole = profile.role
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
