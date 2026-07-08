"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  IconLoader2,
  IconSearch,
  IconCash,
  IconCreditCard,
  IconFileCheck,
  IconPrinter,
  IconUser,
  IconClock,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string
  qty: number
  unit_price: number
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
  staff_id: string | null
  payment_method: "tunai" | "online" | null
  order_items: OrderItem[]
  // Runtime-only for receipt
  _paid_amount?: number
  _change_amount?: number
  _payment_label?: string
  _staff_name?: string
}

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
  const remaining = Math.round(seconds % 60)
  return remaining > 0 ? `${minutes} menit ${remaining} detik` : `${minutes} menit`
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CashierPage() {
  const supabase = createClient()
  const [processingOrders, setProcessingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modal state
  const [payOpen, setPayOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Selected order & payment fields
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "online">("tunai")
  const [amountPaid, setAmountPaid] = useState("")

  const fetchProcessingOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items (id, qty, unit_price, products ( name ))")
        .eq("status", "diproses")
        .order("dequeued_at", { ascending: true })

      if (error) throw error
      setProcessingOrders((data as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat pesanan diproses: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProcessingOrders()

    const channel = supabase
      .channel("cashier-processing-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchProcessingOrders()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Open payment dialog
  const handlePayOpen = (order: Order) => {
    setSelectedOrder(order)
    setPaymentMethod("tunai")
    setAmountPaid(order.total_price.toString())
    setPayOpen(true)
  }

  // Submit payment
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return
    setSubmitting(true)

    const paidVal = parseFloat(amountPaid)
    if (paymentMethod === "tunai" && (isNaN(paidVal) || paidVal < selectedOrder.total_price)) {
      toast.error("Jumlah bayar kurang atau tidak valid")
      setSubmitting(false)
      return
    }

    try {
      const finalPaid = paymentMethod === "online" ? selectedOrder.total_price : paidVal

      const { error } = await supabase.rpc("finalize_order_payment", {
        p_order_id: selectedOrder.id,
        p_staff_id: selectedOrder.staff_id,
        p_payment_method: paymentMethod,
      })

      if (error) throw error

      toast.success("Pembayaran berhasil diselesaikan!")

      // Build receipt data
      setSelectedOrder({
        ...selectedOrder,
        status: "selesai",
        payment_method: paymentMethod,
        _paid_amount: finalPaid,
        _change_amount: paymentMethod === "tunai" ? finalPaid - selectedOrder.total_price : 0,
        _payment_label: paymentMethod === "tunai" ? "Tunai / Cash" : "Online / Transfer",
      })

      setPayOpen(false)
      setReceiptOpen(true)
      fetchProcessingOrders()
    } catch (err: any) {
      toast.error("Transaksi gagal: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const calculatedChange =
    selectedOrder && !isNaN(parseFloat(amountPaid))
      ? parseFloat(amountPaid) - selectedOrder.total_price
      : 0

  const filteredOrders = processingOrders.filter(
    (o) =>
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number && o.order_number.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Receipt Print Handler ──────────────────────────────────────────────────
  const handlePrintReceipt = () => {
    window.print()
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
        <div className="flex flex-1 flex-col p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kasir & Pembayaran</h1>
            <p className="text-muted-foreground mt-1">
              Proses pembayaran pesanan yang sedang dikerjakan pegawai fisik di gudang.
            </p>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Pesanan Sedang Diproses</CardTitle>
                  <CardDescription>
                    Menampilkan {filteredOrders.length} pesanan yang sedang dikerjakan pegawai — siap dikonfirmasi bayar
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari No. Pesanan atau Nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat daftar kasir...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg bg-background/50">
                  <IconFileCheck className="size-12 text-muted-foreground/60 mb-2" />
                  <h3 className="font-semibold text-lg">Belum Ada Pesanan Sedang Diproses</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Pesanan baru akan muncul di sini secara otomatis saat pegawai mendapatkan tugas dari antrean.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Pesanan</TableHead>
                        <TableHead>Waktu Masuk</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead className="text-center">EWP</TableHead>
                        <TableHead className="text-right">Total Item</TableHead>
                        <TableHead className="text-right">Total Tagihan</TableHead>
                        <TableHead className="w-[120px] text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs font-bold text-primary">
                            #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="font-semibold">{order.customer_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs font-semibold">
                              <IconClock className="size-3 mr-1" />
                              {formatTime(order.ewp)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{order.total_items} unit</TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatRupiah(order.total_price)}
                          </TableCell>
                          <TableCell>
                            <Button onClick={() => handlePayOpen(order)} size="sm" className="w-full font-semibold">
                              <IconCash className="size-4 mr-1.5" /> Bayar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Modal */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Proses Transaksi Pembayaran</DialogTitle>
              <DialogDescription>
                Pilih metode pembayaran untuk pesanan atas nama{" "}
                <strong>{selectedOrder?.customer_name}</strong>.
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div className="bg-muted/40 border rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No. Pesanan:</span>
                    <span className="font-mono font-semibold">
                      #{selectedOrder.order_number || selectedOrder.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EWP Pesanan:</span>
                    <span className="font-semibold">{formatTime(selectedOrder.ewp)}</span>
                  </div>
                  {selectedOrder.staff_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dikerjakan oleh:</span>
                      <span className="font-semibold flex items-center gap-1">
                        <IconUser className="size-3" />
                        Pegawai bertugas
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-1.5">
                    <span>Total Tagihan:</span>
                    <span className="text-primary">{formatRupiah(selectedOrder.total_price)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payMethod">Metode Pembayaran</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(val) => {
                      setPaymentMethod(val as any)
                      if (val === "online") {
                        setAmountPaid(selectedOrder.total_price.toString())
                      }
                    }}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">
                        <div className="flex items-center gap-2">
                          <IconCash className="size-4" />
                          Tunai / Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="online">
                        <div className="flex items-center gap-2">
                          <IconCreditCard className="size-4" />
                          Online / Transfer / QRIS
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === "tunai" && (
                  <div className="space-y-2">
                    <Label htmlFor="amtPaid">Jumlah Uang Diterima (IDR)</Label>
                    <Input
                      id="amtPaid"
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                )}

                {paymentMethod === "tunai" && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center text-sm">
                    <span className="font-semibold text-primary">Kembalian:</span>
                    <span
                      className={`text-lg font-bold ${
                        calculatedChange < 0 ? "text-rose-500" : "text-primary"
                      }`}
                    >
                      {calculatedChange < 0 ? "Kurang bayar" : formatRupiah(calculatedChange)}
                    </span>
                  </div>
                )}

                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPayOpen(false)}
                    disabled={submitting}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      (paymentMethod === "tunai" &&
                        (isNaN(parseFloat(amountPaid)) ||
                          parseFloat(amountPaid) < selectedOrder.total_price))
                    }
                  >
                    {submitting ? (
                      <>
                        <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Selesaikan Transaksi"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Receipt Modal */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <IconPrinter className="size-5" /> Pembayaran Selesai
              </DialogTitle>
              <DialogDescription>
                Ringkasan transaksi. Cetak atau tutup untuk melanjutkan.
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-3 text-sm border rounded-lg p-4 bg-muted/30 font-mono">
                <div className="text-center space-y-0.5">
                  <p className="font-bold text-base">GROSIR JASA</p>
                  <p className="text-xs text-muted-foreground">Aceh Timur</p>
                </div>
                <div className="border-t border-dashed pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>No. Pesanan</span>
                    <span className="font-bold">
                      #{selectedOrder.order_number || selectedOrder.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nama</span>
                    <span>{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode</span>
                    <span>{selectedOrder._payment_label || selectedOrder.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu</span>
                    <span>{new Date().toLocaleString("id-ID")}</span>
                  </div>
                </div>
                <div className="border-t border-dashed pt-2 space-y-0.5">
                  {selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="truncate max-w-[160px]">{item.products?.name} x{item.qty}</span>
                      <span>{formatRupiah(item.unit_price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed pt-2 space-y-1">
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTAL</span>
                    <span>{formatRupiah(selectedOrder.total_price)}</span>
                  </div>
                  {selectedOrder.payment_method === "tunai" && (
                    <>
                      <div className="flex justify-between">
                        <span>Bayar</span>
                        <span>{formatRupiah(selectedOrder._paid_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-600">
                        <span>Kembali</span>
                        <span>{formatRupiah(selectedOrder._change_amount || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground border-t border-dashed pt-2">
                  Terima kasih telah berbelanja!
                </p>
              </div>
            )}

            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                <IconPrinter className="size-4 mr-1.5" />
                Cetak Struk
              </Button>
              <Button className="flex-1" onClick={() => setReceiptOpen(false)}>
                Tutup & Kembali
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
