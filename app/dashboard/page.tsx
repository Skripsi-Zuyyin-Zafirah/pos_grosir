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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconClipboardList, IconActivity } from "@tabler/icons-react"

type RecentOrder = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_price: number
  status: "antri" | "diproses" | "selesai" | "batal"
}

const LOW_STOCK_THRESHOLD = 5

type RevenueDay = {
  date: string
  revenue: number
}

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

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // 1. Calculate Total Revenue (sum of completed & paid orders)
      const { data: payData, error: payErr } = await supabase
        .from("orders")
        .select("total_price, completed_at")
        .not("completed_at", "is", null)
      if (payErr) throw payErr
      const totalRev = payData ? payData.reduce((sum, p) => sum + p.total_price, 0) : 0

      // 2. Calculate Today's Orders
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const { count: todayCount, error: todayErr } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfToday.toISOString())
      if (todayErr) throw todayErr

      // 3. Calculate Active Queue Length (antri & diproses)
      const { count: activeCount, error: activeErr } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["antri", "diproses"])
      if (activeErr) throw activeErr

      // 4. Calculate Critical Stock Level
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("stock_qty")
      if (prodErr) throw prodErr
      const lowCount = prodData ? prodData.filter((p) => p.stock_qty <= LOW_STOCK_THRESHOLD).length : 0

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
        .from("orders")
        .select("total_price, completed_at")
        .not("completed_at", "is", null)
        .gte("completed_at", sevenDaysAgo.toISOString())
      if (chartErr) throw chartErr

      // Group completed orders by date
      const dailyMap: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split("T")[0]
        dailyMap[dateStr] = 0
      }

      if (chartPayments) {
        chartPayments.forEach((p) => {
          const dateStr = (p.completed_at as string).split("T")[0]
          if (dailyMap[dateStr] !== undefined) {
            dailyMap[dateStr] += p.total_price
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
      case "antri":
        return <Badge className="bg-sky-500 hover:bg-sky-600 border-none">ANTRI</Badge>
      case "diproses":
        return <Badge className="bg-amber-500 hover:bg-amber-600 border-none">DIPROSES</Badge>
      case "selesai":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none">SELESAI</Badge>
      case "batal":
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
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
