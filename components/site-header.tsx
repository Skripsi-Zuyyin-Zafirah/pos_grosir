"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/products": "Kelola Produk",
  "/dashboard/inventory": "Kelola Stok",
  "/dashboard/picking": "Proses Gudang",
  "/dashboard/cashier": "Kasir & Pembayaran",
  "/dashboard/queue": "Papan Antrian",
  "/dashboard/reports": "Laporan & Evaluasi",
  "/dashboard/settings": "Pengaturan",
  "/customer": "Dashboard",
  "/customer/catalog": "Katalog Produk",
  "/customer/cart": "Keranjang",
  "/customer/tracking": "Lacak Pesanan",
  "/customer/orders": "Riwayat Transaksi",
  "/customer/profile": "Profil Akun",
}

type Crumb = { label: string; href?: string }

function getBreadcrumbTrail(pathname: string): Crumb[] {
  const isCustomer = pathname.startsWith("/customer")
  const rootPath = isCustomer ? "/customer" : "/dashboard"
  const rootLabel = "Dashboard"

  if (pathname === rootPath) {
    return [{ label: rootLabel }]
  }

  const trail: Crumb[] = [{ label: rootLabel, href: rootPath }]

  // Special-case: customer order detail page (dynamic [id] segment)
  const orderDetailMatch = pathname.match(/^\/customer\/orders\/([^/]+)$/)
  if (orderDetailMatch) {
    trail.push({ label: "Riwayat Transaksi", href: "/customer/orders" })
    trail.push({ label: "Detail Pesanan" })
    return trail
  }

  const label = ROUTE_LABELS[pathname]
  if (label) {
    trail.push({ label })
  } else {
    const lastSegment = pathname.split("/").filter(Boolean).pop() || ""
    trail.push({ label: lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1) })
  }

  return trail
}

export function SiteHeader() {
  const pathname = usePathname()
  const trail = getBreadcrumbTrail(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {trail.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="text-base font-medium text-foreground">
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
