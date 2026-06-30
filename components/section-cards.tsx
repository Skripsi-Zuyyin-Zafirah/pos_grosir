"use client"

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { IconCash, IconHourglassHigh, IconClipboardList, IconAlertTriangle } from "@tabler/icons-react"

export interface DashboardMetrics {
  totalRevenue: number
  todayOrdersCount: number
  activeQueueLength: number
  lowStockCount: number
}

interface SectionCardsProps {
  metrics: DashboardMetrics
}

export function SectionCards({ metrics }: SectionCardsProps) {
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 md:grid-cols-2 lg:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {/* 1. Total Revenue Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconCash className="size-4 text-emerald-500" /> Total Pendapatan
          </CardDescription>
          <CardTitle className="text-xl font-bold tabular-nums @[250px]/card:text-2xl mt-1 text-emerald-600 dark:text-emerald-400">
            {formatRupiah(metrics.totalRevenue)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <p>Akumulasi total transaksi sukses di kasir.</p>
        </CardFooter>
      </Card>

      {/* 2. Today's Orders Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconClipboardList className="size-4 text-sky-500" /> Pesanan Hari Ini
          </CardDescription>
          <CardTitle className="text-2xl font-bold mt-1 text-sky-600 dark:text-sky-400">
            {metrics.todayOrdersCount} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <p>Total pesanan masuk pada hari ini.</p>
        </CardFooter>
      </Card>

      {/* 3. Queue Length Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconHourglassHigh className="size-4 text-amber-500" /> Antrean Saat Ini
          </CardDescription>
          <CardTitle className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {metrics.activeQueueLength} <span className="text-xs font-normal text-muted-foreground">antrean</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <p>Pesanan berstatus ANTRI & DIPROSES.</p>
        </CardFooter>
      </Card>

      {/* 4. Low Stock Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconAlertTriangle className="size-4 text-rose-500 animate-pulse" /> Stok Kritis
          </CardDescription>
          <CardTitle className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
            {metrics.lowStockCount} <span className="text-xs font-normal text-muted-foreground">barang</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
          <p>Jumlah produk di bawah reorder level.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
