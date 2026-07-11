"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPackage,
  IconX,
  IconEye,
  IconRefresh,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconArrowsSort,
  IconChevronsLeft,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconBan,
} from "@tabler/icons-react"

type Order = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  ewp: number
  status: "waiting" | "processing" | "ready" | "done" | "cancelled"
  completed_at: string | null
}

type StatusTab = "all" | "done" | "cancelled"

function SortHeader({ label, column }: { label: string; column: any }) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {sorted === "asc" ? (
        <IconSortAscending className="size-3.5" />
      ) : sorted === "desc" ? (
        <IconSortDescending className="size-3.5" />
      ) : (
        <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
      )}
    </button>
  )
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // DataTable controls
  const [statusTab, setStatusTab] = useState<StatusTab>("all")
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchUserAndOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        // Not logged in
        setLoading(false)
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, customer_name, total_items, total_price, ewp, status, completed_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setOrders((data as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat pesanan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserAndOrders()

    // Subscribe to real-time order updates
    const channel = supabase
      .channel("customer-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          // Re-fetch when any order changes
          fetchUserAndOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Reset to first page whenever the active tab or search term changes
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [statusTab, search])

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) return
    setCancellingId(orderId)

    try {
      // Call RPC function to update order and optionally handle staff
      const { error } = await supabase.rpc("cancel_order_transaction", {
        p_order_id: orderId,
      })

      if (error) throw error

      toast.success("Pesanan berhasil dibatalkan!")
      fetchUserAndOrders()
    } catch (err: any) {
      toast.error("Gagal membatalkan pesanan: " + err.message)
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const base = "border-none font-bold text-[11px] tracking-wide px-2.5 py-1 gap-1.5 shadow-sm"
    switch (status) {
      case "waiting":
        return (
          <Badge className={`${base} bg-sky-500 hover:bg-sky-600 text-white`}>
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            ANTRI
          </Badge>
        )
      case "processing":
        return (
          <Badge className={`${base} bg-amber-500 hover:bg-amber-600 text-white`}>
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            DIPROSES
          </Badge>
        )
      case "ready":
        return (
          <Badge className={`${base} bg-indigo-500 hover:bg-indigo-600 text-white`}>
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            SIAP DIAMBIL
          </Badge>
        )
      case "done":
        return (
          <Badge className={`${base} bg-emerald-500 hover:bg-emerald-600 text-white`}>
            <IconCircleCheckFilled className="size-3" />
            SELESAI
          </Badge>
        )
      case "cancelled":
        return (
          <Badge className={`${base} bg-rose-500 hover:bg-rose-600 text-white`}>
            <IconBan className="size-3" />
            BATAL
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusRowAccent = (status: string) => {
    switch (status) {
      case "waiting":
        return "border-l-4 border-l-sky-500"
      case "processing":
        return "border-l-4 border-l-amber-500"
      case "ready":
        return "border-l-4 border-l-indigo-500"
      case "done":
        return "border-l-4 border-l-emerald-500"
      case "cancelled":
        return "border-l-4 border-l-rose-500 bg-rose-500/5"
      default:
        return "border-l-4 border-l-transparent"
    }
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const counts = useMemo(
    () => ({
      all: orders.length,
      done: orders.filter((o) => o.status === "done").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    }),
    [orders]
  )

  const tabFilteredOrders = useMemo(() => {
    if (statusTab === "all") return orders
    return orders.filter((o) => o.status === statusTab)
  }, [orders, statusTab])

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: ({ column }) => <SortHeader label="No. Pesanan" column={column} />,
        cell: ({ row }) => (
          <Link
            href={`/customer/orders/${row.original.id}`}
            className="font-mono text-xs font-bold text-primary hover:underline underline-offset-2"
          >
            #{row.original.order_number || row.original.id.substring(0, 8).toUpperCase()}
          </Link>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => <SortHeader label="Tanggal" column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.created_at).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        accessorKey: "total_items",
        header: "Item",
        cell: ({ row }) => <span className="text-xs">{row.original.total_items} unit</span>,
      },
      {
        accessorKey: "total_price",
        header: ({ column }) => <SortHeader label="Total" column={column} />,
        cell: ({ row }) => (
          <span className="font-semibold text-sm text-primary">
            {formatRupiah(row.original.total_price)}
          </span>
        ),
      },
      {
        id: "paid",
        header: "Bayar",
        cell: ({ row }) =>
          row.original.completed_at ? (
            <span className="text-xs font-semibold text-emerald-600">Lunas</span>
          ) : (
            <span className="text-xs font-semibold text-rose-500">Belum</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customer/orders/${row.original.id}`}>
                <IconEye className="size-3.5 mr-1" /> Detail
              </Link>
            </Button>
            {row.original.status === "waiting" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleCancelOrder(row.original.id)}
                disabled={cancellingId === row.original.id}
              >
                {cancellingId === row.original.id ? (
                  <IconLoader2 className="size-3.5 animate-spin" />
                ) : (
                  <IconX className="size-3.5" />
                )}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [cancellingId]
  )

  const table = useReactTable({
    data: tabFilteredOrders,
    columns,
    state: {
      sorting,
      globalFilter: search,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase()
      const o = row.original
      return (
        (o.order_number || "").toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      )
    },
  })

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
        <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Riwayat & Status Pesanan</h1>
              <p className="text-muted-foreground mt-1">
                Pantau status pesanan dan antrian Anda secara real-time.
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={fetchUserAndOrders}>
              <IconRefresh className="size-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Memuat riwayat pesanan...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
              <IconPackage className="size-16 text-muted-foreground/60 mb-2" />
              <h3 className="font-semibold text-lg">Belum Ada Pesanan</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Anda belum pernah melakukan pemesanan. Silakan berbelanja di katalog terlebih dahulu.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/customer/catalog">Mulai Belanja</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toggle status & pencarian */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
                  <TabsList>
                    <TabsTrigger value="all">
                      Semua <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="done">
                      Selesai <Badge variant="secondary" className="ml-1">{counts.done}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="cancelled">
                      Dibatalkan <Badge variant="secondary" className="ml-1">{counts.cancelled}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative w-full md:w-72">
                  <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari No. Pesanan atau nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* DataTable */}
              <div className="overflow-hidden rounded-lg border border-border/50 bg-background shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className={`hover:bg-muted/30 transition-colors ${getStatusRowAccent(row.original.status)}`}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                            Tidak ada pesanan yang cocok.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
                <div className="text-sm text-muted-foreground">
                  Menampilkan {table.getRowModel().rows.length} dari {tabFilteredOrders.length} pesanan
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-sm font-medium">Baris per halaman</span>
                    <Select
                      value={`${table.getState().pagination.pageSize}`}
                      onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                      <SelectTrigger size="sm" className="w-20">
                        <SelectValue placeholder={table.getState().pagination.pageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[5, 10, 20, 30].map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm font-medium">
                    Halaman {table.getState().pagination.pageIndex + 1} dari {Math.max(table.getPageCount(), 1)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 hidden sm:flex"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <IconChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <IconChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      <IconChevronRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 hidden sm:flex"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                    >
                      <IconChevronsRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
