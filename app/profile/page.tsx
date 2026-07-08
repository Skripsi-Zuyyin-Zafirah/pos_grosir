"use client"

import { CustomerSidebar } from "@/components/customer-sidebar"
import { CustomerSiteHeader } from "@/components/customer-site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ProfileContent } from "@/components/profile-content"

export default function CustomerProfilePage() {
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
        <ProfileContent />
      </SidebarInset>
    </SidebarProvider>
  )
}
