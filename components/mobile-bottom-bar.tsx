"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconDashboard,
  IconPackage,
  IconClipboardList,
  IconClock,
  IconReport,
  IconUser,
  IconCash,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  url: string
  icon: React.ReactNode
}

const adminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: <IconDashboard size={22} /> },
  { title: "Produk", url: "/dashboard/products", icon: <IconPackage size={22} /> },
  { title: "Antrian", url: "/dashboard/queue", icon: <IconClipboardList size={22} /> },
  { title: "Picking", url: "/dashboard/picking-time", icon: <IconClock size={22} /> },
  { title: "Laporan", url: "/dashboard/reports", icon: <IconReport size={22} /> },
  { title: "Profil", url: "/dashboard/profile", icon: <IconUser size={22} /> },
]

const cashierNavItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: <IconDashboard size={22} /> },
  { title: "Kasir", url: "/dashboard/cashier", icon: <IconCash size={22} /> },
  { title: "Antrian", url: "/dashboard/queue", icon: <IconClipboardList size={22} /> },
  { title: "Profil", url: "/dashboard/profile", icon: <IconUser size={22} /> },
]

function BottomBarItem({
  item,
  isActive,
}: {
  item: NavItem
  isActive: boolean
}) {
  return (
    <Link
      href={item.url}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 px-1 rounded-xl transition-all duration-200",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200",
          isActive
            ? "bg-primary/15 text-primary scale-110"
            : "text-muted-foreground"
        )}
      >
        {item.icon}
      </span>
      <span
        className={cn(
          "text-[10px] leading-tight font-medium truncate w-full text-center transition-all duration-200",
          isActive ? "text-primary font-semibold" : "text-muted-foreground"
        )}
      >
        {item.title}
      </span>
    </Link>
  )
}

export function MobileBottomBar({ role }: { role: "admin" | "cashier" }) {
  const pathname = usePathname()
  const navItems = role === "admin" ? adminNavItems : cashierNavItems

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      aria-label="Bottom navigation"
    >
      {/* Backdrop blur container */}
      <div className="relative mx-3 mb-3">
        <div
          className={cn(
            "flex items-center justify-around",
            "bg-background/80 backdrop-blur-xl",
            "border border-border/60",
            "rounded-2xl shadow-lg shadow-black/10",
            "px-2 py-1"
          )}
        >
          {navItems.map((item) => {
            const isActive =
              item.url === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.url)
            return (
              <BottomBarItem key={item.url} item={item} isActive={isActive} />
            )
          })}
        </div>
      </div>
    </nav>
  )
}
