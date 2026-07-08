"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  IconLoader2,
  IconShoppingCart,
  IconClock,
  IconCircleCheck,
  IconCurrencyDollar,
  IconArrowRight,
  IconPackage,
} from "@tabler/icons-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerMetrics = {
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalSpending: number
}

type RecentOrder = {
  id: string
  order_number: string | null
  created_at: string
  total_items: number
  total_price: number
  status: "antri" | "diproses" | "selesai" | "batal"
  payment_method: "tunai" | "online" | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)

const formatRupiahShort = (val: number) => {
  if (val >= 1_000_000_000)
    return `${(val / 1_000_000_000).toFixed(1)} M`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Jt`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)} Rb`
  return val.toString()
}

function getStatusBadge(status: string) {
  switch (status) {
    case "antri":
      return (
        <Badge className="bg-sky-500 hover:bg-sky-600 border-none font-semibold text-xs text-white">
          ANTRI
        </Badge>
      )
    case "diproses":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-semibold text-xs text-white">
          DIPROSES
        </Badge>
      )
    case "selesai":
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold text-xs text-white">
          SELESAI
        </Badge>
      )
    case "batal":
      return (
        <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold text-xs text-white">
          BATAL
        </Badge>
      )
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>
  }
}

export default function CustomerDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [metrics, setMetrics] = useState<CustomerMetrics>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalSpending: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

  // ── Fetch Dashboard Data ───────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // 1. Verify session & get user
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push("/login")
        return
      }

      const userId = session.user.id

      // 2. Fetch profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single()

      setUserName(
        profile?.full_name || session.user.email?.split("@")[0] || "Customer"
      )

      // 3. Fetch ALL orders for this user (for metrics)
      const { data: allOrders, error: ordersErr } = await supabase
        .from("orders")
        .select("id, status, total_price")
        .eq("user_id", userId)

      if (ordersErr) throw ordersErr

      const orders = allOrders || []

      // Calculate metrics
      const totalOrders = orders.length
      const activeOrders = orders.filter((o) =>
        ["antri", "diproses"].includes(o.status)
      ).length
      const completedOrders = orders.filter((o) => o.status === "selesai").length
      const totalSpending = orders
        .filter((o) => o.status === "selesai")
        .reduce((sum, o) => sum + (o.total_price || 0), 0)

      setMetrics({ totalOrders, activeOrders, completedOrders, totalSpending })

      // 4. Fetch 5 most recent orders for the table
      const { data: recent, error: recentErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, total_items, total_price, status, payment_method"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5)

      if (recentErr) throw recentErr
      setRecentOrders((recent as RecentOrder[]) || [])
    } catch (err: any) {
      toast.error("Gagal memuat dashboard: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // ── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center space-y-4 min-h-[60vh]">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Memuat dashboard Anda...</p>
      </div>
    )
  }

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col py-6 space-y-6">
      {/* ── Welcome Header ── */}
      <div className="px-4 lg:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Halo, {userName}!
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Selamat datang kembali di portal belanja POS Grosir Jasa. Berikut ringkasan belanja Anda.
        </p>
      </div>

      {/* ── Metrics Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 lg:px-6">
        {/* Card 1: Total Orders */}
        <Card className="border-border/50 shadow-sm bg-gradient-to-tr from-sky-500/5 to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <IconPackage className="size-4 text-sky-500" /> Total Transaksi
            </CardDescription>
            <CardTitle className="text-2xl font-black tracking-tight text-sky-600 dark:text-sky-400 mt-1">
              {metrics.totalOrders} <span className="text-xs font-normal text-muted-foreground">nota</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Jumlah pesanan yang pernah Anda buat di toko.
          </CardContent>
        </Card>

        {/* Card 2: Active Orders */}
        <Card className="border-border/50 shadow-sm bg-gradient-to-tr from-amber-500/5 to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <IconClock className="size-4 text-amber-500" /> Pesanan Aktif
            </CardDescription>
            <CardTitle className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 mt-1">
              {metrics.activeOrders} <span className="text-xs font-normal text-muted-foreground">antrean</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Pesanan yang sedang mengantri atau diproses.
          </CardContent>
        </Card>

        {/* Card 3: Completed Orders */}
        <Card className="border-border/50 shadow-sm bg-gradient-to-tr from-emerald-500/5 to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <IconCircleCheck className="size-4 text-emerald-500" /> Selesai
            </CardDescription>
            <CardTitle className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.completedOrders} <span className="text-xs font-normal text-muted-foreground">nota</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Pesanan yang selesai diproses & lunas dibayar.
          </CardContent>
        </Card>

        {/* Card 4: Total Spending */}
        <Card className="border-border/50 shadow-sm bg-gradient-to-tr from-violet-500/5 to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <IconCurrencyDollar className="size-4 text-violet-500" /> Pengeluaran
            </CardDescription>
            <CardTitle className="text-xl font-black tracking-tight text-violet-600 dark:text-violet-400 mt-1.5">
              {formatRupiahShort(metrics.totalSpending)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Akumulasi pengeluaran belanja selesai: <strong>{formatRupiah(metrics.totalSpending)}</strong>
          </CardContent>
        </Card>
      </div>

      {/* ── Actions & Recent Orders Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-6">
        {/* Quick Action Panel */}
        <Card className="border-border/50 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-lg">Belanja Mandiri</CardTitle>
            <CardDescription>
              Buat pesanan grosir baru secara online untuk mempercepat pengambilan barang di toko.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-6">
            <Button asChild size="lg" className="w-full font-bold shadow-md">
              <Link href="/customer/shop">
                <IconShoppingCart className="mr-2 size-5" />
                Katalog Belanja
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full font-semibold">
              <Link href="/customer/cart">
                Keranjang Belanja
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Orders List */}
        <Card className="border-border/50 shadow-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <IconPackage className="size-5 text-primary" /> Pesanan Terakhir
            </CardTitle>
            <CardDescription>
              Aktivitas 5 pesanan belanja teranyar Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Anda belum pernah membuat pesanan
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>No. Pesanan</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-center">Jumlah Item</TableHead>
                      <TableHead className="text-right">Total Harga</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Status Bayar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          #
                          {order.order_number ||
                            order.id.substring(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {order.total_items} item
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs whitespace-nowrap text-primary">
                          {formatRupiah(order.total_price)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold">
                          {order.status === "selesai" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Lunas
                            </span>
                          ) : order.status === "batal" ? (
                            <span className="text-rose-500">
                              Batal
                            </span>
                          ) : (
                            <span className="text-rose-500 dark:text-rose-400">
                              Belum Bayar
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-border/50 pt-4 flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/customer/orders">
                Lihat Semua Pesanan
                <IconArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
