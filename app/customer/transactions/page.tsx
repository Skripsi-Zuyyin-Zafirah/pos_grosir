"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  IconReceipt,
  IconEye,
  IconCircleCheck,
  IconCircleX,
  IconListDetails,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string
  unit_price: number
  qty: number
  products: {
    name: string
  } | null
}

type Transaction = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  status: "selesai" | "batal"
  payment_method: "tunai" | "online" | null
  order_items: OrderItem[]
}

type FilterTab = "all" | "selesai" | "batal"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)

function StatusBadge({ status }: { status: string }) {
  if (status === "selesai") {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-semibold text-xs text-white">
        SELESAI
      </Badge>
    )
  }
  return (
    <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-semibold text-xs text-white">
      BATAL
    </Badge>
  )
}

// ─── Filter Tab Button ────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 border
        ${
          active
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
        }`}
    >
      {icon}
      {label}
      <span
        className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold
          ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}
      >
        {count}
      </span>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerTransactionsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>("all")

  // Modal detail
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchTransactions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items (id, qty, unit_price, products ( name ))")
        .eq("user_id", user.id)
        .in("status", ["selesai", "batal"])
        .order("created_at", { ascending: false })

      if (error) throw error
      setTransactions((data as any[]) || [])
    } catch (err: any) {
      toast.error("Gagal memuat riwayat transaksi: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  // ── Derived filtered list ─────────────────────────────────────────────────
  const filtered =
    activeTab === "all"
      ? transactions
      : transactions.filter((t) => t.status === activeTab)

  const countAll = transactions.length
  const countDone = transactions.filter((t) => t.status === "selesai").length
  const countCancelled = transactions.filter((t) => t.status === "batal").length

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] space-y-4">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          Memuat riwayat transaksi...
        </p>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Transaksi</h1>
        <p className="text-muted-foreground mt-1">
          Daftar semua pesanan Anda yang sudah selesai atau dibatalkan.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          icon={<IconListDetails className="size-4" />}
          label="Semua"
          count={countAll}
        />
        <TabButton
          active={activeTab === "selesai"}
          onClick={() => setActiveTab("selesai")}
          icon={<IconCircleCheck className="size-4" />}
          label="Selesai"
          count={countDone}
        />
        <TabButton
          active={activeTab === "batal"}
          onClick={() => setActiveTab("batal")}
          icon={<IconCircleX className="size-4" />}
          label="Dibatalkan"
          count={countCancelled}
        />
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
          <IconReceipt className="size-16 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg">
            {activeTab === "all"
              ? "Belum Ada Riwayat Transaksi"
              : activeTab === "selesai"
                ? "Belum Ada Transaksi Selesai"
                : "Belum Ada Transaksi yang Dibatalkan"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            {activeTab === "all"
              ? "Riwayat pesanan yang sudah selesai atau dibatalkan akan muncul di sini."
              : "Tidak ada data untuk filter yang dipilih."}
          </p>
        </div>
      ) : (
        /* Transaction Table Card */
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconReceipt className="size-5 text-primary" />
              {activeTab === "all"
                ? "Semua Transaksi"
                : activeTab === "selesai"
                  ? "Transaksi Selesai"
                  : "Transaksi Dibatalkan"}
            </CardTitle>
            <CardDescription>
              Menampilkan {filtered.length} transaksi
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>No. Pesanan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-center">Total Item</TableHead>
                    <TableHead className="text-right">Total Harga</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Status Bayar</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        #{tx.order_number || tx.id.substring(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {tx.total_items} item
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm whitespace-nowrap">
                        {formatRupiah(tx.total_price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {tx.status === "selesai" ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Lunas
                          </span>
                        ) : tx.status === "batal" ? (
                          <span className="text-xs font-semibold text-rose-500">
                            Batal
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">
                            Belum Bayar
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            setSelectedTx(tx)
                            setDetailOpen(true)
                          }}
                        >
                          <IconEye className="size-4" />
                          <span className="ml-1 text-xs">Detail</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconReceipt className="size-5" />
              Detail Transaksi
            </DialogTitle>
            <DialogDescription>
              Rincian produk dan jumlah pembayaran pesanan ini.
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">No. Pesanan</p>
                  <p className="font-mono font-bold">
                    #{selectedTx.order_number ||
                      selectedTx.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Atas Nama</p>
                  <p className="font-medium">{selectedTx.customer_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Tanggal</p>
                  <p className="font-medium">
                    {new Date(selectedTx.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                  <StatusBadge status={selectedTx.status} />
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTx.order_items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground text-sm py-6"
                        >
                          Tidak ada data item
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedTx.order_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">
                            {item.products?.name || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.qty} pcs
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {formatRupiah(item.unit_price * item.qty)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-sm border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Item:</span>
                  <span className="font-semibold">
                    {selectedTx.total_items} unit
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status Bayar:</span>
                  <span
                    className={`font-semibold ${
                      selectedTx.status === "selesai"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500"
                    }`}
                  >
                    {selectedTx.status === "selesai"
                      ? "Sudah Lunas"
                      : "Batal / Belum Dibayar"}
                  </span>
                </div>
                <div className="flex justify-between text-base border-t pt-2 mt-1">
                  <span className="font-semibold">Total Pembayaran:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatRupiah(selectedTx.total_price)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
