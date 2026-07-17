"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconDownload, IconTrendingUp, IconHistory, IconSearch } from "@tabler/icons-react"

type PaymentReport = {
  id: string
  amount: number
  paid_at: string
  method: string
  orders: {
    order_number: string | null
    customer_name: string | null
  } | null
}

type StockMovementReport = {
  id: string
  change_qty: number
  reason: string
  created_at: string
  products: {
    sku: string | null
    name: string
  } | null
}

export default function ReportsPage() {
  const supabase = createClient()
  const [loadingSales, setLoadingSales] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)

  // Report Dates filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30) // default last 30 days
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })

  const [salesPayments, setSalesPayments] = useState<PaymentReport[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovementReport[]>([])

  // Search filter
  const [salesSearch, setSalesSearch] = useState("")
  const [stockSearch, setStockSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<"hari" | "minggu" | "bulan" | null>("bulan")

  const fetchSalesData = async () => {
    try {
      setLoadingSales(true)
      const startIso = new Date(startDate)
      startIso.setHours(0, 0, 0, 0)
      const endIso = new Date(endDate)
      endIso.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from("orders")
        .select("id, total_price, completed_at, payment_method, order_number, customer_name")
        .eq("status", "selesai")
        .gte("completed_at", startIso.toISOString())
        .lte("completed_at", endIso.toISOString())
        .order("completed_at", { ascending: false })

      if (error) throw error
      const mapped: PaymentReport[] = (data || []).map((o: any) => ({
        id: o.id,
        amount: o.total_price || 0,
        paid_at: o.completed_at,
        method: o.payment_method || "-",
        orders: {
          order_number: o.order_number,
          customer_name: o.customer_name,
        },
      }))
      setSalesPayments(mapped)
    } catch (err: any) {
      toast.error("Gagal memuat laporan penjualan: " + err.message)
    } finally {
      setLoadingSales(false)
    }
  }

  const fetchStockData = async () => {
    try {
      setLoadingStock(true)
      const { data, error } = await supabase
        .from("stock_mutations")
        .select("id, change_qty, type, notes, created_at, products:product_id ( sku, name )")
        .order("created_at", { ascending: false })

      if (error) throw error
      // Map to same format for display
      const mappedStock: StockMovementReport[] = (data || []).map((m: any) => ({
        id: m.id,
        change_qty: m.change_qty,
        reason: m.notes || m.type,
        created_at: m.created_at,
        products: m.products,
      }))
      setStockMovements(mappedStock)
    } catch (err: any) {
      toast.error("Gagal memuat riwayat stok: " + err.message)
    } finally {
      setLoadingStock(false)
    }
  }

  useEffect(() => {
    fetchSalesData()
  }, [startDate, endDate])

  useEffect(() => {
    fetchStockData()
  }, [])

  // Quick Date Filter Helpers
  const filterHariIni = () => {
    const today = new Date().toISOString().split("T")[0]
    setStartDate(today)
    setEndDate(today)
    setActiveFilter("hari")
  }

  const filterMingguIni = () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    setStartDate(d.toISOString().split("T")[0])
    setEndDate(new Date().toISOString().split("T")[0])
    setActiveFilter("minggu")
  }

  const filterBulanIni = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    setStartDate(d.toISOString().split("T")[0])
    setEndDate(new Date().toISOString().split("T")[0])
    setActiveFilter("bulan")
  }

  // Filter lists
  const filteredSales = salesPayments.filter((p) => {
    const cust = p.orders?.customer_name?.toLowerCase() || ""
    const nota = p.orders?.order_number?.toLowerCase() || ""
    const searchLower = salesSearch.toLowerCase()
    return cust.includes(searchLower) || nota.includes(searchLower)
  })

  const filteredStock = stockMovements.filter((m) => {
    const name = m.products?.name?.toLowerCase() || ""
    const sku = m.products?.sku?.toLowerCase() || ""
    const searchLower = stockSearch.toLowerCase()
    return name.includes(searchLower) || sku.includes(searchLower)
  })

  // Export Sales to CSV
  const exportSalesCSV = () => {
    if (filteredSales.length === 0) {
      toast.error("Tidak ada data untuk diekspor")
      return
    }

    const csvRows = [
      ["No. Nota", "Tanggal Pembayaran", "Pelanggan", "Metode Pembayaran", "Jumlah Bayar (IDR)"],
      ...filteredSales.map((p) => [
        `#${p.orders?.order_number || p.id.substring(0, 8).toUpperCase()}`,
        new Date(p.paid_at).toLocaleString("id-ID"),
        p.orders?.customer_name || "-",
        p.method.toUpperCase(),
        p.amount,
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

  // Export Stock Movements to CSV
  const exportStockCSV = () => {
    if (filteredStock.length === 0) {
      toast.error("Tidak ada data untuk diekspor")
      return
    }

    const csvRows = [
      ["Tanggal Pergerakan", "SKU", "Nama Barang", "Kuantitas Perubahan", "Alasan"],
      ...filteredStock.map((m) => [
        new Date(m.created_at).toLocaleString("id-ID"),
        m.products?.sku || "-",
        m.products?.name || "-",
        m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty,
        m.reason,
      ]),
    ]

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((r) => r.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Laporan_Pergerakan_Stok_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Laporan pergerakan stok berhasil diekspor ke CSV!")
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Summaries
  const totalPeriodSales = filteredSales.reduce((sum, p) => sum + p.amount, 0)

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
            <h1 className="text-3xl font-bold tracking-tight">Laporan Transaksi</h1>
            <p className="text-muted-foreground mt-1">
              Pantau laporan transaksi penjualan dan audit log riwayat stok masuk & keluar.
            </p>
          </div>

          <Tabs defaultValue="sales" className="w-full space-y-6">
            <TabsList className="bg-background border border-border/50">
              <TabsTrigger value="sales" className="flex items-center gap-1.5 font-semibold">
                <IconTrendingUp className="size-4" /> Laporan Penjualan
              </TabsTrigger>
              <TabsTrigger value="stock" className="flex items-center gap-1.5 font-semibold">
                <IconHistory className="size-4" /> Laporan Riwayat Stok
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SALES REPORT */}
            <TabsContent value="sales" className="space-y-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm">Filter Laporan Penjualan</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col lg:flex-row gap-4 items-end justify-between">
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
                    {/* Quick Filters */}
                    <div className="flex gap-2 mb-0.5">
                      <Button
                        variant={activeFilter === "hari" ? "default" : "outline"}
                        size="sm"
                        onClick={filterHariIni}
                        className="text-xs h-9"
                      >
                        Hari Ini
                      </Button>
                      <Button
                        variant={activeFilter === "minggu" ? "default" : "outline"}
                        size="sm"
                        onClick={filterMingguIni}
                        className="text-xs h-9"
                      >
                        Minggu Ini
                      </Button>
                      <Button
                        variant={activeFilter === "bulan" ? "default" : "outline"}
                        size="sm"
                        onClick={filterBulanIni}
                        className="text-xs h-9"
                      >
                        Bulan Ini
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-64">
                      <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari nota atau pelanggan..."
                        value={salesSearch}
                        onChange={(e) => setSalesSearch(e.target.value)}
                        className="pl-9 bg-background"
                      />
                    </div>
                    <Button onClick={exportSalesCSV} variant="outline" className="w-full sm:w-auto">
                      <IconDownload className="size-4 mr-2" /> Ekspor CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
                  <div>
                    <CardTitle>Transaksi Penjualan</CardTitle>
                    <CardDescription>
                      Menampilkan total {filteredSales.length} transaksi di periode terpilih
                    </CardDescription>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg text-emerald-700 font-bold text-sm">
                    Total Omzet Periode: {formatRupiah(totalPeriodSales)}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingSales ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2">
                      <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Menghitung transaksi...</span>
                    </div>
                  ) : filteredSales.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada transaksi pada tanggal terpilih
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>No. Nota</TableHead>
                            <TableHead>Tanggal Pembayaran</TableHead>
                            <TableHead>Pelanggan</TableHead>
                            <TableHead>Metode Pembayaran</TableHead>
                            <TableHead className="text-right">Jumlah Bayar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSales.map((p) => (
                            <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-mono text-xs font-semibold text-primary">
                                #{p.orders?.order_number || p.id.substring(0, 8).toUpperCase()}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(p.paid_at).toLocaleString("id-ID")}
                              </TableCell>
                              <TableCell className="font-medium">{p.orders?.customer_name || "-"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-bold px-2 uppercase tracking-wide">
                                  {p.method}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                {formatRupiah(p.amount)}
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

            {/* TAB 2: INVENTORY HISTORY */}
            <TabsContent value="stock" className="space-y-6">
              <Card className="border-border/50 shadow-sm">
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-6">
                  <div className="relative w-full sm:w-80">
                    <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari SKU atau nama barang..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  <Button onClick={exportStockCSV} variant="outline" className="w-full sm:w-auto">
                    <IconDownload className="size-4 mr-2" /> Ekspor CSV
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Riwayat Alur Inventori</CardTitle>
                  <CardDescription>
                    Menampilkan log audit pergerakan stok masuk & keluar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingStock ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2">
                      <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Memuat audit log...</span>
                    </div>
                  ) : filteredStock.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada pergerakan stok ditemukan
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tanggal Pergerakan</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nama Barang</TableHead>
                            <TableHead className="text-center">Perubahan Kuantitas</TableHead>
                            <TableHead>Keterangan / Alasan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStock.map((m) => (
                            <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(m.created_at).toLocaleString("id-ID")}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold">
                                {m.products?.sku || "-"}
                              </TableCell>
                              <TableCell className="font-medium">{m.products?.name}</TableCell>
                              <TableCell className={`text-center font-bold ${m.change_qty > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}
                              </TableCell>
                              <TableCell className="text-sm">
                                <Badge variant="secondary" className="font-semibold capitalize text-xs">
                                  {m.reason}
                                </Badge>
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
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
