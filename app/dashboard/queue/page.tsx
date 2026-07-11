"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { IconLoader2, IconAlertTriangle, IconClockHour4 } from "@tabler/icons-react"

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
  const [now, setNow] = useState<Date>(new Date())

  const fetchQueueData = async () => {
    try {
      const { data: settings } = await supabase.from("system_settings").select("key, value")
      if (settings) {
        settings.forEach((s) => {
          if (s.key === "queue_mode") setQueueMode(String(s.value))
        })
      }

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

    const channel = supabase
      .channel("monitor-queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchQueueData()
      })
      .subscribe()

    const interval = setInterval(() => setNow(new Date()), 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const getTimeLeft = (createdAtStr: string, ewpMinutes: number) => {
    const createdAt = new Date(createdAtStr)
    const deadline = new Date(createdAt.getTime() + ewpMinutes * 60 * 1000)
    return Math.ceil((deadline.getTime() - now.getTime()) / 1000 / 60)
  }

  // Note: actual dequeue priority (SJF + aging) is computed server-side by pop_next_order;
  // this board previews the waiting column in FIFO (created_at) order.
  const waitingOrders = orders
    .filter((o) => o.status === "antri")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const processingOrders = orders.filter((o) => o.status === "diproses")

  const overdueCount = orders.filter((o) => getTimeLeft(o.created_at, o.ewp) <= 0).length

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
        <div className="flex flex-1 flex-col">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border/50">
            <h1 className="text-lg font-semibold">Papan Antrian</h1>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {queueMode === "priority" ? "Mode: Prioritas" : "Mode: FIFO"}
              </span>
              <span className="tabular-nums font-medium">
                {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
              <IconLoader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Menghubungkan ke database antrian...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-6 gap-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <StatBox label="Antri" value={waitingOrders.length} />
                <StatBox label="Diproses" value={processingOrders.length} />
                <StatBox label="Terlambat" value={overdueCount} tone={overdueCount > 0 ? "danger" : "default"} />
              </div>

              {/* Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                <QueueColumn
                  title="Antri"
                  orders={waitingOrders}
                  getTimeLeft={getTimeLeft}
                  emptyText="Tidak ada antrean tunggu"
                  showPosition
                />
                <QueueColumn
                  title="Diproses"
                  orders={processingOrders}
                  getTimeLeft={getTimeLeft}
                  emptyText="Tidak ada pesanan sedang dikemas"
                />
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "danger"
}) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums", tone === "danger" && value > 0 && "text-rose-600")}>
        {value}
      </span>
    </div>
  )
}

function QueueColumn({
  title,
  orders,
  getTimeLeft,
  emptyText,
  showPosition,
}: {
  title: string
  orders: Order[]
  getTimeLeft: (createdAt: string, ewp: number) => number
  emptyText: string
  showPosition?: boolean
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs text-muted-foreground font-medium">{orders.length}</span>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          orders.map((order, idx) => {
            const timeLeft = getTimeLeft(order.created_at, order.ewp)
            const isOverdue = timeLeft <= 0

            return (
              <div
                key={order.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  isOverdue && "bg-rose-500/5 border-l-2 border-l-rose-500"
                )}
              >
                {showPosition && (
                  <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">
                      #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">{order.customer_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.total_items} item</p>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-semibold shrink-0",
                    isOverdue ? "text-rose-600" : "text-muted-foreground"
                  )}
                >
                  {isOverdue ? (
                    <>
                      <IconAlertTriangle className="size-3.5" />
                      Terlambat
                    </>
                  ) : (
                    <>
                      <IconClockHour4 className="size-3.5" />
                      {timeLeft}m
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
