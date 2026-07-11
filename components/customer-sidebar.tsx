"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useCart } from "@/lib/cart/cart-context"

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
  IconShoppingBag,
  IconShoppingCart,
  IconTruckDelivery,
  IconClipboardList,
  IconUserCircle,
} from "@tabler/icons-react"

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
      title: "Lacak Pesanan",
      url: "/customer/tracking",
      icon: (
        <IconTruckDelivery />
      ),
    },
    {
      title: "Riwayat Transaksi",
      url: "/customer/orders",
      icon: (
        <IconClipboardList />
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
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
