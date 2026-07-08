"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPackage,
  IconClock,
  IconX,
  IconEye,
  IconRefresh,
  IconHistory,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string
  unit_price: number
  qty: number
  products: {
    name: string
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
  payment_method: "tunai" | "online" | null
  order_items: OrderItem[]
}

const ACTIVE_STATUSES = ["antri", "diproses"] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)} detik`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return remainingSeconds > 0 ? `${minutes} menit ${remainingSeconds} detik` : `${minutes} menit`
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

const getStatusBadge = (status: string) => {
  switch (status) {
    case "antri":
      return (
        <Badge className="bg-sky-500 hover:bg-sky-600 border-none font-semibold">
          ANTRI
        </Badge>
      )
    case "diproses":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-semibold">
          DIPROSES
        </Badge>
      )
    case "selesai":
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold">
          SELESAI
        </Badge>
      )
    case "batal":
      return (
        <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold">
          BATAL
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomerOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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
        .select("*, order_items (id, qty, unit_price, products ( name ))")
        .eq("user_id", session.user.id)
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })

      if (error) throw error
      setOrders((data as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat pesanan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel("customer-orders-realtime")
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

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) return
    setCancellingId(orderId)

    try {
      const { error } = await supabase.rpc("cancel_order_transaction", {
        p_order_id: orderId,
      })

      if (error) throw error

      toast.success("Pesanan berhasil dibatalkan!")
      setDetailsOpen(false)
      fetchOrders()
    } catch (err: any) {
      toast.error("Gagal membatalkan pesanan: " + err.message)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pesanan Saya</h1>
          <p className="text-muted-foreground mt-1">
            Pantau status pesanan aktif Anda secara real-time.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          className="w-fit"
        >
          <IconRefresh className="size-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Memuat pesanan aktif...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
          <IconPackage className="size-16 text-muted-foreground/60 mb-2" />
          <h3 className="font-semibold text-lg">Tidak Ada Pesanan Aktif</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Anda tidak memiliki pesanan yang sedang berjalan saat ini.
          </p>
          <div className="flex gap-2 mt-4">
            <Button asChild>
              <Link href="/customer/shop">Mulai Belanja</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/customer/transactions">
                <IconHistory className="size-4 mr-1.5" />
                Riwayat Transaksi
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="border-border/50 shadow-md hover:shadow-lg transition-all duration-300 bg-background"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <CardDescription>
                      Dipesan pada: {new Date(order.created_at).toLocaleString("id-ID")}
                    </CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Total Pembayaran</p>
                    <p className="text-lg font-bold text-primary">
                      {formatRupiah(order.total_price)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconClock className="size-4" />
                  <span>
                    Estimasi Waktu Proses (EWP):{" "}
                    <strong>{formatTime(order.ewp)}</strong>
                  </span>
                </div>
                {order.payment_method && (
                  <div className="text-sm">
                    Metode Bayar:{" "}
                    <span className="font-semibold capitalize">
                      {order.payment_method === "tunai" ? "Tunai" : "Online"}
                    </span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t border-border/50 flex gap-2 justify-end bg-muted/5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrder(order)
                    setDetailsOpen(true)
                  }}
                >
                  <IconEye className="size-4 mr-1.5" /> Detail
                </Button>
                {order.status === "antri" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={cancellingId === order.id}
                  >
                    {cancellingId === order.id ? (
                      <>
                        <IconLoader2 className="mr-1.5 size-4 animate-spin" />
                        Membatalkan...
                      </>
                    ) : (
                      <>
                        <IconX className="size-4 mr-1.5" /> Batalkan
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Pesanan</DialogTitle>
            <DialogDescription>
              Detail produk dan kuantitas barang yang Anda pesan.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">No. Pesanan</p>
                  <p className="font-mono font-bold">
                    #{selectedOrder.order_number || selectedOrder.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Atas Nama</p>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Estimasi EWP</p>
                  <p className="font-medium">{formatTime(selectedOrder.ewp)}</p>
                </div>
              </div>

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
                    {selectedOrder.order_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.products?.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.qty} pcs
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
                <div className="flex justify-between text-base border-t pt-2">
                  <span className="font-semibold">Total Pembayaran:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatRupiah(selectedOrder.total_price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            {selectedOrder?.status === "antri" && (
              <Button
                variant="destructive"
                onClick={() => handleCancelOrder(selectedOrder.id)}
                disabled={cancellingId === selectedOrder.id}
              >
                Batalkan Pesanan
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
