"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { IconLoader2, IconUsers, IconPlus, IconClipboardCheck, IconActivity, IconBox, IconHourglassHigh } from "@tabler/icons-react"

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

  // Register staff state
  const [newStaffName, setNewStaffName] = useState("")
  const [registering, setRegistering] = useState(false)

  // Current active order picking details
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  // Fetch list of staff members
  const fetchStaffList = async () => {
    try {
      setLoadingStaff(true)
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("name")
      if (error) throw error
      setStaffList(data || [])

      // If we have an active staff selected, refresh their state
      if (activeStaff) {
        const refreshed = data?.find((s) => s.id === activeStaff.id)
        if (refreshed) {
          setActiveStaff(refreshed)
        }
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

  // Load details if staff is busy and has an active order
  const fetchActiveOrderDetails = async (orderId: string) => {
    setLoadingOrder(true)
    try {
      // 1. Fetch order details
      const { data: ord, error: ordErr } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, ewp, total_items")
        .eq("id", orderId)
        .single()
      if (ordErr) throw ordErr
      setActiveOrder(ord)

      // 2. Fetch order items
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("*, products:product_id ( sku, name )")
        .eq("order_id", orderId)
      if (itemsErr) throw itemsErr

      setOrderItems(items || [])
      // Reset checklist
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

  // Register new staff
  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim()) return
    setRegistering(true)

    try {
      const { error } = await supabase
        .from("staff")
        .insert({ name: newStaffName, status: "idle" })
      if (error) throw error

      toast.success("Petugas baru berhasil didaftarkan!")
      setNewStaffName("")
      fetchStaffList()
    } catch (err: any) {
      toast.error("Gagal mendaftarkan petugas: " + err.message)
    } finally {
      setRegistering(false)
    }
  }

  // Dequeue / Pop next order
  const handleDequeueOrder = async () => {
    if (!activeStaff) return
    setLoadingOrder(true)

    try {
      // Dequeue next order from priority queue via pop_next_order RPC
      const { data: orderId, error } = await supabase.rpc("pop_next_order", {
        p_staff_id: activeStaff.id,
      })

      if (error) throw error

      if (orderId) {
        toast.success("Pesanan baru berhasil diambil!")
        // Refresh staff list and retrieve new active state
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

  // Toggle item checklist
  const handleToggleItem = (itemId: string, checked: boolean) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: checked,
    }))
  }

  // Check if all items in the checklist are marked
  const isPickingComplete =
    orderItems.length > 0 &&
    orderItems.every((item) => checkedItems[item.id] === true)

  // Mark picking as complete
  const handleMarkReady = async () => {
    if (!activeStaff || !activeOrder) return
    setLoadingOrder(true)

    try {
      // Complete picking & packing transaction via RPC function
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
        <div className="flex flex-1 flex-col p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Proses Gudang (Picking & Packing)</h1>
            <p className="text-muted-foreground mt-1">
              Antarmuka petugas gudang untuk mengambil pesanan dari antrian, melihat checklist rak barang, dan menandai siap diambil.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left: Staff list and register */}
            <div className="space-y-6 lg:col-span-1">
              <Card className="border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconUsers className="size-5 text-primary" /> Pilih Petugas Aktif
                  </CardTitle>
                  <CardDescription>Pilih nama Anda untuk memulai pemrosesan antrian.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingStaff ? (
                    <div className="flex items-center justify-center py-6">
                      <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : staffList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada petugas terdaftar.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {staffList.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => setActiveStaff(s)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center justify-between hover:bg-muted/30 ${
                            activeStaff?.id === s.id
                              ? "border-primary bg-primary/5 font-semibold text-primary"
                              : "border-border"
                          }`}
                        >
                          <span className="text-sm">{s.name}</span>
                          <Badge
                            className={`border-none ${
                              s.status === "sibuk"
                                ? "bg-amber-500 hover:bg-amber-600"
                                : "bg-emerald-500 hover:bg-emerald-600"
                            }`}
                          >
                            {s.status === "sibuk" ? "Bekerja" : "Siap"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleRegisterStaff} className="pt-4 border-t space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="staffName">Daftar Petugas Baru</Label>
                      <Input
                        id="staffName"
                        placeholder="Nama Petugas Gudang..."
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        disabled={registering}
                        required
                      />
                    </div>
                    <Button type="submit" variant="outline" className="w-full" disabled={registering}>
                      {registering ? (
                        <IconLoader2 className="size-4 animate-spin mr-2" />
                      ) : (
                        <IconPlus className="size-4 mr-2" />
                      )}
                      Daftar Petugas
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right: picking status and details */}
            <div className="lg:col-span-2 space-y-6">
              {!activeStaff ? (
                <Card className="border-border/50 shadow-md">
                  <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                    <IconActivity className="size-16 text-muted-foreground/40 mb-2 animate-pulse" />
                    <h3 className="font-semibold text-lg text-foreground">Pilih Petugas Terlebih Dahulu</h3>
                    <p className="text-sm max-w-sm mt-1">
                      Silakan pilih salah satu petugas aktif di sebelah kiri untuk melihat tugas picking atau memproses antrian.
                    </p>
                  </CardContent>
                </Card>
              ) : activeStaff.status === "idle" ? (
                <Card className="border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardCheck className="size-5 text-primary" /> Pengambilan Tugas Baru
                    </CardTitle>
                    <CardDescription>
                      Petugas <strong>{activeStaff.name}</strong> sedang dalam status SIAP. Ambil pesanan baru dari antrian.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <IconBox className="size-16 text-muted-foreground/60 mb-2" />
                    <Button onClick={handleDequeueOrder} disabled={loadingOrder} size="lg" className="w-full max-w-xs font-bold text-sm mt-2">
                      {loadingOrder ? (
                        <>
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                          Memproses Antrian...
                        </>
                      ) : (
                        "Ambil Pesanan Baru"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/50 shadow-md">
                  <CardHeader className="bg-amber-500/5 border-b border-amber-500/10 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-amber-700">
                          #{activeOrder?.order_number || activeOrder?.id.substring(0, 8).toUpperCase()}
                        </span>
                        <Badge className="bg-amber-500 text-white font-semibold">DIPROSES</Badge>
                      </div>
                      <CardDescription className="mt-1">
                        Pelanggan: <strong>{activeOrder?.customer_name}</strong> • Total: {activeOrder?.total_items} item
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <IconHourglassHigh className="size-4 animate-spin" />
                      <span>Target ECT: {activeOrder?.ewp} menit</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingOrder ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Memuat detail barang...</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px] text-center">Pilih</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nama Barang</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item) => {
                            const isChecked = checkedItems[item.id] || false
                            return (
                              <TableRow
                                key={item.id}
                                className={`transition-colors ${isChecked ? "bg-emerald-500/5 line-through text-muted-foreground" : "hover:bg-muted/30"}`}
                              >
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleToggleItem(item.id, !!checked)}
                                    className="size-4.5 rounded"
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs font-semibold">
                                  {item.products?.sku || "-"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {item.products?.name}
                                </TableCell>
                                <TableCell className="text-right font-bold text-sm">
                                  {item.qty} pcs
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/5">
                    <p className="text-xs text-muted-foreground">
                      * Pastikan semua barang telah dicek dan dimasukkan ke troli sebelum menekan tombol siap.
                    </p>
                    <Button
                      onClick={handleMarkReady}
                      disabled={!isPickingComplete || loadingOrder}
                      className={`w-full sm:w-auto font-bold text-xs ${isPickingComplete ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    >
                      <IconClipboardCheck className="size-4 mr-2" />
                      Selesai Packing & Tandai Siap
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
