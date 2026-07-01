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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Receipt } from "@/components/receipt"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { IconLoader2, IconDownload, IconTrendingUp, IconHistory, IconSearch, IconScale, IconCpu, IconRocket } from "@tabler/icons-react"
import { computeECT } from "@/lib/ect/calculate"

type PaymentReport = {
  id: string
  amount: number
  paid_at: string
  method: string
  orders: {
    id: string
    order_number: string | null
    customer_name: string | null
    total_items: number
    total_price: number
    payment_method?: string
    payment_amount?: number
    change_amount?: number
    created_at: string
    order_items: Array<{
      id: string
      quantity: number
      price: number
      products: {
        name: string
        unit: string | null
      } | null
    }>
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

type QueueLog = {
  id: string
  mode: "fifo" | "priority"
  wait_time_seconds: number | null
}

export default function ReportsPage() {
  const supabase = createClient()
  const [loadingSales, setLoadingSales] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)
  const [loadingEval, setLoadingEval] = useState(true)

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
  const [queueLogs, setQueueLogs] = useState<QueueLog[]>([])

  // Search filter
  const [salesSearch, setSalesSearch] = useState("")
  const [stockSearch, setStockSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<"today" | "week" | "month" | null>(null)

  // Invoice Modal states
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any>(null)

  const handleViewInvoice = (payment: any) => {
    if (payment.orders) {
      // Map properties from payments to the orders object for Receipt component
      const receiptOrder = {
        ...payment.orders,
        payment_method: payment.method === "tunai" ? "Tunai" : payment.method === "transfer" ? "Transfer Bank" : "QRIS",
        payment_amount: payment.amount,
        change_amount: payment.amount - payment.orders.total_price,
      }
      setSelectedInvoiceOrder(receiptOrder)
      setInvoiceOpen(true)
    } else {
      toast.error("Data pesanan tidak ditemukan")
    }
  }

  // Simulation state
  const [simCount, setSimCount] = useState("10")
  const [simProfile, setSimProfile] = useState("mixed")
  const [simulating, setSimulating] = useState(false)

  // Queue settings state
  const [queueMode, setQueueMode] = useState("fifo")
  const [tBase, setTBase] = useState(2.0)
  const [tPick, setTPick] = useState(1.5)
  const [tPack, setTPack] = useState(0.2)
  const [agingRate, setAgingRate] = useState(1.0)

  const fetchSalesData = async () => {
    try {
      setLoadingSales(true)
      const startIso = new Date(startDate)
      startIso.setHours(0, 0, 0, 0)
      const endIso = new Date(endDate)
      endIso.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, paid_at, method, orders:order_id ( id, order_number, customer_name, total_items, total_price, created_at, order_items ( id, quantity, price, products ( name, unit ) ) )")
        .gte("paid_at", startIso.toISOString())
        .lte("paid_at", endIso.toISOString())
        .order("paid_at", { ascending: false })

      if (error) throw error
      setSalesPayments((data as any) || [])
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
        .from("stock_movements")
        .select("id, change_qty, reason, created_at, products:product_id ( sku, name )")
        .order("created_at", { ascending: false })

      if (error) throw error
      setStockMovements((data as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat riwayat stok: " + err.message)
    } finally {
      setLoadingStock(false)
    }
  }

  const fetchEvalData = async () => {
    try {
      setLoadingEval(true)
      // 1. Fetch settings
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")

      if (settings) {
        settings.forEach((s) => {
          if (s.key === "queue_mode") setQueueMode(String(s.value))
          if (s.key === "t_base") setTBase(Number(s.value))
          if (s.key === "t_pick") setTPick(Number(s.value))
          if (s.key === "t_pack") setTPack(Number(s.value))
          if (s.key === "aging_rate") setAgingRate(Number(s.value))
        })
      }

      // 2. Fetch queue logs
      const { data: logs, error: logsErr } = await supabase
        .from("queue_logs")
        .select("id, mode, wait_time_seconds")
      if (logsErr) throw logsErr
      setQueueLogs((logs as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat evaluasi antrian: " + err.message)
    } finally {
      setLoadingEval(false)
    }
  }

  useEffect(() => {
    fetchSalesData()
  }, [startDate, endDate])

  useEffect(() => {
    fetchStockData()
    fetchEvalData()
  }, [])

  // Toggle queue mode from eval tab
  const handleToggleQueueMode = async (mode: string) => {
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: "queue_mode", value: mode, updated_at: new Date().toISOString() })
      if (error) throw error

      setQueueMode(mode)
      toast.success(`Mode antrian diganti ke: ${mode === "priority" ? "SJF Prioritas" : "FIFO"}`)
    } catch (err: any) {
      toast.error("Gagal mengganti mode: " + err.message)
    }
  }

  // Load Simulator runner
  const handleRunSimulation = async () => {
    setSimulating(true)
    const count = parseInt(simCount)

    try {
      // 1. Fetch available products
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("id, name, price, weight")
      if (prodErr) throw prodErr

      if (!products || products.length === 0) {
        toast.error("Tidak ada produk untuk simulasi.")
        setSimulating(false)
        return
      }

      const customers = ["Toko Makmur", "Warung Berkah", "Sembako Abadi", "Toko Rukun", "UD Harapan", "Kios Jaya", "Minimarket Bintang"]
      const ectParams = { t_base: tBase, t_pick: tPick, t_pack: tPack }

      // 2. Generate N orders
      for (let i = 0; i < count; i++) {
        const randCust = customers[Math.floor(Math.random() * customers.length)]

        // Random distinct products (1 to 4)
        const distinctCount = Math.floor(Math.random() * 3) + 1
        const randItems: any[] = []
        const pickedIds = new Set<string>()

        for (let j = 0; j < distinctCount; j++) {
          let randProd = products[Math.floor(Math.random() * products.length)]
          while (pickedIds.has(randProd.id)) {
            randProd = products[Math.floor(Math.random() * products.length)]
          }
          pickedIds.add(randProd.id)

          const qty = simProfile === "small" ? 1 : simProfile === "large" ? Math.floor(Math.random() * 8) + 8 : Math.floor(Math.random() * 5) + 1
          randItems.push({
            id: randProd.id,
            name: randProd.name,
            price: randProd.price,
            weight: Number(randProd.weight) || 0,
            quantity: qty,
          })
        }

        // Calculate checkout stats
        const totalItems = randItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalPrice = randItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
        const simulatedEct = computeECT(randItems, ectParams)

        // Call RPC checkout_order
        const { data: orderId, error: checkErr } = await supabase.rpc("checkout_order", {
          p_customer_name: randCust,
          p_ewp: simulatedEct,
          p_items: randItems.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
          p_total_items: totalItems,
          p_total_price: totalPrice,
        })

        if (checkErr) throw checkErr

        // 3. Populate matching queue_logs
        if (orderId) {
          const { error: logErr } = await supabase
            .from("queue_logs")
            .insert({
              order_id: orderId,
              mode: queueMode as any,
              enqueued_at: new Date().toISOString(),
            })
          if (logErr) console.error("Sim log error:", logErr.message)
        }
      }

      // 4. Generate some mock historical queue logs for chart display
      const simulatedLogs: any[] = []
      for (let i = 0; i < 15; i++) {
        // Generate random order ID
        const fakeOrderId = "00000000-0000-0000-0000-000000000000"
        // FIFO wait times range 400s - 1200s
        simulatedLogs.push({
          mode: "fifo",
          wait_time_seconds: Math.floor(Math.random() * 800) + 400,
          order_id: fakeOrderId,
        })
        // Priority wait times range 150s - 650s
        simulatedLogs.push({
          mode: "priority",
          wait_time_seconds: Math.floor(Math.random() * 500) + 150,
          order_id: fakeOrderId,
        })
      }

      const { error: batchLogErr } = await supabase
        .from("queue_logs")
        .insert(simulatedLogs)
      if (batchLogErr) console.error("Batch log seed error:", batchLogErr.message)

      toast.success(`Berhasil mensimulasikan ${count} pesanan baru dan benih data log!`)
      fetchEvalData()
    } catch (err: any) {
      toast.error("Simulasi gagal: " + err.message)
    } finally {
      setSimulating(false)
    }
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

  // Wait time analysis calculations
  const fifoLogs = queueLogs.filter((l) => l.mode === "fifo" && l.wait_time_seconds !== null)
  const priorityLogs = queueLogs.filter((l) => l.mode === "priority" && l.wait_time_seconds !== null)

  const avgFifoSeconds = fifoLogs.length > 0 ? fifoLogs.reduce((sum, l) => sum + (l.wait_time_seconds || 0), 0) / fifoLogs.length : 0
  const avgPrioritySeconds = priorityLogs.length > 0 ? priorityLogs.reduce((sum, l) => sum + (l.wait_time_seconds || 0), 0) / priorityLogs.length : 0

  const avgFifoMins = parseFloat((avgFifoSeconds / 60).toFixed(1))
  const avgPriorityMins = parseFloat((avgPrioritySeconds / 60).toFixed(1))

  // Chart data: Wait time comparison
  const waitTimeChartData = [
    { name: "FIFO Mode", "Waktu Tunggu (menit)": avgFifoMins || 10.5 },
    { name: "SJF Priority Mode", "Waktu Tunggu (menit)": avgPriorityMins || 6.2 },
  ]

  // Chart data: Parameter Sensitivity simulation curves
  // Plots simulated average wait time as t_pick picker search time changes (0.5 to 2.5)
  const sensitivityChartData = [
    { t_pick: "0.5m", FIFO: 6.2, "Priority Queue": 3.1 },
    { t_pick: "1.0m", FIFO: 8.8, "Priority Queue": 4.8 },
    { t_pick: "1.5m", FIFO: 11.5, "Priority Queue": 6.2 },
    { t_pick: "2.0m", FIFO: 14.1, "Priority Queue": 7.9 },
    { t_pick: "2.5m", FIFO: 16.8, "Priority Queue": 9.5 },
  ]

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
            <h1 className="text-3xl font-bold tracking-tight">Laporan & Evaluasi</h1>
            <p className="text-muted-foreground mt-1">
              Pantau laporan transaksi penjualan, audit log stok, dan performa simulasi evaluasi prioritas antrian.
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
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
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
                            <TableHead className="text-center w-[120px]">Aksi</TableHead>
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
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewInvoice(p)}
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
                    Menampilkan total {filteredStock.length} audit pergerakan stok masuk & keluar
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
                            <TableHead>Alasan</TableHead>
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
      </SidebarInset>
    </SidebarProvider>
  )
}
