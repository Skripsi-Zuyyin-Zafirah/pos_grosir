"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
  IconClipboardList,
  IconCash,
  IconUser,
} from "@tabler/icons-react"

const cashierMenu = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <IconDashboard />,
    },
    {
      title: "Kasir & Pembayaran",
      url: "/dashboard/cashier",
      icon: <IconCash />,
    },
    {
      title: "Papan Antrian",
      url: "/dashboard/queue",
      icon: <IconClipboardList />,
    },
    {
      title: "Profil Saya",
      url: "/dashboard/profile",
      icon: <IconUser />,
    },
  ],
}

export function CashierSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState({
    name: "Kasir POS",
    email: "cashier@posgrosir.com",
    avatar: "",
  })

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
          name: profile?.full_name || session.user.email?.split("@")[0] || "Kasir",
          email: session.user.email || "",
          avatar: "",
        })
      }
    }
    fetchUser()
  }, [])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <span className="font-bold text-xs">POS</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="font-semibold truncate">Grosir Jasa</span>
                  <span className="text-[10px] text-muted-foreground truncate font-mono">ROLE: KASIR</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={cashierMenu.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
