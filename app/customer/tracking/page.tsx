"use client"

import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"
import {
  IconLoader2,
  IconTruckDelivery,
  IconClock,
  IconUserCog,
  IconArrowRight,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconBan,
  IconPackageOff,
} from "@tabler/icons-react"

type Order = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  ewp: number
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
  completed_at: string | null
  enqueued_at: string | null
  dequeued_at: string | null
  staff: { name: string; status: string } | null
}

export default function CustomerTrackingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [latestOrder, setLatestOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, customer_name, total_items, total_price, ewp, status, completed_at, enqueued_at, dequeued_at, staff:staff_id ( name, status )")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      const all = (data as any as Order[]) || []
      const active = all.filter((o) => ["waiting", "processing", "ready"].includes(o.status))
      setActiveOrders(active)
      setLatestOrder(active.length === 0 ? all[0] || null : null)
    } catch (err: any) {
      toast.error("Gagal memuat status pesanan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel("customer-tracking-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getStatusBadge = (status: string) => {
    const base = "border-none font-bold text-[11px] tracking-wide px-2.5 py-1 gap-1.5 shadow-sm"
    switch (status) {
      case "waiting":
        return (
          <Badge className={`${base} bg-sky-500 hover:bg-sky-600 text-white`}>
            <span className="size-1.5 rounded-full bg-white animate-pulse" /> ANTRI
          </Badge>
        )
      case "processing":
        return (
          <Badge className={`${base} bg-amber-500 hover:bg-amber-600 text-white`}>
            <span className="size-1.5 rounded-full bg-white animate-pulse" /> DIPROSES
          </Badge>
        )
      case "ready":
        return (
          <Badge className={`${base} bg-indigo-500 hover:bg-indigo-600 text-white`}>
            <span className="size-1.5 rounded-full bg-white animate-pulse" /> SIAP DIAMBIL
          </Badge>
        )
      case "done":
        return (
          <Badge className={`${base} bg-emerald-500 hover:bg-emerald-600 text-white`}>
            <IconCircleCheckFilled className="size-3" /> SELESAI
          </Badge>
        )
      case "cancelled":
        return (
          <Badge className={`${base} bg-rose-500 hover:bg-rose-600 text-white`}>
            <IconBan className="size-3" /> BATAL
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatDateTime = (val: string | null) => {
    if (!val) return null
    return new Date(val).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimelineSteps = (o: Order) => {
    const steps = [
      { label: "Pesanan Dibuat", time: o.created_at },
      { label: "Masuk Antrian", time: o.enqueued_at },
      { label: "Diproses & Dikemas", time: o.dequeued_at },
      { label: o.status === "cancelled" ? "Dibatalkan" : "Selesai & Diambil", time: o.completed_at },
    ]
    return steps.map((step, i) => ({
      ...step,
      done: !!step.time || (o.status === "cancelled" && i === steps.length - 1),
    }))
  }

  const renderTimeline = (order: Order) => {
    const steps = getTimelineSteps(order)
    return (
      <>
        {/* Horizontal stepper (sm and up) */}
        <div className="hidden sm:flex items-start w-full">
          {steps.map((step, i, arr) => (
            <Fragment key={step.label}>
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                {step.done ? (
                  order.status === "cancelled" && i === arr.length - 1 ? (
                    <IconBan className="size-6 text-rose-500 shrink-0" />
                  ) : (
                    <IconCircleCheckFilled className="size-6 text-emerald-500 shrink-0" />
                  )
                ) : (
                  <IconCircleDashed className="size-6 text-muted-foreground/40 shrink-0" />
                )}
                <p className={`text-xs font-semibold mt-2 ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDateTime(step.time) || "Menunggu"}
                </p>
              </div>
              {i < arr.length - 1 && (
                <div className={`h-0.5 flex-1 mt-3 ${step.done ? "bg-emerald-500/50" : "bg-border"}`} />
              )}
            </Fragment>
          ))}
        </div>

        {/* Vertical stepper (mobile) */}
        <div className="flex sm:hidden flex-col">
          {steps.map((step, i, arr) => (
            <div key={step.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                {step.done ? (
                  order.status === "cancelled" && i === arr.length - 1 ? (
                    <IconBan className="size-5 text-rose-500 shrink-0" />
                  ) : (
                    <IconCircleCheckFilled className="size-5 text-emerald-500 shrink-0" />
                  )
                ) : (
                  <IconCircleDashed className="size-5 text-muted-foreground/40 shrink-0" />
                )}
                {i < arr.length - 1 && (
                  <div className={`w-px flex-1 min-h-6 ${step.done ? "bg-emerald-500/40" : "bg-border"}`} />
                )}
              </div>
              <div className="pb-4">
                <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(step.time) || "Menunggu"}</p>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  const renderOrderCard = (order: Order) => (
    <Card key={order.id} className="border-border/50 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-primary">
              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
            </span>
            {getStatusBadge(order.status)}
          </div>
          <CardDescription className="mt-1">
            Dipesan {new Date(order.created_at).toLocaleString("id-ID")}
          </CardDescription>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Total Pembayaran</p>
          <p className="text-lg font-bold text-primary">{formatRupiah(order.total_price)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/30 rounded-lg p-4">{renderTimeline(order)}</div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <IconClock className="size-4" />
            Estimasi Kemas: <span className="font-semibold text-foreground">{order.ewp} menit</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <IconUserCog className="size-4" />
            Ditangani: <span className="font-semibold text-foreground">{order.staff?.name || "Belum ditugaskan"}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">{order.total_items}</span> unit barang
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border/50 pt-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/customer/orders/${order.id}`}>
            Lihat Detail Lengkap <IconArrowRight className="size-4 ml-1.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )

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
        <SiteHeader />
        <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lacak Pesanan</h1>
            <p className="text-muted-foreground mt-1">
              Pantau status dan timeline pesanan aktif Anda secara real-time.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Memuat status pesanan...</p>
            </div>
          ) : activeOrders.length > 0 ? (
            <div className="space-y-5">{activeOrders.map(renderOrderCard)}</div>
          ) : latestOrder ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-lg px-4 py-3">
                <IconTruckDelivery className="size-4 shrink-0" />
                Tidak ada pesanan yang sedang berjalan. Berikut pesanan terakhir Anda.
              </div>
              {renderOrderCard(latestOrder)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
              <IconPackageOff className="size-16 text-muted-foreground/60 mb-2" />
              <h3 className="font-semibold text-lg">Belum Ada Pesanan</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Anda belum pernah melakukan pemesanan. Silakan berbelanja di katalog terlebih dahulu.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/customer/catalog">Mulai Belanja</Link>
              </Button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
