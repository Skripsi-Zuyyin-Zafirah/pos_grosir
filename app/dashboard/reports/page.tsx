"use client"

import { useEffect, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Receipt } from "@/components/receipt"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconDownload, IconTrendingUp, IconSearch } from "@tabler/icons-react"

type OrderReport = {
  id: string
  order_number: string | null
  customer_name: string | null
  total_items: number
  total_price: number
  created_at: string
  completed_at: string | null
  payment_method: "tunai" | "online" | null
  order_items: Array<{
    id: string
    qty: number
    unit_price: number
    products: {
      name: string
    } | null
  }>
}

export default function ReportsPage() {
  const supabase = createClient()
  const [loadingSales, setLoadingSales] = useState(true)

  // Report Dates filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30) // default last 30 days
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })

  const [salesOrders, setSalesOrders] = useState<OrderReport[]>([])

  // Search filter
  const [salesSearch, setSalesSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<"today" | "week" | "month" | null>(null)

  // Invoice Modal states
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any>(null)

  const handleViewInvoice = (order: OrderReport) => {
    if (order) {
      // Map properties for Receipt component (make sure match schema expected by Receipt)
      const receiptOrder = {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        total_items: order.total_items,
        total_price: order.total_price,
        created_at: order.created_at,
        completed_at: order.completed_at,
        payment_method: order.payment_method === "tunai" ? "Tunai" : "Online",
        order_items: order.order_items.map((item) => ({
          id: item.id,
          quantity: item.qty,
          price: item.unit_price,
          products: item.products,
        })),
      }
      setSelectedInvoiceOrder(receiptOrder)
      setInvoiceOpen(true)
    } else {
      toast.error("Data pesanan tidak ditemukan")
    }
  }

  const fetchSalesData = async () => {
    try {
      setLoadingSales(true)
      const startIso = new Date(startDate)
      startIso.setHours(0, 0, 0, 0)
      const endIso = new Date(endDate)
      endIso.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, total_items, total_price, created_at, completed_at, payment_method, order_items ( id, qty, unit_price, products ( name ) )"
        )
        .eq("status", "selesai")
        .gte("completed_at", startIso.toISOString())
        .lte("completed_at", endIso.toISOString())
        .order("completed_at", { ascending: false })

      if (error) throw error
      setSalesOrders((data as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat laporan penjualan: " + err.message)
    } finally {
      setLoadingSales(false)
    }
  }

  useEffect(() => {
    fetchSalesData()
  }, [startDate, endDate])

  // Filter lists
  const filteredSales = salesOrders.filter((o) => {
    const cust = o.customer_name?.toLowerCase() || ""
    const nota = o.order_number?.toLowerCase() || ""
    const searchLower = salesSearch.toLowerCase()
    return cust.includes(searchLower) || nota.includes(searchLower)
  })

  // Export Sales to CSV
  const exportSalesCSV = () => {
    if (filteredSales.length === 0) {
      toast.error("Tidak ada data untuk diekspor")
      return
    }

    const csvRows = [
      ["No. Nota", "Tanggal Transaksi Selesai", "Pelanggan", "Metode Pembayaran", "Total Harga (IDR)"],
      ...filteredSales.map((o) => [
        `#${o.order_number || o.id.substring(0, 8).toUpperCase()}`,
        o.completed_at ? new Date(o.completed_at).toLocaleString("id-ID") : "-",
        o.customer_name || "-",
        (o.payment_method || "tunai").toUpperCase(),
        o.total_price,
      ]),
    ]

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((r) => r.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Laporan_Penjualan_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Laporan penjualan berhasil diekspor ke CSV!")
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Summaries
  const totalPeriodSales = filteredSales.reduce((sum, o) => sum + o.total_price, 0)

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Laporan Penjualan</h1>
        <p className="text-muted-foreground mt-1">
          Pantau laporan transaksi penjualan grosir dan cetak struk/invoice belanja pelanggan.
        </p>
      </div>

      <Tabs defaultValue="sales" className="w-full space-y-6">
        <TabsList className="bg-background border border-border/50">
          <TabsTrigger value="sales" className="flex items-center gap-1.5 font-semibold">
            <IconTrendingUp className="size-4" /> Laporan Penjualan
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SALES REPORT */}
        <TabsContent value="sales" className="space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm">Filter Laporan Penjualan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4 items-end justify-between">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="sDate">Mulai Tanggal</Label>
                  <Input
                    id="sDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setActiveFilter(null)
                    }}
                    className="w-44 bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eDate">Sampai Tanggal</Label>
                  <Input
                    id="eDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setActiveFilter(null)
                    }}
                    className="w-44 bg-background"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    type="button"
                    variant={activeFilter === "today" ? "default" : "outline"}
                    onClick={() => {
                      const todayStr = new Date().toISOString().split("T")[0]
                      setStartDate(todayStr)
                      setEndDate(todayStr)
                      setActiveFilter("today")
                    }}
                    className="text-xs h-9 font-semibold"
                  >
                    Hari Ini
                  </Button>
                  <Button
                    type="button"
                    variant={activeFilter === "week" ? "default" : "outline"}
                    onClick={() => {
                      const now = new Date()
                      const day = now.getDay()
                      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
                      const monday = new Date(now.setDate(diff))
                      const mondayStr = monday.toISOString().split("T")[0]
                      const todayStr = new Date().toISOString().split("T")[0]
                      setStartDate(mondayStr)
                      setEndDate(todayStr)
                      setActiveFilter("week")
                    }}
                    className="text-xs h-9 font-semibold"
                  >
                    Minggu Ini
                  </Button>
                  <Button
                    type="button"
                    variant={activeFilter === "month" ? "default" : "outline"}
                    onClick={() => {
                      const now = new Date()
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                      const firstDayStr = firstDay.toISOString().split("T")[0]
                      const todayStr = new Date().toISOString().split("T")[0]
                      setStartDate(firstDayStr)
                      setEndDate(todayStr)
                      setActiveFilter("month")
                    }}
                    className="text-xs h-9 font-semibold"
                  >
                    Bulan Ini
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Button onClick={exportSalesCSV} className="w-full md:w-auto font-semibold">
                  <IconDownload className="size-4 mr-2" /> Ekspor CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Penjualan Periode</CardTitle>
                <IconTrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-primary">{formatRupiah(totalPeriodSales)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Akumulasi omset dari pesanan selesai pada filter tanggal aktif
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Transaksi Selesai</CardTitle>
                <Badge variant="secondary" className="font-bold">Nota</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold">{filteredSales.length} Transaksi</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Jumlah struk belanja selesai dicetak & dibayar
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Transactions List */}
          <Card className="border-border/50 shadow-md">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Transaksi Penjualan Grosir</CardTitle>
                <CardDescription>
                  Daftar pesanan selesai yang telah terkonfirmasi dibayar oleh kasir
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari pelanggan atau nomor nota..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className="pl-9 bg-background w-full"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Memuat laporan...</span>
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Tidak ada transaksi penjualan ditemukan
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Nota</TableHead>
                        <TableHead>Tanggal Selesai</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Metode Pembayaran</TableHead>
                        <TableHead className="text-right">Total Belanja</TableHead>
                        <TableHead className="text-center w-[120px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map((o) => (
                        <TableRow key={o.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            #{o.order_number || o.id.substring(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {o.completed_at ? new Date(o.completed_at).toLocaleString("id-ID") : "-"}
                          </TableCell>
                          <TableCell className="font-medium">{o.customer_name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-bold px-2 uppercase tracking-wide">
                              {o.payment_method || "tunai"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatRupiah(o.total_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewInvoice(o)}
                              className="h-8 text-xs font-semibold"
                            >
                              Lihat Invoice
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
        </TabsContent>

        {/* Invoice Printing Dialog */}
        <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">Detail Invoice</DialogTitle>
              <DialogDescription>
                Invoice transaksi belanja pelanggan.
              </DialogDescription>
            </DialogHeader>

            {selectedInvoiceOrder && <Receipt order={selectedInvoiceOrder} />}

            <DialogFooter className="mt-4">
              <Button variant="outline" className="w-full" onClick={() => setInvoiceOpen(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  )
}
