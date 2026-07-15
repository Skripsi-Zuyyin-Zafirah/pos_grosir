"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2 } from "@tabler/icons-react"

// Routes only "admin" role may access; "cashier" is redirected back to /dashboard.
const ADMIN_ONLY_PREFIXES = [
  "/dashboard/products",
  "/dashboard/satuan",
  "/dashboard/reports",
  "/dashboard/users",
  "/dashboard/waktu-proses",
]

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true

    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()

      const role = profile?.role

      if (role === "customer" || !role) {
        router.push("/customer")
        return
      }

      const isAdminOnlyRoute = ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
      if (role === "cashier" && isAdminOnlyRoute) {
        toast.error("Halaman ini khusus untuk Admin.")
        router.push("/dashboard")
        return
      }

      if (active) setChecked(true)
    }

    checkAccess()
    return () => {
      active = false
    }
  }, [pathname])

  if (!checked) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
