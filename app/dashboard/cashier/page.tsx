"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Receipt } from "@/components/receipt"
import { toast } from "sonner"
import { IconLoader2, IconSearch, IconCash, IconCreditCard, IconQrcode, IconFileCheck, IconPrinter } from "@tabler/icons-react"

type OrderItem = {
  id: string
  quantity: number
  price: number
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
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
  payment_status: "unpaid" | "paid" | null
  payment_method?: string
  payment_amount?: number
  change_amount?: number
  order_items: OrderItem[]
}

export default function CashierPage() {
  const supabase = createClient()
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modals state
  const [payOpen, setPayOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Selected order and transaction fields
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "transfer" | "qris">("tunai")
  const [amountPaid, setAmountPaid] = useState("")
  const [currentUser, setCurrentUser] = useState<any>(null)

  const fetchReadyOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items (*, products ( name, unit ))")
        .eq("status", "ready")
        .order("created_at", { ascending: false })

      if (error) throw error
      setReadyOrders((data as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat pesanan siap bayar: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setCurrentUser(session.user)
    }
  }

  useEffect(() => {
    fetchCurrentUser()
    fetchReadyOrders()

    // Real-time subscription to order status updates
    const channel = supabase
      .channel("cashier-ready-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchReadyOrders()
        }
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
    if (!selectedOrder || !currentUser) return
    setSubmitting(true)

    const paidVal = parseFloat(amountPaid)
    if (isNaN(paidVal) || paidVal < selectedOrder.total_price) {
      toast.error("Jumlah bayar kurang atau tidak valid")
      setSubmitting(false)
      return
    }

    try {
      // Call Postgres procedure to write transaction & complete order status
      const { error } = await supabase.rpc("finalize_order_payment", {
        p_order_id: selectedOrder.id,
        p_cashier_id: currentUser.id,
        p_method: paymentMethod,
        p_amount: paidVal,
      })

      if (error) throw error

      toast.success("Pembayaran berhasil diselesaikan!")

      // Append transaction details to selected order before loading receipt
      setSelectedOrder({
        ...selectedOrder,
        payment_method: paymentMethod === "tunai" ? "Tunai" : paymentMethod === "transfer" ? "Transfer Bank" : "QRIS",
        payment_amount: paidVal,
        change_amount: paidVal - selectedOrder.total_price,
      })

      setPayOpen(false)
      setReceiptOpen(true) // trigger receipt printing modal!
      fetchReadyOrders()
    } catch (err: any) {
      toast.error("Transaksi gagal: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Calculations
  const calculatedChange =
    selectedOrder && !isNaN(parseFloat(amountPaid))
      ? parseFloat(amountPaid) - selectedOrder.total_price
      : 0

  const filteredOrders = readyOrders.filter(
    (o) =>
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number && o.order_number.toLowerCase().includes(search.toLowerCase()))
  )

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
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kasir & Pembayaran</h1>
            <p className="text-muted-foreground mt-1">
              Proses checkout kasir untuk pesanan yang telah dikemas siap diambil oleh pelanggan.
            </p>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Antrian Pembayaran</CardTitle>
                  <CardDescription>
                    Menampilkan total {filteredOrders.length} pesanan siap bayar
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
                  <h3 className="font-semibold text-lg">Belum Ada Pesanan Siap Bayar</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Silakan tunggu petugas gudang menyelesaikan picking dan menandai order SIAP.
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
                Masukkan jumlah pembayaran dan pilih metode bayar untuk pelanggan {selectedOrder?.customer_name}.
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
                      // Pre-fill amount for non-cash payments
                      if (val !== "tunai") {
                        setAmountPaid(selectedOrder.total_price.toString())
                      }
                    }}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">Tunai / Cash</SelectItem>
                      <SelectItem value="transfer">Transfer Bank</SelectItem>
                      <SelectItem value="qris">QRIS Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amtPaid">Jumlah Uang Diterima (IDR)</Label>
                  <Input
                    id="amtPaid"
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                    disabled={submitting || paymentMethod !== "tunai"}
                  />
                </div>

                {paymentMethod === "tunai" && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center text-sm">
                    <span className="font-semibold text-primary">Kembalian:</span>
                    <span className={`text-lg font-bold ${calculatedChange < 0 ? "text-rose-500" : "text-primary"}`}>
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
                      isNaN(parseFloat(amountPaid)) ||
                      parseFloat(amountPaid) < selectedOrder.total_price
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

        {/* Receipt Printing Modal */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5"><IconPrinter className="size-5" /> Pembayaran Selesai</DialogTitle>
              <DialogDescription>
                Cetak struk belanja thermal untuk diserahkan kepada pelanggan.
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && <Receipt order={selectedOrder} />}

            <DialogFooter className="mt-4">
              <Button variant="outline" className="w-full" onClick={() => setReceiptOpen(false)}>
                Tutup & Kembali
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
