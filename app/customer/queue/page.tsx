"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  IconLoader2,
  IconClock,
  IconHourglassHigh,
  IconActivity,
  IconCheck,
  IconUserStar,
} from "@tabler/icons-react"

type Order = {
  id: string
  user_id: string | null
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  ewp: number
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
  priority_score: number | null
}

export default function CustomerQueuePage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [queueMode, setQueueMode] = useState<string>("fifo")
  const [now, setNow] = useState<Date>(new Date())

  const fetchQueueData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        router.push("/login")
        return
      }
      setUserId(session.user.id)

      // 1. Fetch queue mode setting
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
      if (settings) {
        const modeSetting = settings.find((s) => s.key === "queue_mode")
        if (modeSetting) setQueueMode(String(modeSetting.value))
      }

      // 2. Fetch active waiting, processing, and ready orders
      const { data: activeOrders, error } = await supabase
        .from("orders")
        .select("id, user_id, order_number, created_at, customer_name, total_items, ewp, status, priority_score")
        .in("status", ["waiting", "processing", "ready"])

      if (error) throw error
      setOrders((activeOrders as Order[]) || [])
    } catch (err: any) {
      toast.error("Gagal memperbarui antrian: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueueData()

    // Subscribe to real-time updates for orders table
    const channel = supabase
      .channel("customer-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchQueueData()
        }
      )
      .subscribe()

    // Clock and countdown tick every 5 seconds
    const interval = setInterval(() => {
      setNow(new Date())
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const getTimeLeft = (createdAtStr: string, ewpMinutes: number) => {
    const createdAt = new Date(createdAtStr)
    const deadline = new Date(createdAt.getTime() + ewpMinutes * 60 * 1000)
    const diffMs = deadline.getTime() - now.getTime()
    return Math.ceil(diffMs / 1000 / 60)
  }

  const waitingOrders = orders
    .filter((o) => o.status === "waiting")
    // Sort waiting: Priority mode sorts by priority_score ASC; FIFO mode sorts by created_at ASC
    .sort((a, b) => {
      if (queueMode === "priority") {
        return (a.priority_score || 0) - (b.priority_score || 0)
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

  const processingOrders = orders.filter((o) => o.status === "processing")
  const readyOrders = orders.filter((o) => o.status === "ready")

  const isMine = (order: Order) => order.user_id === userId

  const renderOrderCard = (order: Order, position?: number) => {
    const timeLeft = getTimeLeft(order.created_at, order.ewp)
    const mine = isMine(order)
    return (
      <div
        key={order.id}
        className={`border rounded-xl p-3.5 space-y-2 transition-colors ${
          mine
            ? "border-primary/50 bg-primary/5 shadow-sm"
            : "border-border/50 bg-muted/20"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {position !== undefined && (
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-black shrink-0">
                {position}
              </span>
            )}
            <span className="font-mono text-sm font-bold text-primary">
              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
            </span>
          </div>
          {mine && (
            <Badge className="bg-primary hover:bg-primary border-none font-semibold gap-1">
              <IconUserStar className="size-3" /> Anda
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate max-w-[120px]">{order.customer_name || "Pelanggan"}</span>
          <span>{order.total_items} item</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <IconClock className="size-3.5 text-muted-foreground" />
          {order.status === "ready" ? (
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Siap diambil</span>
          ) : timeLeft > 0 ? (
            <span className="font-semibold">± {timeLeft} menit lagi</span>
          ) : (
            <span className="font-semibold text-amber-600 dark:text-amber-400">Segera selesai</span>
          )}
        </div>
      </div>
    )
  }

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
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Memuat papan antrian...</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-background border border-border/50 rounded-xl p-4 shadow-sm">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Papan Antrian</h1>
                <p className="text-muted-foreground mt-1">
                  Pantau antrian gudang secara real-time. Pesanan Anda ditandai khusus.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary font-bold px-3 py-1.5 rounded-full">
                Mode: {queueMode === "priority" ? "SJF Prioritas (Aging)" : "FIFO (First In First Out)"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Kolom ANTRI */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <IconHourglassHigh className="size-5" /> Antri
                  </CardTitle>
                  <CardDescription>{waitingOrders.length} pesanan menunggu diproses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {waitingOrders.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Tidak ada antrean menunggu.
                    </div>
                  ) : (
                    waitingOrders.map((order, i) => renderOrderCard(order, i + 1))
                  )}
                </CardContent>
              </Card>

              {/* Kolom DIPROSES */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <IconActivity className="size-5" /> Diproses
                  </CardTitle>
                  <CardDescription>{processingOrders.length} pesanan sedang dikemas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {processingOrders.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Tidak ada pesanan diproses.
                    </div>
                  ) : (
                    processingOrders.map((order) => renderOrderCard(order))
                  )}
                </CardContent>
              </Card>

              {/* Kolom SIAP DIAMBIL */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <IconCheck className="size-5" /> Siap Diambil
                  </CardTitle>
                  <CardDescription>{readyOrders.length} pesanan siap diambil</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {readyOrders.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Belum ada pesanan siap diambil.
                    </div>
                  ) : (
                    readyOrders.map((order) => renderOrderCard(order))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
