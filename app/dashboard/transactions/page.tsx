"use client"

import { useEffect, useState, useMemo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  IconLoader2,
  IconPrinter,
  IconSearch,
  IconEye,
  IconRefresh,
  IconHistory,
  IconX,
} from "@tabler/icons-react"

type Order = {
  id: string
  order_number: string | null
  created_at: string
  completed_at: string | null
  customer_name: string | null
  total_items: number
  total_price: number
  status: "antri" | "diproses" | "selesai" | "batal"
  payment_method: "tunai" | "online" | null
  payment_channel: string | null
  staff_id: string | null
}

type OrderItem = {
  id: string
  qty: number
  unit_price: number
  products: { name: string; sku: string | null; unit: string | null } | null
}

type Staff = {
  id: string
  name: string
}

export default function TransactionsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])

  // Filters State
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30) // Default: 30 days ago
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, paymentFilter, startDate, endDate])

  // Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  // Invoice Modal State
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<OrderItem[]>([])
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  // Fetch orders and staff
  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch Staff for mapping names
      const { data: staffData, error: staffErr } = await supabase
        .from("staff")
        .select("id, name")
      if (staffErr) throw staffErr
      setStaffList(staffData || [])

      // Fetch Orders within date range
      const startIso = new Date(startDate)
      startIso.setHours(0, 0, 0, 0)
      const endIso = new Date(endDate)
      endIso.setHours(23, 59, 59, 999)

      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          created_at,
          completed_at,
          customer_name,
          total_items,
          total_price,
          status,
          payment_method,
          payment_channel,
          staff_id
        `)
        .gte("created_at", startIso.toISOString())
        .lte("created_at", endIso.toISOString())

      const { data: ordersData, error: ordersErr } = await query.order("created_at", { ascending: false })
      if (ordersErr) throw ordersErr

      setOrders(ordersData || [])
    } catch (err: any) {
      toast.error("Gagal memuat data transaksi: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  // Client-side filtering for Search, Status, and Payment Method
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = search.toLowerCase()
      const cleanSearch = search.startsWith("#") ? search.slice(1).toLowerCase() : searchLower

      const nota = (order.order_number || order.id.substring(0, 8)).toLowerCase()
      const cust = order.customer_name?.toLowerCase() || ""
      const matchesSearch = nota.includes(cleanSearch) || cust.includes(searchLower)

      const matchesStatus = statusFilter === "all" || order.status === statusFilter

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "tunai" && order.payment_method === "tunai") ||
        (paymentFilter === "online" && order.payment_method === "online")

      return matchesSearch && matchesStatus && matchesPayment
    })
  }, [orders, search, statusFilter, paymentFilter])

  // Paginated Orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage])

  const totalPages = Math.ceil(filteredOrders.length / pageSize)

  // Fetch items for specific order
  const fetchOrderItems = async (orderId: string): Promise<OrderItem[]> => {
    const { data, error } = await supabase
      .from("order_items")
      .select("id, qty, unit_price, products:product_id ( name, sku, unit )")
      .eq("order_id", orderId)
    if (error) throw error
    return (data as any) || []
  }

  const handleOpenDetail = async (order: Order) => {
    try {
      setLoadingDetail(true)
      setSelectedOrder(order)
      setDetailOpen(true)
      const items = await fetchOrderItems(order.id)
      setOrderItems(items)
    } catch (err: any) {
      toast.error("Gagal memuat detail pesanan: " + err.message)
      setDetailOpen(false)
      setSelectedOrder(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleOpenInvoice = async (order: Order) => {
    try {
      setLoadingInvoice(true)
      setInvoiceOrder(order)
      setInvoiceOpen(true)
      const items = await fetchOrderItems(order.id)
      setInvoiceItems(items)
    } catch (err: any) {
      toast.error("Gagal memuat invoice: " + err.message)
      setInvoiceOpen(false)
      setInvoiceOrder(null)
    } finally {
      setLoadingInvoice(false)
    }
  }

  const getStaffName = (id: string | null) => {
    if (!id) return "-"
    return staffList.find((s) => s.id === id)?.name || "-"
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const resetFilters = () => {
    setSearch("")
    setStatusFilter("all")
    setPaymentFilter("all")
    const d = new Date()
    d.setDate(d.getDate() - 30)
    setStartDate(d.toISOString().split("T")[0])
    setEndDate(new Date().toISOString().split("T")[0])
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
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <IconHistory className="size-8 text-primary" /> Riwayat Transaksi
            </h1>
            <p className="text-muted-foreground mt-1">
              Lihat seluruh daftar riwayat transaksi kasir, detail belanjaan, dan cetak invoice resmi pelanggan.
            </p>
          </div>

          {/* Filters Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Pencarian & Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5">
                  <Label htmlFor="search" className="text-xs">Kata Kunci</Label>
                  <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="No. Nota / Nama Pelanggan"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Date range */}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Rentang Tanggal</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-background flex-1"
                    />
                    <span className="text-muted-foreground text-xs">s/d</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-background flex-1"
                    />
                  </div>
                </div>

                {/* Reset Buttons */}
                <div className="flex items-end gap-2">
                  <Button variant="outline" size="default" className="flex-1" onClick={resetFilters}>
                    <IconX className="size-4 mr-1.5" /> Reset
                  </Button>
                  <Button variant="default" size="default" className="flex-1" onClick={fetchData}>
                    <IconRefresh className="size-4 mr-1.5" /> Refresh
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Status Transaksi</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="antri">Antri / Belum Bayar</SelectItem>
                      <SelectItem value="diproses">Sedang Diproses</SelectItem>
                      <SelectItem value="selesai">Selesai / Lunas</SelectItem>
                      <SelectItem value="batal">Batal / Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Metode Pembayaran</Label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Metode</SelectItem>
                      <SelectItem value="tunai">Tunai / Cash</SelectItem>
                      <SelectItem value="online">Online / Transfer / QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions List */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <IconLoader2 className="size-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat riwayat transaksi...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm">
                  Tidak ada transaksi yang cocok dengan filter pencarian Anda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Nota</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead className="text-center">Total Item</TableHead>
                        <TableHead className="text-right">Total Transaksi</TableHead>
                        <TableHead className="text-center">Metode</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-bold text-xs">
                            #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {order.customer_name || "Pelanggan Umum"}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {order.total_items} unit
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono text-xs">
                            {formatRupiah(order.total_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            {order.payment_method ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 uppercase font-semibold",
                                  order.payment_method === "tunai"
                                    ? "border-amber-500/30 text-amber-600 bg-amber-500/5"
                                    : "border-sky-500/30 text-sky-600 bg-sky-500/5"
                                )}
                              >
                                {order.payment_channel
                                   ? order.payment_channel === "transfer"
                                     ? "TRANSFER BANK"
                                     : order.payment_channel === "qris"
                                     ? "QRIS"
                                     : order.payment_channel
                                   : order.payment_method}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 uppercase font-black",
                                order.status === "selesai" && "border-emerald-500/30 text-emerald-600 bg-emerald-500/5",
                                order.status === "batal" && "border-rose-500/30 text-rose-600 bg-rose-500/5",
                                order.status === "diproses" && "border-amber-500/30 text-amber-600 bg-amber-500/5",
                                order.status === "antri" && "border-blue-500/30 text-blue-600 bg-blue-500/5"
                              )}
                            >
                              {order.status === "antri"
                                ? "BELUM BAYAR"
                                : order.status === "diproses"
                                ? "DIKEMAS"
                                : order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenDetail(order)}
                                title="Lihat Rincian"
                              >
                                <IconEye className="size-3.5 mr-1" /> Detail
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-primary/30 text-primary hover:bg-primary/5"
                                onClick={() => handleOpenInvoice(order)}
                                title="Cetak Invoice"
                              >
                                <IconPrinter className="size-3.5 mr-1" /> Invoice
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            {/* Pagination Controls */}
            {!loading && filteredOrders.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10 text-xs gap-3">
                <div className="text-muted-foreground">
                  Menampilkan <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> hingga{" "}
                  <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, filteredOrders.length)}</span> dari{" "}
                  <span className="font-semibold text-foreground">{filteredOrders.length}</span> transaksi
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  <div className="flex items-center justify-center px-2 font-semibold">
                    Halaman {currentPage} dari {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Dialog Detail Transaksi */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rincian Detail Transaksi</DialogTitle>
              <DialogDescription>
                Nota #
                {selectedOrder?.order_number ||
                  selectedOrder?.id.substring(0, 8).toUpperCase()}{" "}
                &middot; Pelanggan: {selectedOrder?.customer_name || "Pelanggan Umum"}
              </DialogDescription>
            </DialogHeader>

            {loadingDetail || !selectedOrder ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs bg-muted/30 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-muted-foreground">Waktu Pemesanan:</p>
                    <p className="font-semibold">
                      {new Date(selectedOrder.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status Transaksi:</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1.5 py-0 uppercase font-black mt-0.5",
                        selectedOrder.status === "selesai" && "border-emerald-500/30 text-emerald-600 bg-emerald-500/5",
                        selectedOrder.status === "batal" && "border-rose-500/30 text-rose-600 bg-rose-500/5",
                        selectedOrder.status === "diproses" && "border-amber-500/30 text-amber-600 bg-amber-500/5",
                        selectedOrder.status === "antri" && "border-blue-500/30 text-blue-600 bg-blue-500/5"
                      )}
                    >
                      {selectedOrder.status === "antri" ? "BELUM BAYAR" : selectedOrder.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Metode Pembayaran:</p>
                    <p className="font-semibold uppercase">
                      {selectedOrder.payment_channel
                        ? selectedOrder.payment_channel === "transfer"
                          ? "ONLINE (TRANSFER BANK)"
                          : selectedOrder.payment_channel === "qris"
                          ? "ONLINE (QRIS)"
                          : selectedOrder.payment_channel
                        : selectedOrder.payment_method || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pegawai Pengemas:</p>
                    <p className="font-semibold">{getStaffName(selectedOrder.staff_id)}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-semibold text-foreground">{item.products?.name || "Produk Terhapus"}</p>
                            {item.products?.sku && (
                              <p className="text-[10px] font-mono text-muted-foreground">{item.products.sku}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold">
                            {item.qty} {item.products?.unit || "pcs"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-bold font-mono">
                            {formatRupiah(item.qty * item.unit_price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Total Tagihan ({selectedOrder.total_items} unit)
                  </span>
                  <span className="text-base font-extrabold font-mono">
                    {formatRupiah(selectedOrder.total_price)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" className="w-full" onClick={() => setDetailOpen(false)}>
                Tutup Detail
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Cetak Struk Belanja */}
        <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
          <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
            <DialogHeader className="print:hidden">
              <DialogTitle>Cetak Struk Belanja</DialogTitle>
              <DialogDescription>
                Tinjauan cetak struk belanja thermal untuk diserahkan kepada pelanggan.
              </DialogDescription>
            </DialogHeader>

            {loadingInvoice || !invoiceOrder ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : (
              <InvoiceView
                order={invoiceOrder}
                items={invoiceItems}
                staffName={getStaffName(invoiceOrder.staff_id)}
                formatRupiah={formatRupiah}
              />
            )}

            <DialogFooter className="mt-4 print:hidden">
              <Button variant="outline" className="w-full" onClick={() => setInvoiceOpen(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}

function InvoiceView({
  order,
  items,
  staffName,
  formatRupiah,
}: {
  order: Order
  items: OrderItem[]
  staffName: string
  formatRupiah: (val: number) => string
}) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Printable Receipt Wrapper */}
      <div
        id="invoice-print-area"
        className="w-full max-w-[320px] p-6 bg-white text-black border border-dashed border-gray-300 rounded shadow-sm text-xs font-mono print:border-none print:shadow-none print:p-0"
      >
        <div className="text-center space-y-1 mb-4 border-b border-dashed pb-3">
          <h2 className="text-sm font-bold tracking-wider uppercase">POS GROSIR JASA</h2>
          <p className="text-[10px] text-gray-500">Jl. Raya Grosir No. 12, Jawa Timur</p>
          <p className="text-[10px] text-gray-500">Telp: 0812-3456-7890</p>
        </div>

        <div className="space-y-1 mb-3 text-[10px] text-gray-600">
          <div className="flex justify-between">
            <span>No. Nota:</span>
            <span className="font-bold">
              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal:</span>
            <span>{new Date(order.created_at).toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between">
            <span>Pelanggan:</span>
            <span className="font-semibold">{order.customer_name || "Pelanggan Umum"}</span>
          </div>
          <div className="flex justify-between">
            <span>Pegawai:</span>
            <span>{staffName}</span>
          </div>
        </div>

        {/* Item Table */}
        <div className="border-t border-b border-dashed py-2 mb-3">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-dashed">
                <th className="text-left pb-1">Nama Barang</th>
                <th className="text-right pb-1">Qty</th>
                <th className="text-right pb-1">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1">
                    <p className="font-semibold text-gray-800">{item.products?.name || "Produk Terhapus"}</p>
                    <p className="text-[9px] text-gray-500">
                      {formatRupiah(item.unit_price)}/{item.products?.unit || "pcs"}
                    </p>
                  </td>
                  <td className="text-right py-1">
                    {item.qty}
                  </td>
                  <td className="text-right py-1 font-semibold">
                    {formatRupiah(item.unit_price * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations */}
        <div className="space-y-1.5 text-[10px] border-b border-dashed pb-3 mb-3">
          <div className="flex justify-between">
            <span>Total Item:</span>
            <span>{order.total_items} unit</span>
          </div>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>{formatRupiah(order.total_price)}</span>
          </div>
          {order.payment_method && (
            <div className="flex justify-between">
              <span>Metode Bayar:</span>
              <span className="uppercase font-semibold">
                {order.payment_channel
                  ? order.payment_channel === "transfer"
                    ? "TRANSFER BANK"
                    : order.payment_channel === "qris"
                    ? "QRIS"
                    : order.payment_channel
                  : order.payment_method}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="uppercase font-bold text-[9px]">{order.status}</span>
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-500 mt-4">
          <p>Terima Kasih Atas Kunjungan Anda</p>
          <p>Barang Yang Sudah Dibeli Tidak Dapat Ditukar</p>
        </div>
      </div>

      {/* Action Button */}
      <Button onClick={handlePrint} className="mt-6 w-full max-w-[320px] font-bold print:hidden">
        <IconPrinter className="size-4 mr-2" /> Cetak Struk Belanja
      </Button>

      {/* Global CSS for Print Mode */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #invoice-print-area,
          #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: absolute !important;
            left: 50% !important;
            top: 50px !important;
            transform: translateX(-50%) !important;
            border: none !important;
            box-shadow: none !important;
            width: 80mm !important; /* standard thermal printer size */
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  )
}
