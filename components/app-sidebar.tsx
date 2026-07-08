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
  IconReport,
  IconPackage,
  IconClipboardList,
  IconCash,
  IconClock
} from "@tabler/icons-react"

const data = {
  navMain: [
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
      title: "Waktu Pengambilan",
      url: "/dashboard/picking-time",
      icon: (
        <IconClock />
      ),
    },
    {
      title: "Laporan & Evaluasi",
      url: "/dashboard/reports",
      icon: (
        <IconReport />
      ),
    },
  ],
  navSecondary: [
    {
      title: "Pengaturan",
      url: "/dashboard/settings",
      icon: (
        <IconSettings />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState({
    name: "Admin POS",
    email: "admin@posgrosir.com",
    avatar: "",
  })

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single()

        setCurrentUser({
          name: profile?.full_name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatar: "",
        })
      }
    }
    fetchUser()
  }, [])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs">
                  PG
                </div>
                <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-indigo-900 to-purple-800 dark:from-indigo-100 dark:to-purple-200 bg-clip-text text-transparent">
                  POS Grosir Jasa
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
