"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  IconLoader2,
  IconUser,
  IconHourglassHigh,
  IconCircleCheck,
  IconCircleDashed,
  IconBox,
  IconActivity,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Staff = {
  id: string
  name: string
  status: "idle" | "sibuk"
  currentOrder?: Order | null
}

type Order = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  ewp: number
  status: "antri" | "diproses" | "selesai" | "batal"
  staff_id: string | null
  dequeued_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)} dtk`
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return remaining > 0 ? `${minutes}m ${remaining}d` : `${minutes} menit`
}

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function QueueMonitorPage() {
  const supabase = createClient()
  const [waitingOrders, setWaitingOrders] = useState<Order[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<Date>(new Date())

  const fetchQueueData = async () => {
    try {
      // 1. Fetch semua staf
      const { data: staffData, error: staffErr } = await supabase
        .from("staff")
        .select("id, name, status")
        .order("name")

      if (staffErr) throw staffErr

      // 2. Fetch semua pesanan aktif (antri + diproses)
      const { data: activeOrders, error: ordersErr } = await supabase
        .from("orders")
        .select("id, order_number, created_at, customer_name, total_items, total_price, ewp, status, staff_id, dequeued_at")
        .in("status", ["antri", "diproses"])

      if (ordersErr) throw ordersErr

      const orders = (activeOrders || []) as Order[]

      // 3. Gabungkan: Map pesanan yang sedang diproses ke staf-nya
      const staffWithOrders: Staff[] = (staffData || []).map((s: any) => {
        const currentOrder = orders.find(
          (o) => o.status === "diproses" && o.staff_id === s.id
        ) || null
        return { ...s, currentOrder }
      })

      setStaff(staffWithOrders)

      // 4. Set antrean: hanya pesanan dengan status 'antri', urut EWP ASC, created_at ASC (min-heap)
      const queue = orders
        .filter((o) => o.status === "antri")
        .sort((a, b) => a.ewp - b.ewp || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      setWaitingOrders(queue)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchQueueData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff" },
        () => fetchQueueData()
      )
      .subscribe()

    const interval = setInterval(() => setNow(new Date()), 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const totalActive = waitingOrders.length + staff.filter((s) => s.status === "sibuk").length
  const idleCount = staff.filter((s) => s.status === "idle").length

  return loading ? (
    <div className="flex flex-1 flex-col items-center justify-center space-y-4 min-h-[60vh]">
      <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Menghubungkan ke monitor antrian...</p>
    </div>
  ) : (
    <div className="flex flex-1 flex-col p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border/50 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Papan Antrian Utama</h1>
          <p className="text-muted-foreground mt-1">
            Visualisasi status antrean Single Queue Multiple Server (SQMS) 4 Pegawai secara real-time.
          </p>
        </div>
        <div className="flex gap-4">
          <Card className="px-4 py-2 border-border/50 shadow-sm flex items-center gap-2">
            <IconBox className="size-5 text-primary" />
            <div className="text-xs">
              <p className="text-muted-foreground">Total Antrean</p>
              <p className="font-bold text-sm leading-tight">{totalActive} Nota</p>
            </div>
          </Card>
          <Card className="px-4 py-2 border-border/50 shadow-sm flex items-center gap-2">
            <IconActivity className="size-5 text-emerald-500" />
            <div className="text-xs">
              <p className="text-muted-foreground">Pegawai Idle</p>
              <p className="font-bold text-sm leading-tight">{idleCount} / {staff.length}</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* PANEL PEGAWAI & ANTREAN */}
        <div className="lg:col-span-2 space-y-6">
          {/* PANEL PEGAWAI (4 SERVER) */}
          <div>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <IconUser className="size-5 text-muted-foreground" />
              Status Pegawai ({idleCount}/{staff.length} Idle)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {staff.map((s) => (
                <Card
                  key={s.id}
                  className={`border-2 shadow-md transition-all duration-300 ${
                    s.status === "idle"
                      ? "border-emerald-400/50 bg-emerald-500/5"
                      : "border-amber-400/50 bg-amber-500/5"
                  }`}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold">{s.name}</CardTitle>
                      {s.status === "idle" ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-xs font-bold text-white">
                          <IconCircleDashed className="size-3 mr-1" />
                          Idle
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-600 border-none text-xs font-bold text-white animate-pulse">
                          <IconCircleCheck className="size-3 mr-1" />
                          Sibuk
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {s.status === "idle" ? (
                      <p className="text-xs text-muted-foreground">
                        Siap menerima pesanan berikutnya dari antrean.
                      </p>
                    ) : s.currentOrder ? (
                      <div className="space-y-1.5 mt-1">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Sedang memproses:
                        </p>
                        <p className="font-mono text-xs font-bold text-primary">
                          #{s.currentOrder.order_number || s.currentOrder.id.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-sm font-semibold">
                          {s.currentOrder.customer_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.currentOrder.total_items} item • EWP: {formatTime(s.currentOrder.ewp)}
                        </p>
                        {s.currentOrder.dequeued_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Mulai: {new Date(s.currentOrder.dequeued_at).toLocaleTimeString("id-ID")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Memproses pesanan...
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* ANTREAN MENUNGGU (MIN-HEAP) */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <IconHourglassHigh className="size-5 text-muted-foreground" />
            Antrean Menunggu ({waitingOrders.length} Pesanan)
          </h2>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="bg-sky-500/10 border-b border-sky-500/20 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sky-700 text-lg flex items-center gap-2">
                    <IconHourglassHigh className="size-5" /> Antrean Prioritas (Min-Heap EWP)
                  </CardTitle>
                  <CardDescription className="text-sky-700/70 text-xs mt-1">
                    Diurutkan berdasarkan EWP terkecil (prioritas tertinggi) — tie-breaker: waktu kedatangan
                  </CardDescription>
                </div>
                <Badge className="bg-sky-500 text-white font-bold text-base h-8 w-8 rounded-full flex items-center justify-center p-0">
                  {waitingOrders.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 min-h-[200px]">
              {waitingOrders.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Tidak ada pesanan dalam antrean
                </div>
              ) : (
                waitingOrders.map((order, idx) => (
                  <div
                    key={order.id}
                    className={`p-3 border rounded-lg transition-colors bg-background flex flex-col gap-2 relative overflow-hidden ${
                      idx === 0
                        ? "border-sky-400 ring-1 ring-sky-400/30 bg-sky-500/5"
                        : "hover:border-sky-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-sky-600">
                        #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          idx === 0
                            ? "bg-sky-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx === 0 ? "⭐ Prioritas #1" : `No. ${idx + 1}`}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <IconUser className="size-3 text-muted-foreground" />
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.total_items} item • Masuk: {new Date(order.created_at).toLocaleTimeString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-2 border-t text-xs">
                      <span className="text-muted-foreground">EWP: <strong className="text-foreground">{formatTime(order.ewp)}</strong></span>
                      <span className="text-muted-foreground font-semibold">{formatRupiah(order.total_price)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
