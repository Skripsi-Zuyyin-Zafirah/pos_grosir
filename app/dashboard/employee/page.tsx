"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPlus,
  IconCheck,
  IconBox,
  IconUserCircle,
  IconSearch,
  IconEdit,
  IconTrash,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
} from "@tabler/icons-react"

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
  return dir === "asc" ? (
    <IconSortAscending className="size-3.5 text-foreground" />
  ) : (
    <IconSortDescending className="size-3.5 text-foreground" />
  )
}

type Staff = {
  id: string
  name: string
  status: "idle" | "sibuk" | null
  created_at: string | null
}

type ActiveOrderInfo = {
  id: string
  order_number: string | null
}

type OrderItem = {
  id: string
  qty: number
  unit_price: number
  products: {
    sku: string | null
    name: string
  } | null
}

type Order = {
  id: string
  order_number: string | null
  customer_name: string | null
  ewp: number
  total_items: number
}

export default function EmployeePage() {
  const supabase = createClient()

  // ===== Shared staff list =====
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [activeOrderByStaff, setActiveOrderByStaff] = useState<Record<string, ActiveOrderInfo>>({})

  const fetchStaffList = async () => {
    try {
      setLoadingStaff(true)
      const [{ data: staffData, error: staffErr }, { data: activeOrders, error: orderErr }] = await Promise.all([
        supabase.from("staff").select("id, name, status, created_at").order("name"),
        supabase
          .from("orders")
          .select("id, order_number, staff_id")
          .eq("status", "diproses")
          .is("packed_at", null)
          .not("staff_id", "is", null),
      ])
      if (staffErr) throw staffErr
      if (orderErr) throw orderErr

      setStaffList(staffData || [])

      const mapping: Record<string, ActiveOrderInfo> = {}
      for (const o of activeOrders || []) {
        if (o.staff_id) mapping[o.staff_id] = { id: o.id, order_number: o.order_number }
      }
      setActiveOrderByStaff(mapping)
    } catch (err: any) {
      toast.error("Gagal memuat data pegawai: " + err.message)
    } finally {
      setLoadingStaff(false)
    }
  }

  useEffect(() => {
    fetchStaffList()

    const channel = supabase
      .channel("employee-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => fetchStaffList())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchStaffList())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ===== CRUD: Kelola Pegawai =====
  const [search, setSearch] = useState("")

  type SortKey = "name" | "status"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const handleAdd = () => {
    setEditId(null)
    setFormName("")
    setFormOpen(true)
  }

  const handleEdit = (staff: Staff) => {
    setEditId(staff.id)
    setFormName(staff.name)
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return
    setSubmitting(true)

    try {
      if (editId) {
        const { error } = await supabase
          .from("staff")
          .update({ name: formName.trim() })
          .eq("id", editId)
        if (error) throw error
        toast.success("Data pegawai berhasil diperbarui!")
      } else {
        const { error } = await supabase.from("staff").insert({ name: formName.trim(), status: "idle" })
        if (error) throw error
        toast.success("Pegawai baru berhasil didaftarkan!")
      }

      setFormOpen(false)
      fetchStaffList()
    } catch (err: any) {
      toast.error("Gagal menyimpan data pegawai: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (staff: Staff) => {
    if (staff.status === "sibuk") {
      toast.error(`Pegawai "${staff.name}" sedang menangani pesanan dan tidak bisa dihapus.`)
      return
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus pegawai "${staff.name}"?`)) return

    try {
      const { error } = await supabase.from("staff").delete().eq("id", staff.id)
      if (error) throw error
      toast.success("Pegawai berhasil dihapus!")
      fetchStaffList()
    } catch (err: any) {
      toast.error("Gagal menghapus pegawai: " + err.message)
    }
  }

  const filteredStaff = staffList.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    const valA = sortKey === "name" ? a.name : a.status || ""
    const valB = sortKey === "name" ? b.name : b.status || ""
    return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
  })

  const totalPages = Math.ceil(sortedStaff.length / itemsPerPage)
  const paginatedStaff = sortedStaff.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  useEffect(() => {
    setPage(1)
  }, [search, itemsPerPage, sortKey, sortDir])

  // ===== Proses Packing (worker self-service) =====
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!activeStaff) {
      setActiveOrder(null)
      setOrderItems([])
      setCheckedItems({})
      return
    }
    const refreshed = staffList.find((s) => s.id === activeStaff.id)
    if (refreshed) setActiveStaff(refreshed)

    const orderInfo = activeOrderByStaff[activeStaff.id]
    if (orderInfo) {
      fetchActiveOrderDetails(orderInfo.id)
    } else {
      setActiveOrder(null)
      setOrderItems([])
      setCheckedItems({})
    }
  }, [activeStaff?.id, staffList, activeOrderByStaff])

  const fetchActiveOrderDetails = async (orderId: string) => {
    setLoadingOrder(true)
    try {
      const { data: ord, error: ordErr } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, ewp, total_items")
        .eq("id", orderId)
        .single()
      if (ordErr) throw ordErr
      setActiveOrder(ord)

      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("*, products:product_id ( sku, name )")
        .eq("order_id", orderId)
      if (itemsErr) throw itemsErr

      setOrderItems(items || [])
      setCheckedItems({})
    } catch (err: any) {
      toast.error("Gagal memuat detail pesanan: " + err.message)
    } finally {
      setLoadingOrder(false)
    }
  }

  const handleToggleItem = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  const checkedCount = orderItems.filter((item) => checkedItems[item.id]).length
  const isPickingComplete = orderItems.length > 0 && checkedCount === orderItems.length

  const handleMarkReady = async () => {
    if (!activeStaff || !activeOrder) return
    setLoadingOrder(true)

    try {
      const { error } = await supabase.rpc("complete_packing", {
        p_order_id: activeOrder.id,
      })
      if (error) throw error

      toast.success("Pesanan selesai di-packing dan ditandai siap diambil!")
      setActiveOrder(null)
      setOrderItems([])
      setCheckedItems({})
      await fetchStaffList()
    } catch (err: any) {
      toast.error("Gagal menandai siap: " + err.message)
    } finally {
      setLoadingOrder(false)
    }
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
        <div className="flex flex-1 flex-col p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kelola Pegawai</h1>
            <p className="text-muted-foreground mt-1">
              Kelola data pegawai gudang dan pantau proses picking &amp; packing pesanan yang ditugaskan. Klik kartu pegawai untuk melihat tugas aktifnya.
            </p>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Pegawai</CardTitle>
                  <CardDescription>Menampilkan total {filteredStaff.length} pegawai terdaftar</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama pegawai..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  <Button onClick={handleAdd} className="w-full sm:w-auto">
                    <IconPlus className="size-4 mr-2" /> Tambah Pegawai
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStaff ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat data pegawai...</p>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                  <IconUsers className="size-12 text-muted-foreground/60 mb-2" />
                  <h3 className="font-semibold text-lg">Tidak Ada Pegawai</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Silakan tambahkan pegawai baru atau sesuaikan pencarian untuk melihat data.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Urutkan Nama <SortIcon active={sortKey === "name"} dir={sortDir} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Urutkan Status <SortIcon active={sortKey === "status"} dir={sortDir} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {paginatedStaff.map((staff) => {
                      const order = activeOrderByStaff[staff.id]
                      const busy = staff.status === "sibuk"
                      const selected = activeStaff?.id === staff.id
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => setActiveStaff(staff)}
                          className={cn(
                            "relative flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors",
                            selected && "ring-2 ring-primary",
                            busy ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-emerald-500/30 bg-emerald-500/[0.04]"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-3 right-3 size-2 rounded-full",
                              busy ? "bg-amber-500" : "bg-emerald-500"
                            )}
                          />
                          <IconUserCircle className="size-8 text-muted-foreground" />
                          <span className="font-medium text-sm truncate max-w-full">{staff.name}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold",
                              busy
                                ? "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5"
                                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5"
                            )}
                          >
                            {busy ? "Sibuk" : "Idle"}
                          </Badge>
                          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-full">
                            {order ? `#${order.order_number || order.id.substring(0, 8).toUpperCase()}` : "-"}
                          </span>
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(staff)
                              }}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                              title="Edit Pegawai"
                            >
                              <IconEdit className="size-4" />
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(staff)
                              }}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-destructive hover:bg-destructive/10"
                              title="Hapus Pegawai"
                            >
                              <IconTrash className="size-4" />
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50 pt-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Tampilkan</span>
                      <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(parseInt(val))}>
                        <SelectTrigger className="h-8 w-[72px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>per halaman</span>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-3">
                        <p>
                          Halaman <span className="font-semibold text-foreground">{page}</span> dari{" "}
                          <span className="font-semibold text-foreground">{totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={page === 1}
                            onClick={() => setPage((p) => Math.max(p - 1, 1))}
                            className="size-8"
                          >
                            <IconChevronLeft className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                            className="size-8"
                          >
                            <IconChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {activeStaff && (
                    <>
                      <Separator className="my-6" />
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            <IconUserCircle className="size-4" /> Tugas Aktif: {activeStaff.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pesanan ditugaskan oleh kasir dari halaman Kasir &amp; Pembayaran.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveStaff(null)}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0 ml-4"
                        >
                          Tutup
                        </button>
                      </div>

                      <div className="flex-1 flex flex-col items-center">
                        {activeStaff.status !== "sibuk" || !activeOrder ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-sm w-full text-center py-16">
                            <IconBox className="size-14 text-muted-foreground/50" />
                            <div>
                              <p className="font-semibold text-lg">Belum ada tugas</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {activeStaff.name}, belum ada pesanan yang ditugaskan untuk Anda. Tunggu kasir menugaskan pesanan baru.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <PickingTask
                            order={activeOrder}
                            items={orderItems}
                            loading={loadingOrder}
                            checkedItems={checkedItems}
                            checkedCount={checkedCount}
                            isComplete={isPickingComplete}
                            onToggle={handleToggleItem}
                            onMarkReady={handleMarkReady}
                          />
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>

      {/* Add/Edit staff dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Pegawai" : "Tambah Pegawai Baru"}</DialogTitle>
            <DialogDescription>Masukkan data pegawai gudang.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staffName">Nama Pegawai</Label>
              <Input
                id="staffName"
                placeholder="Nama petugas..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={submitting}
                autoFocus
                required
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting && <IconLoader2 className="size-4 animate-spin mr-2" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

function PickingTask({
  order,
  items,
  loading,
  checkedItems,
  checkedCount,
  isComplete,
  onToggle,
  onMarkReady,
}: {
  order: Order | null
  items: OrderItem[]
  loading: boolean
  checkedItems: Record<string, boolean>
  checkedCount: number
  isComplete: boolean
  onToggle: (id: string) => void
  onMarkReady: () => void
}) {
  const total = items.length
  const progressPct = total > 0 ? (checkedCount / total) * 100 : 0

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
        <IconLoader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Memuat detail barang...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      {/* Order summary */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm font-bold">
            #{order?.order_number || order?.id.substring(0, 8).toUpperCase()}
          </span>
          <p className="text-sm text-muted-foreground">{order?.customer_name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            {checkedCount}/{total} item
          </p>
          <p className="text-xs text-muted-foreground">Target {order?.ewp} menit</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", isComplete ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
        {items.map((item) => {
          const isChecked = checkedItems[item.id] || false
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={cn(
                "flex items-center gap-4 px-4 py-4 text-left transition-colors",
                isChecked ? "bg-emerald-500/5" : "hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isChecked ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"
                )}
              >
                {isChecked && <IconCheck className="size-4 text-white" stroke={3} />}
              </span>
              <div className={cn("flex-1 min-w-0", isChecked && "text-muted-foreground line-through")}>
                <p className="font-medium truncate">{item.products?.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{item.products?.sku || "-"}</p>
              </div>
              <span className="font-bold text-sm shrink-0">{item.qty} pcs</span>
            </button>
          )
        })}
      </div>

      {/* Sticky action */}
      <div className="sticky bottom-6 mt-2">
        <Button
          onClick={onMarkReady}
          disabled={!isComplete}
          size="lg"
          className={cn(
            "w-full h-14 text-base font-bold shadow-lg",
            isComplete && "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
        >
          {isComplete ? "Selesai Packing & Tandai Siap" : `${total - checkedCount} item belum dicek`}
        </Button>
      </div>
    </div>
  )
}
