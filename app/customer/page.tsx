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
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
  payment_status: "unpaid" | "paid" | null
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
    case "waiting":
      return (
        <Badge className="bg-sky-500 hover:bg-sky-600 border-none font-semibold text-xs">
          ANTRI
        </Badge>
      )
    case "processing":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-semibold text-xs">
          DIPROSES
        </Badge>
      )
    case "ready":
      return (
        <Badge className="bg-indigo-500 hover:bg-indigo-600 border-none font-semibold text-xs">
          SIAP DIAMBIL
        </Badge>
      )
    case "done":
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold text-xs">
          SELESAI
        </Badge>
      )
    case "cancelled":
      return (
        <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold text-xs">
          BATAL
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      )
  }
}

// ─── Summary Card Component ───────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  iconBg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  iconBg: string
}) {
  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && (
              <p className="text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [metrics, setMetrics] = useState<CustomerMetrics>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalSpending: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

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
        .select("id, status, total_price, payment_status")
        .eq("user_id", userId)

      if (ordersErr) throw ordersErr

      const orders = allOrders || []

      // Calculate metrics
      const totalOrders = orders.length
      const activeOrders = orders.filter((o) =>
        ["waiting", "processing", "ready"].includes(o.status)
      ).length
      const completedOrders = orders.filter((o) => o.status === "done").length
      const totalSpending = orders
        .filter((o) => o.status === "done")
        .reduce((sum, o) => sum + (o.total_price || 0), 0)

      setMetrics({ totalOrders, activeOrders, completedOrders, totalSpending })

      // 4. Fetch 5 most recent orders for the table
      const { data: recent, error: recentErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, total_items, total_price, status, payment_status"
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
      {/* ── Page Header ── */}
      <div className="px-4 lg:px-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Selamat datang, {userName}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Berikut ringkasan aktivitas pesanan Anda secara real-time.
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-4 lg:px-6">
        <SummaryCard
          icon={
            <IconShoppingCart className="size-5 text-blue-600 dark:text-blue-400" />
          }
          label="Total Pesanan"
          value={metrics.totalOrders}
          sub="Semua pesanan yang pernah dibuat"
          iconBg="bg-blue-500/10"
        />
        <SummaryCard
          icon={
            <IconClock className="size-5 text-amber-600 dark:text-amber-400" />
          }
          label="Pesanan Aktif"
          value={metrics.activeOrders}
          sub="Sedang antri, diproses, atau siap diambil"
          iconBg="bg-amber-500/10"
        />
        <SummaryCard
          icon={
            <IconCircleCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          }
          label="Pesanan Selesai"
          value={metrics.completedOrders}
          sub="Pesanan yang telah berhasil diambil"
          iconBg="bg-emerald-500/10"
        />
        <SummaryCard
          icon={
            <IconCurrencyDollar className="size-5 text-purple-600 dark:text-purple-400" />
          }
          label="Total Pengeluaran"
          value={formatRupiahShort(metrics.totalSpending)}
          sub={formatRupiah(metrics.totalSpending)}
          iconBg="bg-purple-500/10"
        />
      </div>

      {/* ── Recent Orders Table ── */}
      <div className="px-4 lg:px-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconPackage className="size-5 text-primary" />
              Pesanan Terbaru
            </CardTitle>
            <CardDescription>
              5 pesanan terakhir yang Anda buat
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              /* ── Empty State ── */
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <IconPackage className="size-12 text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-base">Belum Ada Pesanan</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Anda belum pernah membuat pesanan. Mulai belanja dari halaman
                  katalog.
                </p>
              </div>
            ) : (
              /* ── Table ── */
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
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {order.total_items} item
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm whitespace-nowrap">
                          {formatRupiah(order.total_price)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {order.payment_status === "paid" ? (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              Lunas
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">
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
