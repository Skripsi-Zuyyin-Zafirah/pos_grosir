"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { IconLoader2, IconPackage, IconClock, IconCheck, IconX, IconEye, IconRefresh } from "@tabler/icons-react"

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
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
  payment_status: "unpaid" | "paid" | null
  order_items: OrderItem[]
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchUserAndOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        // Not logged in
        setLoading(false)
        router.push("/login")
        return
      }
      setUser(session.user)

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items (*, products ( name ))")
        .eq("user_id", session.user.id)
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
    fetchUserAndOrders()

    // Subscribe to real-time order updates
    const channel = supabase
      .channel("customer-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          // Re-fetch when any order changes
          fetchUserAndOrders()
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
      // Call RPC function to update order and optionally handle staff
      const { error } = await supabase.rpc("cancel_order_transaction", {
        p_order_id: orderId,
      })

      if (error) throw error

      toast.success("Pesanan berhasil dibatalkan!")
      setDetailsOpen(false)
      fetchUserAndOrders()
    } catch (err: any) {
      toast.error("Gagal membatalkan pesanan: " + err.message)
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return (
          <Badge className="bg-sky-500 hover:bg-sky-600 border-none font-semibold">
            ANTRI
          </Badge>
        )
      case "processing":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-semibold">
            DIPROSES
          </Badge>
        )
      case "ready":
        return (
          <Badge className="bg-indigo-500 hover:bg-indigo-600 border-none font-semibold">
            SIAP DIAMBIL
          </Badge>
        )
      case "done":
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold">
            SELESAI
          </Badge>
        )
      case "cancelled":
        return (
          <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold">
            BATAL
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Riwayat & Status Pesanan</h1>
            <p className="text-muted-foreground mt-1">
              Pantau status pesanan dan antrian Anda secara real-time.
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchUserAndOrders}>
            <IconRefresh className="size-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Memuat riwayat pesanan...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
            <IconPackage className="size-16 text-muted-foreground/60 mb-2" />
            <h3 className="font-semibold text-lg">Belum Ada Pesanan</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Anda belum pernah melakukan pemesanan. Silakan berbelanja di katalog terlebih dahulu.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/">Mulai Belanja</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="border-border/50 shadow-md hover:shadow-lg transition-all duration-300 bg-background">
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
                      <p className="text-lg font-bold text-primary">{formatRupiah(order.total_price)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconClock className="size-4" />
                    <span>Estimasi Waktu Proses (ECT): <strong>{order.ewp} menit</strong></span>
                  </div>
                  <div className="text-sm">
                    Status Bayar:{" "}
                    {order.payment_status === "paid" ? (
                      <span className="text-emerald-600 font-semibold">Sudah Lunas</span>
                    ) : (
                      <span className="text-rose-500 font-semibold">Belum Dibayar</span>
                    )}
                  </div>
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
                  {order.status === "waiting" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingId === order.id}
                    >
                      {cancellingId === order.id ? (
                        <>
                          <IconLoader2 className="mr-1.5 size-4 animate-spin" /> Membatalkan...
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
      </div>

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
                        <TableCell className="font-medium">{item.products?.name}</TableCell>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Item:</span>
                  <span className="font-semibold">{selectedOrder.total_items} unit</span>
                </div>
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
            {selectedOrder?.status === "waiting" && (
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
      </SidebarInset>
    </SidebarProvider>
  )
}
