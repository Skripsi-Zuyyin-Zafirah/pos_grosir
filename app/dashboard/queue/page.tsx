"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { IconLoader2, IconClock, IconAlertTriangle, IconUser, IconActivity, IconHourglassHigh } from "@tabler/icons-react"

type Order = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  ewp: number
  status: "antri" | "diproses" | "selesai" | "batal"
}

export default function QueueMonitorPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [queueMode, setQueueMode] = useState<string>("fifo")
  const [agingRate, setAgingRate] = useState<number>(1.0)
  const [now, setNow] = useState<Date>(new Date())

  const fetchQueueData = async () => {
    try {
      // 1. Fetch system settings
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")

      if (settings) {
        settings.forEach((s) => {
          if (s.key === "queue_mode") setQueueMode(String(s.value))
          if (s.key === "aging_rate") setAgingRate(Number(s.value))
        })
      }

      // 2. Fetch active antri & diproses orders
      const { data: activeOrders, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["antri", "diproses"])

      if (error) throw error
      setOrders(activeOrders || [])
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
      .channel("monitor-queue-realtime")
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

  // Calculate dynamic sisa waktu (time left in minutes)
  const getTimeLeft = (createdAtStr: string, ewpMinutes: number) => {
    const createdAt = new Date(createdAtStr)
    const deadline = new Date(createdAt.getTime() + ewpMinutes * 60 * 1000)
    const diffMs = deadline.getTime() - now.getTime()
    return Math.ceil(diffMs / 1000 / 60) // return rounded up minutes left
  }

  // Filter columns
  // Note: actual dequeue priority ordering (SJF + aging) is computed server-side by the
  // pop_next_order RPC; no priority score is persisted on the order row for client display,
  // so this board always previews the waiting column in FIFO (created_at) order.
  const waitingOrders = orders
    .filter((o) => o.status === "antri")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const processingOrders = orders.filter((o) => o.status === "diproses")

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col p-6 space-y-6">
          {/* Header Dashboard */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-background border border-border/50 rounded-xl p-4 shadow-sm">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Papan Antrian Real-time</h1>
              <p className="text-muted-foreground mt-1">
                Monitor status antrian pengambilan dan pengepakan barang grosir.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="font-semibold px-3 py-1 bg-primary/5 text-primary border-primary/20">
                <IconActivity className="size-3.5 mr-1" />
                Mode: {queueMode === "priority" ? "SJF Prioritas (Aging)" : "FIFO (First In First Out)"}
              </Badge>
              <Badge variant="outline" className="font-semibold px-3 py-1">
                <IconClock className="size-3.5 mr-1" />
                {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} WIB
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Menghubungkan ke database antrian...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* 1. WAITING COLUMN */}
              <Card className="border-border/50 shadow-md">
                <CardHeader className="bg-sky-500/10 border-b border-sky-500/20 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sky-700 text-lg flex items-center gap-2">
                        <IconHourglassHigh className="size-5" /> ANTRI (Waiting)
                      </CardTitle>
                      <CardDescription className="text-sky-700/70 text-xs">
                        Pesanan menunggu giliran kemas
                      </CardDescription>
                    </div>
                    <Badge className="bg-sky-500 text-white font-bold size-6 rounded-full flex items-center justify-center p-0">
                      {waitingOrders.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 min-h-[400px]">
                  {waitingOrders.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada antrean tunggu
                    </div>
                  ) : (
                    waitingOrders.map((order, idx) => {
                      const timeLeft = getTimeLeft(order.created_at, order.ewp)
                      const isOverdue = timeLeft <= 0

                      return (
                        <div
                          key={order.id}
                          className="p-3 border rounded-lg hover:border-sky-300 transition-colors bg-background flex flex-col gap-2 relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-bold text-sky-600">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              No. {idx + 1}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1">
                              <IconUser className="size-3 text-muted-foreground" /> {order.customer_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.total_items} item • {new Date(order.created_at).toLocaleTimeString("id-ID")}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                            <span className="text-muted-foreground">ECT: {order.ewp}m</span>
                            {isOverdue ? (
                              <Badge className="bg-rose-500 text-white border-none font-bold animate-pulse text-[10px] py-0.5 px-2">
                                <IconAlertTriangle className="size-3 mr-0.5" /> Terlambat!
                              </Badge>
                            ) : (
                              <Badge className="bg-sky-500 text-white border-none font-semibold text-[10px] py-0.5 px-2">
                                Sisa {timeLeft}m
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              {/* 2. PROCESSING COLUMN */}
              <Card className="border-border/50 shadow-md">
                <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-amber-700 text-lg flex items-center gap-2">
                        <IconClock className="size-5" /> DIPROSES (Packing)
                      </CardTitle>
                      <CardDescription className="text-amber-700/70 text-xs">
                        Sedang dikemas oleh petugas gudang / siap dibayar di kasir
                      </CardDescription>
                    </div>
                    <Badge className="bg-amber-500 text-white font-bold size-6 rounded-full flex items-center justify-center p-0">
                      {processingOrders.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 min-h-[400px]">
                  {processingOrders.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada pesanan sedang dikemas
                    </div>
                  ) : (
                    processingOrders.map((order) => {
                      const timeLeft = getTimeLeft(order.created_at, order.ewp)
                      const isOverdue = timeLeft <= 0

                      return (
                        <div
                          key={order.id}
                          className="p-3 border rounded-lg hover:border-amber-300 transition-colors bg-background flex flex-col gap-2 relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-bold text-amber-600">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1">
                              <IconUser className="size-3 text-muted-foreground" /> {order.customer_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.total_items} item • Diproses mulai:{" "}
                              {order.created_at ? new Date(order.created_at).toLocaleTimeString("id-ID") : "-"}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                            <span className="text-muted-foreground">Target: {order.ewp}m</span>
                            {isOverdue ? (
                              <Badge className="bg-rose-500 text-white border-none font-bold animate-pulse text-[10px] py-0.5 px-2">
                                <IconAlertTriangle className="size-3 mr-0.5" /> Terlambat!
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500 text-white border-none font-semibold text-[10px] py-0.5 px-2">
                                Sisa {timeLeft}m
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
