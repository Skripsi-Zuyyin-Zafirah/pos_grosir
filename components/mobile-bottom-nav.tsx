"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/lib/cart/cart-context"
import { createClient } from "@/lib/supabase/client"
import {
  IconDashboard,
  IconShoppingBag,
  IconShoppingCart,
  IconTruckDelivery,
  IconUserCircle,
  IconCash,
  IconHistory,
  IconPackage,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

// Separate component for cart badge so that useCart() hook is ONLY executed
// when this component is mounted (only on customer pages where CartProvider is active).
// This prevents "useCart must be used within a CartProvider" runtime error in admin/cashier dashboard layout.
function CartBadge() {
  const { totalItems } = useCart()
  if (totalItems <= 0) return null
  return (
    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground animate-pulse">
      {totalItems}
    </span>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [role, setRole] = useState<"customer" | "admin" | "cashier">("customer")

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
        if (profile?.role) {
          setRole(profile.role as any)
        }
      }
    }
    fetchRole()
  }, [])

  const isCustomer = pathname.startsWith("/customer")
  const isDashboard = pathname.startsWith("/dashboard")

  // Do not render outside customer or dashboard panels
  if (!isCustomer && !isDashboard) return null

  // Determine items based on panel
  const items = isCustomer
    ? [
        {
          title: "Home",
          url: "/customer",
          icon: IconDashboard,
        },
        {
          title: "Katalog",
          url: "/customer/catalog",
          icon: IconShoppingBag,
        },
        {
          title: "Keranjang",
          url: "/customer/cart",
          icon: IconShoppingCart,
          showBadge: true,
        },
        {
          title: "Lacak",
          url: "/customer/tracking",
          icon: IconTruckDelivery,
        },
        {
          title: "Profil",
          url: "/customer/profile",
          icon: IconUserCircle,
        },
      ]
    : [
        {
          title: "Home",
          url: "/dashboard",
          icon: IconDashboard,
        },
        {
          title: "POS",
          url: "/dashboard/pos",
          icon: IconShoppingCart,
        },
        {
          title: "Antrian",
          url: "/dashboard/queue",
          icon: IconCash,
        },
        role === "admin"
          ? {
              title: "Produk",
              url: "/dashboard/products",
              icon: IconPackage,
            }
          : {
              title: "Riwayat",
              url: "/dashboard/transactions",
              icon: IconHistory,
            },
        {
          title: "Profil",
          url: "/dashboard/profile",
          icon: IconUserCircle,
        },
      ]

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="flex h-16 items-center justify-around rounded-2xl border border-border/40 bg-background/80 backdrop-blur-lg px-2 shadow-lg shadow-black/5 dark:shadow-none">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.url ||
            (item.url !== "/customer" && item.url !== "/dashboard" && pathname.startsWith(item.url))

          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 px-3 text-muted-foreground transition-all duration-300 rounded-xl hover:text-primary active:scale-95",
                isActive && "text-primary font-semibold"
              )}
            >
              <div className="relative">
                <Icon className={cn("size-6 transition-transform duration-300", isActive && "scale-110")} />
                {"showBadge" in item && item.showBadge && <CartBadge />}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.title}</span>
              {isActive && (
                <span className="absolute bottom-1 size-1 rounded-full bg-primary animate-fade-in" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
