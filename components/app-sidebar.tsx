"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

import { NavMain } from "@/components/nav-main"
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
  IconReport,
  IconPackage,
  IconClipboardCheck,
  IconCash,
  IconShoppingCart,
  IconRuler2,
  IconUsers,
  IconCategory,
  IconClockHour4,
  IconHistory,
} from "@tabler/icons-react"

type Role = "admin" | "cashier"

type NavItem = { title: string; url: string; icon: React.ReactNode; roles?: Role[] }

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Utama",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: <IconDashboard />,
      },
    ],
  },
  {
    label: "Operasional",
    items: [
      {
        title: "POS Walk-in",
        url: "/dashboard/pos",
        icon: <IconShoppingCart />,
      },
      {
        title: "Kelola Pegawai",
        url: "/dashboard/employee",
        icon: <IconClipboardCheck />,
      },
      {
        title: "Kasir & Pembayaran",
        url: "/dashboard/queue",
        icon: <IconCash />,
      },
      {
        title: "Riwayat Transaksi",
        url: "/dashboard/transactions",
        icon: <IconHistory />,
      },
    ],
  },
  {
    label: "Manajemen Produk",
    items: [
      {
        title: "Kelola Produk dan Stok",
        url: "/dashboard/products",
        icon: <IconPackage />,
        roles: ["admin"],
      },
      {
        title: "Kelola Satuan",
        url: "/dashboard/satuan",
        icon: <IconRuler2 />,
        roles: ["admin"],
      },
      {
        title: "Kelola Kategori",
        url: "/dashboard/kategori",
        icon: <IconCategory />,
        roles: ["admin"],
      },
      {
        title: "Waktu Proses Produk",
        url: "/dashboard/waktu-proses",
        icon: <IconClockHour4 />,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Laporan & Administrasi",
    items: [
      {
        title: "Laporan Transaksi",
        url: "/dashboard/reports",
        icon: <IconReport />,
        roles: ["admin"],
      },
      {
        title: "Kelola Pengguna",
        url: "/dashboard/users",
        icon: <IconUsers />,
        roles: ["admin"],
      },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; avatar: string; role?: string }>({
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
          role: profile?.role || "cashier",
        })
        if (profile?.role === "admin" || profile?.role === "cashier") {
          setRole(profile.role)
        }
      }
    }
    fetchUser()
  }, [])

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0)

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
        {visibleSections.map((section) => (
          <NavMain key={section.label} label={section.label} items={section.items} />
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
