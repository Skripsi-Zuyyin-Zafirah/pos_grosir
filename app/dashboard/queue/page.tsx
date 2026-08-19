"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Receipt } from "@/components/receipt"
import { PriorityQueueService } from "@/lib/queue/priority-queue-service"
import { formatDuration } from "@/lib/queue/ewp"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  IconLoader2,
  IconAlertTriangle,
  IconClockHour4,
  IconPrinter,
  IconUserCircle,
  IconCheck,
  IconCash,
  IconPackage,
  IconShoppingBag,
  IconEye,
  IconChartBar,
  IconDownload,
  IconQrcode,
} from "@tabler/icons-react"

type Order = {
  id: string
  order_number: string | null
  created_at: string
  dequeued_at: string | null
  enqueued_at: string | null
  customer_name: string | null
  total_items: number
  total_price: number
  ewp: number
  status: "antri" | "diproses" | "selesai" | "batal"
  staff_id: string | null
  packed_at: string | null
  payment_method?: string | null
  payment_status?: string | null
  payment_proof_url?: string | null
  payment_channel?: string | null
}

type Staff = {
  id: string
  name: string
  status: "idle" | "sibuk" | null
}

type OrderItem = {
  id: string
  qty: number
  unit_price: number
  unit_name?: string | null
  products: { name: string; sku?: string | null; unit?: string | null } | null
}

type ReceiptOrder = Order & {
  order_items: OrderItem[]
  payment_method?: string | null
  payment_amount?: number
  change_amount?: number
  staff_name?: string | null
}

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })

export default function CashierDashboardPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [staffPool, setStaffPool] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<Date>(new Date())
  const [actionId, setActionId] = useState<string | null>(null)
  const [role, setRole] = useState<"admin" | "cashier">("cashier")
  const [manualStaff, setManualStaff] = useState<Record<string, string>>({})
  const [autoAssign, setAutoAssign] = useState(true)

  // Dialog cetak struk
  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrder | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)

  // Dialog detail pesanan
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [detailItems, setDetailItems] = useState<OrderItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Dialog konfirmasi pembayaran
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [payMethod, setPayMethod] = useState<"tunai" | "transfer" | "qris" | "online">("tunai")
  const [amountPaid, setAmountPaid] = useState("")
  const [paying, setPaying] = useState(false)

  // Dialog lihat bukti pembayaran
  const [proofModalOrder, setProofModalOrder] = useState<Order | null>(null)

  const calculatedChange =
    payOrder && !isNaN(parseFloat(amountPaid)) ? parseFloat(amountPaid) - payOrder.total_price : 0

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      // Fallback: open in new tab if fetch fails due to CORS or network issues
      window.open(url, "_blank")
    }
  }

  const fetchData = async () => {
    try {
      const [{ data: staffData, error: staffErr }, { data: activeOrders, error: orderErr }] =
        await Promise.all([
          supabase.from("staff").select("id, name, status").eq("is_active", true).order("name").limit(4),
          supabase.from("orders").select("*").in("status", ["antri", "diproses"]),
        ])
      if (staffErr) throw staffErr
      if (orderErr) throw orderErr

      setStaffPool(staffData || [])
      setOrders(activeOrders || [])
    } catch (err: any) {
      toast.error("Gagal memperbarui dashboard kasir: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
      if (profile?.role === "admin") setRole("admin")
    }
    fetchRole()

    fetchData()

    const channel = supabase
      .channel("cashier-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => fetchData())
      .subscribe()

    const interval = setInterval(() => setNow(new Date()), 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const getTimeLeft = (createdAtStr: string, ewpSeconds: number) => {
    const createdAt = new Date(createdAtStr)
    const deadline = new Date(createdAt.getTime() + ewpSeconds * 1000)
    return Math.ceil((deadline.getTime() - now.getTime()) / 1000 / 60)
  }

  // Min-Heap by EWP: root = pesanan dengan prioritas tertinggi (EWP terkecil)
  const waitingOrders = PriorityQueueService.getSortedQueue(orders.filter((o) => o.status === "antri"))

  const packingOrders = orders
    .filter((o) => o.status === "diproses" && !o.packed_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const readyOrders = orders
    .filter((o) => o.status === "diproses" && o.packed_at)
    .sort((a, b) => new Date(a.packed_at!).getTime() - new Date(b.packed_at!).getTime())

  // Estimasi tunggu (detik): akumulasi EWP pesanan di depannya dalam antrian
  const waitEstimate = (idx: number) =>
    Math.round(waitingOrders.slice(0, idx).reduce((sum, o) => sum + (o.ewp || 0), 0))

  // Statistik antrian (admin): rata-rata EWP & total estimasi waktu untuk menghabiskan seluruh antrian
  const avgEwp = waitingOrders.length
    ? Math.round((waitingOrders.reduce((sum, o) => sum + (o.ewp || 0), 0) / waitingOrders.length) * 10) / 10
    : 0
  const totalQueueClearSeconds = waitEstimate(waitingOrders.length)

  const idleStaff = staffPool.filter((s) => s.status === "idle")
  const staffName = (id: string | null) => staffPool.find((s) => s.id === id)?.name || "Pegawai"
  const staffOrder = (staffId: string) => packingOrders.find((o) => o.staff_id === staffId)
  const overdueCount = orders.filter((o) => getTimeLeft(o.created_at, o.ewp) <= 0).length

  // SECTION 2: assign ke pegawai idle (default: idle pertama, admin bisa override) + cetak struk
  const handleAssignAndPrint = async (order: Order, staffOverrideId?: string) => {
    const override = staffOverrideId ? staffPool.find((s) => s.id === staffOverrideId && s.status === "idle") : null
    const target = override || PriorityQueueService.findIdleStaff(staffPool)
    if (!target) {
      toast.error("Semua pegawai sedang sibuk. Tunggu ada yang selesai packing.")
      return
    }
    try {
      setActionId(order.id)
      const { error } = await supabase.rpc("assign_order_to_staff", {
        p_order_id: order.id,
        p_staff_id: target.id,
      })
      if (error) throw error
      toast.success(`Pesanan #${order.order_number || ""} ditugaskan ke ${target.name}`)
      setManualStaff((prev) => {
        const next = { ...prev }
        delete next[order.id]
        return next
      })
      await openReceipt({ ...order, staff_id: target.id })
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menugaskan pesanan: " + err.message)
    } finally {
      setActionId(null)
    }
  }

  // Distribusi otomatis: begitu ada pegawai idle & antrian tidak kosong,
  // cabut akar Min-Heap (EWP terkecil) dan tugaskan otomatis (EXTRACT-MIN).
  useEffect(() => {
    if (!autoAssign || loading || actionId) return
    if (idleStaff.length === 0 || waitingOrders.length === 0) return
    handleAssignAndPrint(waitingOrders[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAssign, idleStaff.length, waitingOrders.length, loading, actionId])

  // SECTION 3: tandai selesai packing (pegawai kembali idle)
  const handleCompletePacking = async (order: Order) => {
    try {
      setActionId(order.id)
      const { error } = await supabase.rpc("complete_packing", { p_order_id: order.id })
      if (error) throw error
      toast.success(`Pesanan #${order.order_number || ""} siap diambil. ${staffName(order.staff_id)} kembali bebas.`)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menandai selesai packing: " + err.message)
    } finally {
      setActionId(null)
    }
  }

  // SECTION 4: konfirmasi pembayaran
  const handleConfirmPayment = async () => {
    if (!payOrder) return
    const paidVal = parseFloat(amountPaid)
    if (isNaN(paidVal) || paidVal < payOrder.total_price) {
      toast.error("Jumlah bayar kurang atau tidak valid")
      return
    }
    try {
      setPaying(true)
      const { error } = await supabase.rpc("finalize_order_payment", {
        p_order_id: payOrder.id,
        p_staff_id: payOrder.staff_id,
        p_payment_method: payMethod === "tunai" ? "tunai" : "online",
        p_payment_channel: payMethod,
      })
      if (error) throw error
      toast.success(`Pembayaran pesanan #${payOrder.order_number || ""} berhasil dikonfirmasi!`)
      
      const finalizedOrder: Order = {
        ...payOrder,
        payment_method: payMethod === "tunai" ? "tunai" : "online",
        payment_channel: payMethod,
      }
      setPayOrder(null)

      // Open receipt showing the payment details
      await openReceipt(finalizedOrder, {
        method: payMethod,
        amount: paidVal,
        change: payMethod === "tunai" ? paidVal - finalizedOrder.total_price : 0,
      })

      fetchData()
    } catch (err: any) {
      toast.error("Gagal konfirmasi pembayaran: " + err.message)
    } finally {
      setPaying(false)
    }
  }

  const fetchItems = async (orderId: string): Promise<OrderItem[]> => {
    const { data, error } = await supabase
      .from("order_items")
      .select("id, qty, unit_price, unit_name, products:product_id ( name, sku, unit )")
      .eq("order_id", orderId)
    if (error) throw error
    return (data as any) || []
  }

  const openReceipt = async (
    order: Order,
    paymentInfo?: { method: string; amount: number; change: number }
  ) => {
    try {
      setLoadingReceipt(true)
      const baseReceiptOrder: ReceiptOrder = {
        ...order,
        order_items: [],
        staff_name: staffName(order.staff_id || null),
        ...(paymentInfo && {
          payment_method: paymentInfo.method === "tunai" ? "tunai" : "online",
          payment_channel: paymentInfo.method,
          payment_amount: paymentInfo.amount,
          change_amount: paymentInfo.change,
        }),
      }
      setReceiptOrder(baseReceiptOrder)
      const items = await fetchItems(order.id)
      setReceiptOrder({
        ...baseReceiptOrder,
        order_items: items,
      })
    } catch (err: any) {
      toast.error("Gagal memuat struk: " + err.message)
      setReceiptOrder(null)
    } finally {
      setLoadingReceipt(false)
    }
  }

  const openDetail = async (order: Order) => {
    try {
      setLoadingDetail(true)
      setDetailOrder(order)
      setDetailItems(await fetchItems(order.id))
    } catch (err: any) {
      toast.error("Gagal memuat detail: " + err.message)
      setDetailOrder(null)
    } finally {
      setLoadingDetail(false)
    }
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
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border/50">
            <div>
              <h1 className="text-lg font-semibold">Kasir & Pembayaran</h1>
              <p className="text-xs text-muted-foreground">
                Assign pesanan ke pegawai, cetak struk, tandai selesai packing, lalu konfirmasi pembayaran.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-rose-600 font-semibold text-xs">
                  <IconAlertTriangle className="size-4" /> {overdueCount} terlambat
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant={autoAssign ? "default" : "outline"}
                onClick={() => setAutoAssign((v) => !v)}
                title="Aktif: sistem otomatis EXTRACT-MIN dari Min-Heap begitu ada pegawai idle. Nonaktif: assign manual saja."
              >
                {autoAssign ? <IconCheck className="size-4 mr-1.5" /> : null}
                Auto-Assign {autoAssign ? "Aktif" : "Nonaktif"}
              </Button>
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
              {/* ============ STATISTIK ANTRIAN (ADMIN) ============ */}
              {role === "admin" && (
                <section>
                  <SectionTitle icon={<IconChartBar className="size-4" />} title="Statistik Antrian" hint="Min-Heap / EWP" />
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <StatCard label="Menunggu" value={waitingOrders.length} suffix="pesanan" />
                    <StatCard label="Diproses" value={packingOrders.length} suffix="pesanan" />
                    <StatCard label="Rata-rata EWP" value={formatDuration(avgEwp)} suffix="/pesanan" />
                    <StatCard label="Estimasi Kosongkan Antrian" value={formatDuration(totalQueueClearSeconds)} />
                    <StatCard
                      label="Pegawai Idle"
                      value={idleStaff.length}
                      suffix={`dari ${staffPool.length}`}
                      accent={idleStaff.length === 0 ? "text-rose-600" : "text-emerald-600"}
                    />
                  </div>
                </section>
              )}

              {/* ============ SECTION 1: STATUS PEGAWAI (REAL-TIME) ============ */}
              <section>
                <SectionTitle icon={<IconUserCircle className="size-4" />} title="Status Pegawai" hint="real-time" />
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {staffPool.map((staff) => {
                    const order = staffOrder(staff.id)
                    const busy = staff.status === "sibuk"
                    return (
                      <div
                        key={staff.id}
                        className={cn(
                          "rounded-xl border p-4 flex flex-col gap-1.5",
                          busy
                            ? "border-amber-500/30 bg-amber-500/[0.04]"
                            : "border-emerald-500/30 bg-emerald-500/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg leading-none">👷</span>
                          <span className="font-semibold text-sm truncate">{staff.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className={cn("size-2 rounded-full", busy ? "bg-rose-500" : "bg-emerald-500")} />
                          <span className={busy ? "text-rose-600" : "text-emerald-600"}>
                            {busy ? "Sibuk" : "Idle"}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {order ? `#${order.order_number || order.id.substring(0, 8).toUpperCase()}` : "-"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {order ? `EWP: ${formatDuration(order.ewp)}` : " "}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* ============ SECTION 2: ANTRIAN MENUNGGU ============ */}
              <section className="flex flex-col rounded-xl border border-border overflow-hidden">
                <SectionHeader
                  icon={<IconClockHour4 className="size-4" />}
                  title="Antrian Menunggu"
                  subtitle="Belum di-assign ke pegawai"
                  count={waitingOrders.length}
                />
                <div className="flex flex-col divide-y divide-border">
                  {waitingOrders.length === 0 ? (
                    <EmptyRow text="Tidak ada pesanan menunggu" />
                  ) : (
                    waitingOrders.map((order, idx) => {
                      const timeLeft = getTimeLeft(order.created_at, order.ewp)
                      const isOverdue = timeLeft <= 0
                      const estimate = waitEstimate(idx)
                      return (
                        <div
                          key={order.id}
                          className={cn(
                            "flex flex-wrap items-center gap-3 px-4 py-3",
                            isOverdue && "bg-rose-500/5 border-l-2 border-l-rose-500"
                          )}
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-black tabular-nums px-1.5",
                                  idx === 0 && "bg-primary/10 text-primary border-primary/30"
                                )}
                              >
                                #{idx + 1} PRIORITAS
                              </Badge>
                              <span className="font-mono text-sm font-bold">
                                #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                              </span>
                              <span className="text-sm text-muted-foreground truncate">
                                {order.customer_name || "-"}
                              </span>
                              <TimeBadge timeLeft={timeLeft} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              📦 {order.total_items} item &middot; EWP: {formatDuration(order.ewp)} &middot; Masuk:{" "}
                              {formatClock(order.created_at)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              💰 <span className="font-semibold text-foreground">{formatRupiah(order.total_price)}</span>{" "}
                              &middot; 🕐 Estimasi: {formatDuration(estimate)}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0 items-center">
                            {role === "admin" && idleStaff.length > 0 && (
                              <Select
                                value={manualStaff[order.id] || ""}
                                onValueChange={(val) => setManualStaff((prev) => ({ ...prev, [order.id]: val }))}
                              >
                                <SelectTrigger className="h-8 w-36 text-xs" title="Override: pilih pegawai manual (admin)">
                                  <SelectValue placeholder="Auto (idle pertama)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {idleStaff.map((s) => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              size="sm"
                              disabled={idleStaff.length === 0 || actionId === order.id}
                              onClick={() => handleAssignAndPrint(order, manualStaff[order.id])}
                            >
                              {actionId === order.id ? (
                                <IconLoader2 className="size-4 mr-1.5 animate-spin" />
                              ) : (
                                <IconPrinter className="size-4 mr-1.5" />
                              )}
                              Cetak Struk &amp; Assign
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openDetail(order)}>
                              <IconEye className="size-4 mr-1.5" /> Detail
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {waitingOrders.length > 0 && idleStaff.length === 0 && (
                  <div className="px-4 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border-t border-amber-500/20">
                    Semua pegawai sibuk — selesaikan packing dulu untuk assign pesanan berikutnya.
                  </div>
                )}
              </section>

              {/* ============ SECTION 3: SEDANG DIPROSES / DIKEMAS ============ */}
              <section className="flex flex-col rounded-xl border border-border overflow-hidden">
                <SectionHeader
                  icon={<IconPackage className="size-4" />}
                  title="Sedang Diproses / Dikemas"
                  subtitle="Pegawai sedang kerja"
                  count={packingOrders.length}
                />
                <div className="flex flex-col divide-y divide-border">
                  {packingOrders.length === 0 ? (
                    <EmptyRow text="Tidak ada pesanan sedang dikemas" />
                  ) : (
                    packingOrders.map((order) => (
                      <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-sm text-muted-foreground truncate">{order.customer_name || "-"}</span>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="font-semibold gap-1">
                              👷 {staffName(order.staff_id)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            📦 {order.total_items} item &middot; EWP: {formatDuration(order.ewp)}
                            {order.dequeued_at && <> &middot; Mulai: {formatClock(order.dequeued_at)}</>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            💰 <span className="font-semibold text-foreground">{formatRupiah(order.total_price)}</span>
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                            disabled={actionId === order.id}
                            onClick={() => handleCompletePacking(order)}
                          >
                            {actionId === order.id ? (
                              <IconLoader2 className="size-4 mr-1.5 animate-spin" />
                            ) : (
                              <IconCheck className="size-4 mr-1.5" />
                            )}
                            Selesai Packing
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReceipt(order)}
                          >
                            <IconPrinter className="size-4 mr-1.5" /> Struk
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDetail(order)}>
                            <IconEye className="size-4 mr-1.5" /> Detail
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* ============ SECTION 4: SIAP DIAMBIL ============ */}
              <section className="flex flex-col rounded-xl border border-border overflow-hidden">
                <SectionHeader
                  icon={<IconShoppingBag className="size-4" />}
                  title="Siap Diambil"
                  subtitle="Menunggu pembayaran"
                  count={readyOrders.length}
                />
                <div className="flex flex-col divide-y divide-border">
                  {readyOrders.length === 0 ? (
                    <EmptyRow text="Tidak ada pesanan menunggu diambil" />
                  ) : (
                    readyOrders.map((order) => (
                      <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-sm text-muted-foreground truncate">{order.customer_name || "-"}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            📦 {order.total_items} item
                            {order.packed_at && <> &middot; Selesai: {formatClock(order.packed_at)}</>}
                          </p>
                          <div className="pt-0.5">
                            {order.payment_method === "online" ? (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 font-semibold text-[10px] px-2 py-0.5 rounded">
                                {order.payment_channel === "qris" || order.payment_proof_url?.includes("qris_")
                                  ? "QRIS Digital (Menunggu Verifikasi)"
                                  : "Transfer Bank (Menunggu Verifikasi)"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold text-[10px] px-2 py-0.5 rounded">
                                🟢 Tunai (Belum Dibayar)
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            💰 <span className="font-bold text-foreground">{formatRupiah(order.total_price)}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0 flex-wrap">
                          {order.payment_method === "online" ? (
                            <>
                              {order.payment_proof_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs px-2.5 h-8 font-semibold"
                                  onClick={() => setProofModalOrder(order)}
                                >
                                  👁️ Lihat Bukti
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 h-8"
                                onClick={() => {
                                  setPayMethod("online")
                                  setAmountPaid(order.total_price.toString())
                                  setPayOrder(order)
                                }}
                              >
                                ✅ Konfirmasi
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs px-2.5 h-8"
                                onClick={() => openReceipt(order)}
                              >
                                <IconPrinter className="size-3.5 mr-1" /> Struk
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 h-8"
                              onClick={() => {
                                setPayMethod("tunai")
                                setAmountPaid(order.total_price.toString())
                                setPayOrder(order)
                              }}
                            >
                              ✅ Konfirmasi Pembayaran
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs px-2.5 h-8"
                            onClick={() => openDetail(order)}
                          >
                            <IconEye className="size-3.5 mr-1" /> Detail
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Dialog cetak struk */}
      <Dialog open={!!receiptOrder} onOpenChange={(v) => !v && setReceiptOrder(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {receiptOrder?.payment_method ? "Transaksi Selesai / Struk Belanja" : "Cetak Struk Pesanan"}
            </DialogTitle>
            <DialogDescription>
              {receiptOrder?.payment_method ? (
                "Transaksi telah selesai dibayar. Cetak struk belanja untuk pelanggan."
              ) : (
                <>
                  Cetak dan serahkan struk ini ke{" "}
                  <span className="font-semibold text-foreground">{staffName(receiptOrder?.staff_id || null)}</span>{" "}
                  untuk diproses.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {loadingReceipt || !receiptOrder ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <Receipt order={receiptOrder} />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog lihat bukti pembayaran */}
      <Dialog open={!!proofModalOrder} onOpenChange={(v) => !v && setProofModalOrder(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconQrcode className="size-5 text-yellow-500" /> Bukti Pembayaran
            </DialogTitle>
            <DialogDescription>
              Pesanan #{proofModalOrder?.order_number || proofModalOrder?.id.substring(0, 8).toUpperCase()} - {proofModalOrder?.customer_name || "-"}
            </DialogDescription>
          </DialogHeader>
          
          {proofModalOrder && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border rounded-lg overflow-hidden max-h-[45vh]">
                {proofModalOrder.payment_proof_url ? (
                  <img
                    src={proofModalOrder.payment_proof_url}
                    alt="Bukti Transfer"
                    className="max-h-[40vh] object-contain rounded border"
                  />
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    Tidak ada file bukti pembayaran
                  </div>
                )}
              </div>
              
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
                <span className="font-bold text-foreground block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Informasi Tambahan:
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">• Metode:</span>
                    <span className="font-semibold text-foreground">
                      {proofModalOrder.payment_channel === "qris" || proofModalOrder.payment_proof_url?.includes("qris_")
                        ? "QRIS Digital"
                        : "Transfer Bank (BSI)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">• Nominal Transfer:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(proofModalOrder.total_price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">• Waktu Upload:</span>
                    <span className="font-semibold text-foreground">
                      {proofModalOrder.enqueued_at 
                        ? new Date(proofModalOrder.enqueued_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }) 
                        : new Date(proofModalOrder.created_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="sm:justify-end gap-2">
            {proofModalOrder?.payment_proof_url && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadFile(proofModalOrder.payment_proof_url!, `bukti_pesanan_${proofModalOrder.order_number || "order"}.jpg`)}
              >
                <IconDownload className="size-4 mr-1.5" /> Download Bukti
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setProofModalOrder(null)}
            >
              ✓ Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detail pesanan */}
      <Dialog open={!!detailOrder} onOpenChange={(v) => !v && setDetailOrder(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detail Pesanan #{detailOrder?.order_number || detailOrder?.id.substring(0, 8).toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              {detailOrder?.customer_name || "-"} &middot; Masuk{" "}
              {detailOrder ? new Date(detailOrder.created_at).toLocaleString("id-ID") : ""}
            </DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barang</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">
                            {item.products?.name || "Produk Terhapus"}
                          </p>
                          {item.products?.sku && (
                            <p className="text-[10px] font-mono text-muted-foreground">{item.products.sku}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.qty} {item.unit_name || item.products?.unit || "pcs"}
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatRupiah(item.unit_price)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatRupiah(item.qty * item.unit_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Total ({detailOrder?.total_items} item &middot; EWP {detailOrder ? formatDuration(detailOrder.ewp) : "-"})
                </span>
                <span className="text-lg font-bold">
                  {detailOrder ? formatRupiah(detailOrder.total_price) : "-"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi pembayaran */}
      <Dialog open={!!payOrder} onOpenChange={(v) => !paying && !v && setPayOrder(null)}>
        {payOrder?.payment_method === "online" ? (
          <DialogContent className="sm:max-w-sm text-foreground">
            <DialogHeader>
              <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  Pesanan: <span className="font-mono font-bold text-foreground">#{payOrder?.order_number || payOrder?.id.substring(0, 8).toUpperCase()}</span>
                </p>
                <p className="text-sm font-bold">
                  Total: <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(payOrder?.total_price)}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg p-2.5 font-semibold text-[11px]">
                <IconCheck className="size-4 shrink-0" />
                <span>Bukti pembayaran sudah diverifikasi</span>
              </div>
            </div>
            <DialogFooter className="sm:justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPayOrder(null)} disabled={paying}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPayment}
                disabled={paying}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {paying ? (
                  <>
                    <IconLoader2 className="size-4 mr-1.5 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>✓ Ya, Konfirmasi Lunas</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : (
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
              <DialogDescription>
                Pesanan{" "}
                <span className="font-mono font-bold text-foreground">
                  #{payOrder?.order_number || payOrder?.id.substring(0, 8).toUpperCase()}
                </span>{" "}
                atas nama <span className="font-semibold text-foreground">{payOrder?.customer_name || "-"}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Tagihan</span>
                <span className="text-lg font-bold">{payOrder ? formatRupiah(payOrder.total_price) : "-"}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Metode Pembayaran</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={payMethod === "tunai" ? "default" : "outline"}
                    className="w-full text-xs font-semibold px-1"
                    onClick={() => {
                      setPayMethod("tunai")
                    }}
                    disabled={paying}
                  >
                    Tunai / Cash
                  </Button>
                  <Button
                    type="button"
                    variant={payMethod === "transfer" ? "default" : "outline"}
                    className="w-full text-xs font-semibold px-1"
                    onClick={() => {
                      setPayMethod("transfer")
                      if (payOrder) {
                        setAmountPaid(payOrder.total_price.toString())
                      }
                    }}
                    disabled={paying}
                  >
                    Transfer Bank
                  </Button>
                  <Button
                    type="button"
                    variant={payMethod === "qris" ? "default" : "outline"}
                    className="w-full text-xs font-semibold px-1"
                    onClick={() => {
                      setPayMethod("qris")
                      if (payOrder) {
                        setAmountPaid(payOrder.total_price.toString())
                      }
                    }}
                    disabled={paying}
                  >
                    QRIS Digital
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amtPaid">Jumlah Uang Diterima (IDR)</Label>
                <Input
                  id="amtPaid"
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  required
                  disabled={paying || payMethod !== "tunai"}
                />
              </div>
              {payMethod === "tunai" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-primary">Kembalian:</span>
                  <span className={cn("text-lg font-bold", calculatedChange < 0 ? "text-rose-500" : "text-primary")}>
                    {calculatedChange < 0 ? "Kurang bayar" : formatRupiah(calculatedChange)}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOrder(null)} disabled={paying}>
                Batal
              </Button>
              <Button
                onClick={handleConfirmPayment}
                disabled={paying || isNaN(parseFloat(amountPaid)) || (!!payOrder && parseFloat(amountPaid) < payOrder.total_price)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {paying ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>Konfirmasi Lunas</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </SidebarProvider>
  )
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground">({hint})</span>}
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: number | string
  suffix?: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", accent)}>
        {value} {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  subtitle,
  count,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  count: number
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">— {subtitle}</span>
      </div>
      <span className="text-xs text-muted-foreground font-medium tabular-nums">Total: {count} pesanan</span>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
}

function TimeBadge({ timeLeft }: { timeLeft: number }) {
  const isOverdue = timeLeft <= 0
  return (
    <span
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
    </span>
  )
}
