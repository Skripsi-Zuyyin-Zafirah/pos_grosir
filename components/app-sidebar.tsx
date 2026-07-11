"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  IconDashboard,
  IconSettings,
  IconDatabase,
  IconReport,
  IconPackage,
  IconClipboardList,
  IconClipboardCheck,
  IconCash,
  IconShoppingCart,
} from "@tabler/icons-react"

type Role = "admin" | "cashier"

const navMainData: { title: string; url: string; icon: React.ReactNode; roles?: Role[] }[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: (
      <IconDashboard />
    ),
  },
  {
    title: "Kelola Produk",
    url: "/dashboard/products",
    icon: (
      <IconPackage />
    ),
    roles: ["admin"],
  },
  {
    title: "Kelola Stok",
    url: "/dashboard/inventory",
    icon: (
      <IconDatabase />
    ),
    roles: ["admin"],
  },
  {
    title: "POS Walk-in",
    url: "/dashboard/pos",
    icon: (
      <IconShoppingCart />
    ),
  },
  {
    title: "Proses Gudang",
    url: "/dashboard/picking",
    icon: (
      <IconClipboardCheck />
    ),
  },
  {
    title: "Kasir & Pembayaran",
    url: "/dashboard/cashier",
    icon: (
      <IconCash />
    ),
  },
  {
    title: "Papan Antrian",
    url: "/dashboard/queue",
    icon: (
      <IconClipboardList />
    ),
  },
  {
    title: "Laporan & Evaluasi",
    url: "/dashboard/reports",
    icon: (
      <IconReport />
    ),
    roles: ["admin"],
  },
]

const navSecondaryData: { title: string; url: string; icon: React.ReactNode; roles?: Role[] }[] = [
  {
    title: "Pengaturan",
    url: "/dashboard/settings",
    icon: (
      <IconSettings />
    ),
    roles: ["admin"],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState({
    name: "Admin POS",
    email: "admin@posgrosir.com",
    avatar: "",
  })
  const [role, setRole] = useState<Role>("cashier")

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single()

        setCurrentUser({
          name: profile?.full_name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatar: "",
        })
        if (profile?.role === "admin" || profile?.role === "cashier") {
          setRole(profile.role)
        }
      }
    }
    fetchUser()
  }, [])

  const navMain = navMainData.filter((item) => !item.roles || item.roles.includes(role))
  const navSecondary = navSecondaryData.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5! group/logo"
            >
              <Link href="/">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-2 text-primary-foreground font-black text-xs shadow-sm group-hover/logo:scale-105 transition-transform">
                  PG
                </div>
                <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-primary to-chart-3 bg-clip-text text-transparent">
                  POS Grosir Jasa
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {navSecondary.length > 0 && <NavSecondary items={navSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
