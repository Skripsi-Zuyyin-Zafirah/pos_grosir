"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { IconDashboard, IconListDetails, IconChartBar, IconFolder, IconUsers, IconCamera, IconFileDescription, IconFileAi, IconSettings, IconHelp, IconSearch, IconDatabase, IconReport, IconFileWord, IconInnerShadowTop, IconPackage, IconClipboardList, IconClipboardCheck, IconCash } from "@tabler/icons-react"

const data = {
  user: {
    name: "Admin POS",
    email: "admin@posgrosir.com",
    avatar: "",
  },
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
      title: "Kelola Stok",
      url: "/dashboard/inventory",
      icon: (
        <IconDatabase />
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
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: (
        <IconCamera
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: (
        <IconFileDescription
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <IconFileAi
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: (
        <IconSettings
        />
      ),
    },
    {
      title: "Get Help",
      url: "#",
      icon: (
        <IconHelp
        />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <IconSearch
        />
      ),
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: (
        <IconDatabase
        />
      ),
    },
    {
      name: "Reports",
      url: "#",
      icon: (
        <IconReport
        />
      ),
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: (
        <IconFileWord
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
