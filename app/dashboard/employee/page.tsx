"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  IconChevronRight,
  IconUserCircle,
} from "@tabler/icons-react"

type Staff = {
  id: string
  name: string
  status: "idle" | "sibuk" | null
  current_order_id: string | null
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

export default function PickingPage() {
  const supabase = createClient()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null)

  // Register staff dialog
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [newStaffName, setNewStaffName] = useState("")
  const [registering, setRegistering] = useState(false)

  // Current active order picking details
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const fetchStaffList = async () => {
    try {
      setLoadingStaff(true)
      const { data, error } = await supabase.from("staff").select("*").order("name")
      if (error) throw error
      setStaffList(data || [])

      if (activeStaff) {
        const refreshed = data?.find((s) => s.id === activeStaff.id)
        if (refreshed) setActiveStaff(refreshed)
      }
    } catch (err: any) {
      toast.error("Gagal memuat petugas: " + err.message)
    } finally {
      setLoadingStaff(false)
    }
  }

  useEffect(() => {
    fetchStaffList()
  }, [])

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

  useEffect(() => {
    if (activeStaff?.status === "sibuk" && activeStaff.current_order_id) {
      fetchActiveOrderDetails(activeStaff.current_order_id)
    } else {
      setActiveOrder(null)
      setOrderItems([])
      setCheckedItems({})
    }
  }, [activeStaff])

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim()) return
    setRegistering(true)

    try {
      const { error } = await supabase.from("staff").insert({ name: newStaffName, status: "idle" })
      if (error) throw error

      toast.success("Petugas baru berhasil didaftarkan!")
      setNewStaffName("")
      setAddStaffOpen(false)
      fetchStaffList()
    } catch (err: any) {
      toast.error("Gagal mendaftarkan petugas: " + err.message)
    } finally {
      setRegistering(false)
    }
  }

  const handleDequeueOrder = async () => {
    if (!activeStaff) return
    setLoadingOrder(true)

    try {
      const { data: orderId, error } = await supabase.rpc("pop_next_order", {
        p_staff_id: activeStaff.id,
      })
      if (error) throw error

      if (orderId) {
        toast.success("Pesanan baru berhasil diambil!")
        await fetchStaffList()
      } else {
        toast.info("Tidak ada pesanan antrian baru saat ini.")
      }
    } catch (err: any) {
      toast.error("Gagal mengambil pesanan: " + err.message)
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
      const { error } = await supabase.rpc("complete_picking_packing", {
        p_order_id: activeOrder.id,
        p_staff_id: activeStaff.id,
      })
      if (error) throw error

      toast.success("Pesanan selesai di-packing dan ditandai SIAP!")
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
        <div className="flex flex-1 flex-col">
          {/* Top bar: current staff + switch */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
            <h1 className="text-lg font-semibold">Picking & Packing</h1>
            {activeStaff && (
              <button
                onClick={() => setActiveStaff(null)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconUserCircle className="size-4" />
                <span className="font-medium">{activeStaff.name}</span>
                <span className="text-xs underline underline-offset-2">Ganti</span>
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center p-6">
            {!activeStaff ? (
              <StaffPicker
                staffList={staffList}
                loading={loadingStaff}
                onSelect={setActiveStaff}
                onAddClick={() => setAddStaffOpen(true)}
              />
            ) : activeStaff.status === "idle" ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-sm w-full text-center py-16">
                <IconBox className="size-14 text-muted-foreground/50" />
                <div>
                  <p className="font-semibold text-lg">Siap mengambil pesanan</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeStaff.name}, tekan tombol di bawah untuk mengambil pesanan berikutnya dari antrian.
                  </p>
                </div>
                <Button
                  onClick={handleDequeueOrder}
                  disabled={loadingOrder}
                  size="lg"
                  className="w-full h-14 text-base font-bold mt-2"
                >
                  {loadingOrder ? (
                    <IconLoader2 className="size-5 animate-spin mr-2" />
                  ) : (
                    <IconChevronRight className="size-5 mr-2" />
                  )}
                  Ambil Pesanan Baru
                </Button>
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
        </div>
      </SidebarInset>

      {/* Add staff dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daftar Petugas Baru</DialogTitle>
            <DialogDescription>Tambahkan nama petugas gudang baru ke daftar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterStaff} className="space-y-4">
            <Input
              placeholder="Nama petugas..."
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              disabled={registering}
              autoFocus
              required
            />
            <DialogFooter>
              <Button type="submit" disabled={registering} className="w-full sm:w-auto">
                {registering && <IconLoader2 className="size-4 animate-spin mr-2" />}
                Daftar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

function StaffPicker({
  staffList,
  loading,
  onSelect,
  onAddClick,
}: {
  staffList: Staff[]
  loading: boolean
  onSelect: (s: Staff) => void
  onAddClick: () => void
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <IconLoader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl py-8">
      <p className="text-center text-sm text-muted-foreground mb-6">Pilih nama Anda untuk mulai bekerja</p>

      {staffList.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Belum ada petugas terdaftar.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {staffList.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="relative flex flex-col items-center gap-2 rounded-xl border border-border p-5 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <span
                className={cn(
                  "absolute top-3 right-3 size-2 rounded-full",
                  s.status === "sibuk" ? "bg-amber-500" : "bg-emerald-500"
                )}
              />
              <IconUserCircle className="size-8 text-muted-foreground" />
              <span className="font-medium text-sm text-center">{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {s.status === "sibuk" ? "Sedang bekerja" : "Siap"}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onAddClick}
        className="mt-6 mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <IconPlus className="size-4" />
        Tambah petugas baru
      </button>
    </div>
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
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isComplete ? "bg-emerald-500" : "bg-primary"
          )}
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
