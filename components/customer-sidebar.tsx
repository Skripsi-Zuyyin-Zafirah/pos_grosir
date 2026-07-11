"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useCart } from "@/lib/cart/cart-context"

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
  IconShoppingBag,
  IconShoppingCart,
  IconClipboardList,
  IconHourglassHigh,
  IconUserCircle,
  IconHome,
} from "@tabler/icons-react"

const navSecondary = [
  {
    title: "Kembali ke Beranda",
    url: "/",
    icon: (
      <IconHome />
    ),
  },
]

export function CustomerSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = createClient()
  const { totalItems } = useCart()
  const [currentUser, setCurrentUser] = useState({
    name: "Pelanggan",
    email: "",
    avatar: "",
  })

  const navMain = [
    {
      title: "Dashboard",
      url: "/customer",
      icon: (
        <IconDashboard />
      ),
    },
    {
      title: "Katalog Produk",
      url: "/customer/catalog",
      icon: (
        <IconShoppingBag />
      ),
    },
    {
      title: "Keranjang",
      url: "/customer/cart",
      icon: (
        <IconShoppingCart />
      ),
      badge: totalItems,
    },
    {
      title: "Riwayat Transaksi",
      url: "/customer/orders",
      icon: (
        <IconClipboardList />
      ),
    },
    {
      title: "Papan Antrian",
      url: "/customer/queue",
      icon: (
        <IconHourglassHigh />
      ),
    },
    {
      title: "Profil Akun",
      url: "/customer/profile",
      icon: (
        <IconUserCircle />
      ),
    },
  ]

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
          name: profile?.full_name || session.user.email?.split("@")[0] || "Pelanggan",
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
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
