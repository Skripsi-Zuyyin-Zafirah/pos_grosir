"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PriorityQueueService } from "@/lib/queue/priority-queue-service"
import { formatDuration } from "@/lib/queue/ewp"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  IconLoader2,
  IconArrowLeft,
  IconClock,
  IconX,
  IconCreditCard,
  IconUserCog,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconBan,
  IconPackageOff,
  IconListNumbers,
  IconHourglassHigh,
} from "@tabler/icons-react"

type OrderItem = {
  id: string
  unit_price: number
  qty: number
  unit_name?: string | null
  products: {
    name: string
    unit: string | null
  } | null
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
  payment_method: string | null
  payment_channel: string | null
  completed_at: string | null
  enqueued_at: string | null
  dequeued_at: string | null
  packed_at: string | null
  staff: { name: string; status: string } | null
  order_items: OrderItem[]
}

export default function CustomerOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [waitEstimate, setWaitEstimate] = useState<number | null>(null)
  const [queueLength, setQueueLength] = useState(0)

  const fetchOrder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items (*, products ( name, unit )), staff:staff_id ( name, status )")
        .eq("id", params.id)
        .eq("user_id", session.user.id)
        .single()

      if (error) throw error
      const fetchedOrder = (data as any as Order) || null
      setOrder(fetchedOrder)

      if (fetchedOrder?.status === "antri") {
        const { data: waitingQueue, error: queueErr } = await supabase
          .from("orders")
          .select("id, ewp, created_at")
          .eq("status", "antri")
        if (queueErr) throw queueErr

        const queue = waitingQueue || []
        setQueueLength(queue.length)
        setQueuePosition(PriorityQueueService.getPositions(queue).get(fetchedOrder.id) ?? null)
        setWaitEstimate(PriorityQueueService.getWaitEstimates(queue).get(fetchedOrder.id) ?? null)
      } else {
        setQueuePosition(null)
        setWaitEstimate(null)
        setQueueLength(0)
      }
    } catch (err: any) {
      toast.error("Gagal memuat detail pesanan: " + err.message)
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()

    // Tanpa filter: posisi antrian dipengaruhi perubahan pesanan pelanggan lain juga.
    const channel = supabase
      .channel(`customer-order-detail-${params.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrder()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [params.id])

  const handleCancelOrder = async () => {
    if (!order) return
    if (!confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) return
    setCancelling(true)

    try {
      const { error } = await supabase.rpc("cancel_order_transaction", {
        p_order_id: order.id,
      })
      if (error) throw error

      toast.success("Pesanan berhasil dibatalkan!")
      fetchOrder()
    } catch (err: any) {
      toast.error("Gagal membatalkan pesanan: " + err.message)
    } finally {
      setCancelling(false)
    }
  }

  const getStatusBadge = (order: Order) => {
    if (order.status === "diproses" && order.packed_at) {
      return <Badge className="bg-indigo-500 hover:bg-indigo-600 border-none font-semibold">SIAP DIAMBIL</Badge>
    }
    switch (order.status) {
      case "antri":
        return <Badge className="bg-sky-500 hover:bg-sky-600 border-none font-semibold">ANTRI</Badge>
      case "diproses":
        return <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-semibold">DIPROSES</Badge>
      case "selesai":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold">SELESAI</Badge>
      case "batal":
        return <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold">BATAL</Badge>
      default:
        return <Badge variant="outline">{order.status}</Badge>
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimelineSteps = (o: Order) => {
    const steps = [
      { label: "Pesanan Dibuat", time: o.created_at, done: true },
      { label: "Masuk Antrian Gudang", time: o.enqueued_at || o.created_at, done: ["antri", "diproses", "selesai", "batal"].includes(o.status) },
      { label: "Diproses & Dikemas", time: o.dequeued_at, done: !!o.dequeued_at || ["diproses", "selesai"].includes(o.status) },
      { label: "Siap Diambil", time: o.packed_at, done: !!o.packed_at || o.status === "selesai" },
      {
        label: o.status === "batal" ? "Dibatalkan" : "Selesai & Diambil",
        time: o.completed_at,
        done: o.status === "selesai" || o.status === "batal",
      },
    ]
    return steps
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
        <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
              <Link href="/customer/orders">
                <IconArrowLeft className="size-4 mr-1.5" /> Kembali ke Riwayat Pesanan
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Detail Pesanan</h1>
            <p className="text-muted-foreground mt-1">
              Rincian lengkap produk, status, dan riwayat proses pesanan Anda.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Memuat detail pesanan...</p>
            </div>
          ) : !order ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
              <IconPackageOff className="size-16 text-muted-foreground/60 mb-2" />
              <h3 className="font-semibold text-lg">Pesanan Tidak Ditemukan</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Pesanan ini tidak ada atau bukan milik akun Anda.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/customer/orders">Kembali ke Riwayat Pesanan</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Kolom kiri: ringkasan & timeline */}
              <div className="space-y-6">
                <Card className="border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle>Ringkasan Pesanan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-4 text-sm bg-muted/30 rounded-lg p-4">
                      <div>
                        <p className="text-muted-foreground text-xs">No. Pesanan</p>
                        <p className="font-mono font-bold">
                          #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Atas Nama</p>
                        <p className="font-medium">{order.customer_name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Status</p>
                         <div className="mt-0.5">{getStatusBadge(order)}</div>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <IconCreditCard className="size-3" /> Metode Bayar
                        </p>
                        <p className="font-medium uppercase">
                          {order.payment_channel
                            ? order.payment_channel === "transfer"
                              ? "ONLINE (TRANSFER BANK)"
                              : order.payment_channel === "qris"
                              ? "ONLINE (QRIS)"
                              : order.payment_channel
                            : order.payment_method || "Belum dibayar"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <IconUserCog className="size-3" /> Ditangani Oleh
                        </p>
                        <p className="font-medium">{order.staff?.name || "Belum ditugaskan"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <IconClock className="size-3" /> Estimasi Kemas
                        </p>
                        <p className="font-medium">{formatDuration(order.ewp)}</p>
                      </div>
                      {order.status === "antri" && queuePosition !== null && (
                        <div>
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <IconListNumbers className="size-3" /> Posisi Antrian
                          </p>
                          <p className="font-medium">
                            #{queuePosition} dari {queueLength}
                          </p>
                        </div>
                      )}
                      {order.status === "antri" && waitEstimate !== null && (
                        <div>
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <IconHourglassHigh className="size-3" /> Estimasi Tunggu
                          </p>
                          <p className="font-medium">
                            {formatDuration(waitEstimate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle>Riwayat Proses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-0">
                      {getTimelineSteps(order).map((step, i, arr) => (
                        <div key={step.label} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            {step.done ? (
                              order.status === "batal" && i === arr.length - 1 ? (
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
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(step.time) || "Menunggu"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Kolom kanan: rincian produk & total */}
              <div className="space-y-6">
                <Card className="border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle>Rincian Produk</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produk</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.order_items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.products?.name}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.qty} {item.unit_name || item.products?.unit || "pcs"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatRupiah(item.unit_price * item.qty)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="space-y-1.5 text-sm border-t pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Item:</span>
                        <span className="font-semibold">{order.total_items} unit</span>
                      </div>
                      <div className="flex justify-between text-base border-t pt-2">
                        <span className="font-semibold">Total Pembayaran:</span>
                        <span className="font-bold text-lg text-primary">
                          {formatRupiah(order.total_price)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {order.status === "antri" && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleCancelOrder}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <>
                        <IconLoader2 className="size-4 mr-1.5 animate-spin" /> Membatalkan...
                      </>
                    ) : (
                      <>
                        <IconX className="size-4 mr-1.5" /> Batalkan Pesanan
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
