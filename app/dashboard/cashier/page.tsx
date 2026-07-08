"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

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
  const handlePaymentSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
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

  const filteredOrders = processingOrders.filter(
    (o) =>
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number && o.order_number.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Receipt Print Handler ──────────────────────────────────────────────────
  const handlePrintReceipt = () => {
    window.print()
  }

  return loading ? (
    <div className="flex flex-1 flex-col items-center justify-center space-y-4 min-h-[60vh]">
      <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Menghubungkan ke pusat data POS...</p>
    </div>
  ) : (
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
                className="pl-9 bg-background"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Tidak ada pesanan aktif yang sedang diproses pegawai saat ini
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
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nomor Nota:</span>
                  <span className="font-mono font-bold text-primary">
                    #{selectedOrder.order_number || selectedOrder.id.substring(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Petugas Ambil:</span>
                  <span className="font-semibold text-foreground">
                    {selectedOrder._staff_name || "Pegawai Fisik"}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                  <span>Total Tagihan:</span>
                  <span className="text-lg text-primary">{formatRupiah(selectedOrder.total_price)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Metode Pembayaran</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={paymentMethod === "tunai" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("tunai")}
                    className="font-semibold h-11"
                  >
                    Uang Tunai
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === "online" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("online")}
                    className="font-semibold h-11"
                  >
                    Transfer Online
                  </Button>
                </div>
              </div>

              {paymentMethod === "tunai" && (
                <div className="space-y-2 pt-1 border-t border-dashed">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="payAmt">Jumlah Bayar Tunai</Label>
                    {amountPaid && parseFloat(amountPaid) > 0 && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        Kembalian: {formatRupiah(Math.max(0, parseFloat(amountPaid) - selectedOrder.total_price))}
                      </span>
                    )}
                  </div>
                  <Input
                    id="payAmt"
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Masukkan jumlah uang tunai..."
                    className="bg-background"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[selectedOrder.total_price, 10000, 20000, 50000, 100000].map((val, i) => {
                      const valueToSet = i === 0 ? val : Math.ceil(selectedOrder.total_price / val) * val
                      return (
                        <Button
                          key={i}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setAmountPaid(valueToSet.toString())}
                          className="text-xs"
                        >
                          {formatRupiah(valueToSet)}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={() => handlePaymentSubmit()} disabled={submitting} className="flex-1 font-bold">
              {submitting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengkonfirmasi...
                </>
              ) : (
                "Konfirmasi Lunas"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-xs p-5">
          {selectedOrder && (
            <div id="receipt-print-area" className="text-xs font-mono space-y-4">
              <div className="text-center space-y-1">
                <h3 className="font-bold text-sm">POS GROSIR JASA</h3>
                <p className="text-[10px] text-muted-foreground">Aceh Timur, Indonesia</p>
                <p className="text-[10px] text-muted-foreground">
                  Tanggal: {new Date().toLocaleString("id-ID")}
                </p>
              </div>

              <div className="border-t border-b border-dashed py-2 space-y-1">
                <div className="flex justify-between">
                  <span>Nota:</span>
                  <span className="font-bold">
                    #{selectedOrder.order_number || selectedOrder.id.substring(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span>{selectedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pegawai Ambil:</span>
                  <span>{selectedOrder._staff_name || "Staf Fisik"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Metode:</span>
                  <span className="uppercase">{selectedOrder.payment_method}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {selectedOrder.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between leading-tight">
                    <div className="max-w-[140px] truncate">
                      <span>{item.products?.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {item.qty} x {formatRupiah(item.unit_price)}
                      </span>
                    </div>
                    <span>{formatRupiah(item.qty * item.unit_price)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed pt-2 space-y-1 font-bold">
                <div className="flex justify-between text-sm">
                  <span>Total</span>
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
    </div>
  )
}
