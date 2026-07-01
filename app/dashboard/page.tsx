"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SectionCards, type DashboardMetrics } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconClipboardList, IconChartBar, IconTrophy } from "@tabler/icons-react"

type RecentOrder = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_price: number
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
}

type RevenueDay = {
  date: string
  revenue: number
}

type MonthlyRevenue = {
  month: string
  revenue: number
}

type TopProduct = {
  name: string
  total_qty: number
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
]

export default function Page() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    todayOrdersCount: 0,
    activeQueueLength: 0,
    lowStockCount: 0,
  })
  const [chartData, setChartData] = useState<RevenueDay[]>([])
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // 1. Calculate Total Revenue
      const { data: payData, error: payErr } = await supabase
        .from("payments")
        .select("amount")
      if (payErr) throw payErr
      const totalRev = payData ? payData.reduce((sum, p) => sum + p.amount, 0) : 0

      // 2. Calculate Today's Orders
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { count: todayCount, error: todayErr } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfToday.toISOString())
      if (todayErr) throw todayErr

      // 3. Calculate Active Queue Length (waiting & processing)
      const { count: activeCount, error: activeErr } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["waiting", "processing"])
      if (activeErr) throw activeErr

      // 4. Calculate Critical Stock Level
      const { data: invData, error: invErr } = await supabase
        .from("inventory")
        .select("stock_qty, reorder_level")
      if (invErr) throw invErr
      const lowCount = invData ? invData.filter((i) => i.stock_qty <= i.reorder_level).length : 0

      setMetrics({
        totalRevenue: totalRev,
        todayOrdersCount: todayCount || 0,
        activeQueueLength: activeCount || 0,
        lowStockCount: lowCount,
      })

      // 5. Fetch Daily Revenue (Last 7 Days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      const { data: chartPayments, error: chartErr } = await supabase
        .from("payments")
        .select("amount, paid_at")
        .gte("paid_at", sevenDaysAgo.toISOString())
      if (chartErr) throw chartErr

      // Group payments by date
      const dailyMap: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split("T")[0]
        dailyMap[dateStr] = 0
      }

      if (chartPayments) {
        chartPayments.forEach((p) => {
          const dateStr = p.paid_at.split("T")[0]
          if (dailyMap[dateStr] !== undefined) {
            dailyMap[dateStr] += p.amount
          }
        })
      }

      const formattedChartData = Object.entries(dailyMap).map(([date, revenue]) => ({
        date,
        revenue,
      }))
      setChartData(formattedChartData)

      // 6. Fetch Recent Orders (last 5)
      const { data: recent, error: recentErr } = await supabase
        .from("orders")
        .select("id, order_number, created_at, customer_name, total_price, status")
        .order("created_at", { ascending: false })
        .limit(5)
      if (recentErr) throw recentErr

      setRecentOrders((recent as any) || [])

      // 7. Fetch Monthly Revenue (last 6 months)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      sixMonthsAgo.setHours(0, 0, 0, 0)

      const { data: monthlyPayments, error: monthlyErr } = await supabase
        .from("payments")
        .select("amount, paid_at")
        .gte("paid_at", sixMonthsAgo.toISOString())
      if (monthlyErr) throw monthlyErr

      const monthlyMap: Record<string, number> = {}
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"]
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        monthlyMap[key] = 0
      }

      if (monthlyPayments) {
        monthlyPayments.forEach((p) => {
          const d = new Date(p.paid_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          if (monthlyMap[key] !== undefined) {
            monthlyMap[key] += p.amount
          }
        })
      }

      const formattedMonthly: MonthlyRevenue[] = Object.entries(monthlyMap).map(([key, revenue]) => {
        const [year, month] = key.split("-")
        return {
          month: `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`,
          revenue,
        }
      })
      setMonthlyRevenue(formattedMonthly)

      // 8. Fetch Top 5 Best Selling Products
      const { data: orderItems, error: itemsErr } = await supabase
        .from("order_items")
        .select("quantity, products ( name )")
      if (itemsErr) throw itemsErr

      const productMap: Record<string, number> = {}
      if (orderItems) {
        orderItems.forEach((item: any) => {
          const name = item.products?.name || "Tidak diketahui"
          productMap[name] = (productMap[name] || 0) + item.quantity
        })
      }

      const sortedProducts = Object.entries(productMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total_qty]) => ({ name, total_qty }))

      setTopProducts(sortedProducts)
    } catch (err: any) {
      toast.error("Gagal memuat dashboard: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return <Badge className="bg-sky-500 hover:bg-sky-600 border-none">ANTRI</Badge>
      case "processing":
        return <Badge className="bg-amber-500 hover:bg-amber-600 border-none">DIPROSES</Badge>
      case "ready":
        return <Badge className="bg-indigo-500 hover:bg-indigo-600 border-none">SIAP</Badge>
      case "done":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none">SELESAI</Badge>
      case "cancelled":
        return <Badge className="bg-rose-500 hover:bg-rose-600 border-none">BATAL</Badge>
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

  const formatRupiahShort = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}Jt`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}Rb`
    return val.toString()
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
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Menghubungkan ke pusat data POS...</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-6 space-y-6">
            <div className="px-4 lg:px-6">
              <h1 className="text-3xl font-bold tracking-tight">Ikhtisar Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Ikhtisar kinerja operasional, penjualan, dan inventori toko grosir Anda secara real-time.
              </p>
            </div>

            {/* Metrics cards widgets */}
            <SectionCards metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-6">
              {/* Daily revenue interactive chart (Left/Center 2 cols) */}
              <div className="lg:col-span-2">
                <ChartAreaInteractive data={chartData} />
              </div>

              {/* Recent Orders List widget (Right 1 col) */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClipboardList className="size-5 text-primary" /> Pesanan Terbaru
                  </CardTitle>
                  <CardDescription>Menampilkan 5 aktivitas pesanan teranyar</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Belum ada aktivitas pesanan
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Pesanan</TableHead>
                          <TableHead>Pelanggan</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentOrders.map((order) => (
                          <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell className="max-w-[80px] truncate">{order.customer_name}</TableCell>
                            <TableCell className="text-right font-semibold text-xs">
                              {formatRupiah(order.total_price)}
                            </TableCell>
                            <TableCell className="text-center">
                              {getStatusBadge(order.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Revenue & Top Products Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 lg:px-6">

              {/* Monthly Revenue Bar Chart */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconChartBar className="size-5 text-primary" /> Omzet Bulanan
                  </CardTitle>
                  <CardDescription>Tren pendapatan 6 bulan terakhir</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyRevenue.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
                      Belum ada data pendapatan bulanan
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={formatRupiahShort}
                          width={55}
                        />
                        <Tooltip
                          formatter={(value: unknown) => [formatRupiah(Number(value ?? 0)), "Omzet"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top 5 Best Selling Products Bar Chart */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconTrophy className="size-5 text-amber-500" /> Produk Terlaris
                  </CardTitle>
                  <CardDescription>5 produk dengan penjualan unit terbanyak</CardDescription>
                </CardHeader>
                <CardContent>
                  {topProducts.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
                      Belum ada data penjualan produk
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={topProducts}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          width={100}
                          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                          tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                        />
                        <Tooltip
                          formatter={(value: unknown) => [`${Number(value ?? 0)} unit`, "Terjual"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                        />
                        <Bar dataKey="total_qty" radius={[0, 6, 6, 0]} maxBarSize={28}>
                          {topProducts.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
