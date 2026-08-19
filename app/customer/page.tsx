"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PriorityQueueService } from "@/lib/queue/priority-queue-service"
import { formatDuration } from "@/lib/queue/ewp"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  IconLoader2,
  IconClipboardList,
  IconHourglassHigh,
  IconCash,
  IconPackage,
  IconClock,
  IconArrowRight,
  IconListNumbers,
} from "@tabler/icons-react"

type Order = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  ewp: number
  status: "antri" | "diproses" | "selesai" | "batal"
  completed_at: string | null
}

type QueueEntry = {
  id: string
  user_id: string
  ewp: number
  created_at: string
}

export default function CustomerDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profileName, setProfileName] = useState<string>("Pelanggan")
  const [orders, setOrders] = useState<Order[]>([])
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [queueLength, setQueueLength] = useState<number>(0)
  const [waitEstimate, setWaitEstimate] = useState<number | null>(null)
  const [now, setNow] = useState<Date>(new Date())

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single()
      if (profile?.full_name) setProfileName(profile.full_name)

      // 1. Fetch all orders belonging to this customer
      const { data: myOrders, error: ordersErr } = await supabase
        .from("orders")
        .select("id, order_number, created_at, customer_name, total_items, total_price, ewp, status, completed_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
      if (ordersErr) throw ordersErr
      setOrders((myOrders as Order[]) || [])

      // 2. Fetch the full waiting queue and compute this customer's position via Min-Heap (EWP)
      const { data: waitingQueue, error: queueErr } = await supabase
        .from("orders")
        .select("id, user_id, ewp, created_at")
        .eq("status", "antri")
      if (queueErr) throw queueErr

      const queue = (waitingQueue as QueueEntry[]) || []
      setQueueLength(queue.length)

      const positions = PriorityQueueService.getPositions(queue)
      const waitEstimates = PriorityQueueService.getWaitEstimates(queue)
      const myEntry = queue.find((q) => q.user_id === session.user.id)
      setQueuePosition(myEntry ? positions.get(myEntry.id) ?? null : null)
      setWaitEstimate(myEntry ? waitEstimates.get(myEntry.id) ?? null : null)
    } catch (err: any) {
      toast.error("Gagal memuat dashboard: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Subscribe to real-time order updates
    const channel = supabase
      .channel("customer-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchDashboardData()
        }
      )
      .subscribe()

    // Clock tick for ECT countdown
    const interval = setInterval(() => {
      setNow(new Date())
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const activeOrders = orders.filter((o) => ["antri", "diproses"].includes(o.status))
  const totalSpent = orders
    .filter((o) => !!o.completed_at && o.status !== "batal")
    .reduce((sum, o) => sum + o.total_price, 0)
  const currentOrder = activeOrders[activeOrders.length - 1] || activeOrders[0] || null

  const getTimeLeft = (createdAtStr: string, ewpSeconds: number) => {
    const createdAt = new Date(createdAtStr)
    const deadline = new Date(createdAt.getTime() + ewpSeconds * 1000)
    const diffMs = deadline.getTime() - now.getTime()
    return Math.ceil(diffMs / 1000 / 60)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "antri":
        return <Badge className="bg-sky-500 hover:bg-sky-600 border-none font-semibold">ANTRI</Badge>
      case "diproses":
        return <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-semibold">DIPROSES</Badge>
      case "selesai":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold">SELESAI</Badge>
      case "batal":
        return <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold">BATAL</Badge>
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
      <CustomerSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Memuat dashboard pelanggan...</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-6 space-y-6">
            <div className="px-4 lg:px-6">
              <h1 className="text-3xl font-bold tracking-tight">Halo, {profileName}!</h1>
              <p className="text-muted-foreground mt-1">
                Pantau status pesanan, posisi antrian, dan riwayat belanja Anda secara real-time.
              </p>
            </div>

            {/* Metrics cards widgets */}
            <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 md:grid-cols-2 lg:grid-cols-4 dark:*:data-[slot=card]:bg-card">
              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="flex items-center gap-1.5 font-medium">
                    <IconClipboardList className="size-4 text-sky-500" /> Total Pesanan
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold mt-1 text-sky-600 dark:text-sky-400">
                    {orders.length} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
                  </CardTitle>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
                  <p>Seluruh pesanan yang pernah Anda buat.</p>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="flex items-center gap-1.5 font-medium">
                    <IconHourglassHigh className="size-4 text-amber-500" /> Pesanan Aktif
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                    {activeOrders.length} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
                  </CardTitle>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
                  <p>Pesanan berstatus ANTRI, DIPROSES, atau SIAP.</p>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="flex items-center gap-1.5 font-medium">
                    <IconListNumbers className="size-4 text-indigo-500" /> Posisi Antrian
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                    {queuePosition !== null ? (
                      <>
                        #{queuePosition} <span className="text-xs font-normal text-muted-foreground">dari {queueLength} antrean</span>
                      </>
                    ) : (
                      <span className="text-base font-semibold text-muted-foreground">Tidak dalam antrian</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
                  <p>Urutan pesanan Anda pada antrian gudang saat ini.</p>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="flex items-center gap-1.5 font-medium">
                    <IconClock className="size-4 text-violet-500" /> Estimasi Tunggu
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold mt-1 text-violet-600 dark:text-violet-400">
                    {waitEstimate !== null ? (
                      formatDuration(waitEstimate)
                    ) : (
                      <span className="text-base font-semibold text-muted-foreground">-</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
                  <p>Estimasi sebelum pegawai mulai mengerjakan pesanan Anda.</p>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="flex items-center gap-1.5 font-medium">
                    <IconCash className="size-4 text-emerald-500" /> Total Belanja
                  </CardDescription>
                  <CardTitle className="text-xl font-bold tabular-nums @[250px]/card:text-2xl mt-1 text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(totalSpent)}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
                  <p>Akumulasi transaksi yang sudah lunas.</p>
                </CardFooter>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-6">
              {/* Riwayat pesanan (Left/Center 2 cols) */}
              <Card className="lg:col-span-2 border-border/50 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="size-5 text-primary" /> Pesanan Terbaru
                    </CardTitle>
                    <CardDescription>Menampilkan 8 pesanan terakhir Anda</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/customer/orders">
                      Lihat Semua <IconArrowRight className="size-4 ml-1" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <IconPackage className="size-14 text-muted-foreground/60 mb-2" />
                      <h3 className="font-semibold">Belum Ada Pesanan</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mt-1">
                        Anda belum pernah melakukan pemesanan. Silakan berbelanja terlebih dahulu.
                      </p>
                      <Button className="mt-4" asChild>
                        <Link href="/customer/catalog">Mulai Belanja</Link>
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Pesanan</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-center">Bayar</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.slice(0, 8).map((order) => (
                          <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs">
                              {formatRupiah(order.total_price)}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {order.completed_at ? (
                                <span className="text-emerald-600 font-semibold">Lunas</span>
                              ) : (
                                <span className="text-rose-500 font-semibold">Belum</span>
                              )}
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

              {/* Status pesanan aktif (Right 1 col) */}
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClock className="size-5 text-primary" /> Pesanan Aktif
                  </CardTitle>
                  <CardDescription>Status pesanan Anda yang sedang berjalan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeOrders.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada pesanan aktif saat ini.
                    </div>
                  ) : (
                    activeOrders.map((order) => {
                      const timeLeft = getTimeLeft(order.created_at, order.ewp)
                      return (
                        <div
                          key={order.id}
                          className="border border-border/50 rounded-xl p-4 space-y-3 bg-muted/20"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-bold text-primary">
                              #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Total</p>
                              <p className="font-semibold">{formatRupiah(order.total_price)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Estimasi (EWP)</p>
                              <p className="font-semibold">
                                {timeLeft > 0 ? (
                                  `± ${timeLeft} menit lagi`
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400">Segera selesai</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
                {activeOrders.length > 0 && (
                  <CardFooter className="border-t border-border/50 pt-4">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/customer/orders">
                        Kelola Pesanan <IconArrowRight className="size-4 ml-1" />
                      </Link>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
