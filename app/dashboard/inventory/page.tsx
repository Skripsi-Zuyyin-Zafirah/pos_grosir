"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconSearch, IconAdjustmentsHorizontal, IconAlertTriangle, IconCheck, IconHistory } from "@tabler/icons-react"

type InventoryItem = {
  product_id: string
  stock_qty: number
  location: string | null
  reorder_level: number
  updated_at: string
  products: {
    sku: string | null
    name: string
    unit: string | null
  } | null
}

type StockMovement = {
  id: string
  change_qty: number
  reason: string
  created_at: string
  products?: {
    name: string
  } | null
}

export default function InventoryPage() {
  const supabase = createClient()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modals state
  const [editOpen, setEditOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Selected item and form fields
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [location, setLocation] = useState("")
  const [reorderLevel, setReorderLevel] = useState("")
  const [adjustQty, setAdjustQty] = useState("")
  const [adjustReason, setAdjustReason] = useState("")
  const [history, setHistory] = useState<StockMovement[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("inventory")
        .select("*, products:product_id ( sku, name, unit )")
      if (error) throw error
      setInventory(data || [])
    } catch (err: any) {
      toast.error("Gagal memuat inventori: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Open edit modal
  const handleEditOpen = (item: InventoryItem) => {
    setSelectedItem(item)
    setLocation(item.location || "")
    setReorderLevel(item.reorder_level.toString())
    setEditOpen(true)
  }

  // Open adjust modal
  const handleAdjustOpen = (item: InventoryItem) => {
    setSelectedItem(item)
    setAdjustQty("")
    setAdjustReason("Restock")
    setAdjustOpen(true)
  }

  // Open history modal
  const handleHistoryOpen = async (item: InventoryItem) => {
    setSelectedItem(item)
    setHistoryOpen(true)
    setHistoryLoading(true)

    try {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", item.product_id)
        .order("created_at", { ascending: false })
      if (error) throw error
      setHistory(data || [])
    } catch (err: any) {
      toast.error("Gagal memuat riwayat: " + err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Submit edit (location and reorder level)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from("inventory")
        .update({
          location: location || null,
          reorder_level: parseInt(reorderLevel),
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", selectedItem.product_id)

      if (error) throw error
      toast.success("Pengaturan inventori diperbarui!")
      setEditOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal memperbarui: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Submit adjustment (add/subtract stock)
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    setSubmitting(true)

    const qtyChange = parseInt(adjustQty)
    if (isNaN(qtyChange) || qtyChange === 0) {
      toast.error("Jumlah perubahan harus valid dan bukan nol")
      setSubmitting(false)
      return
    }

    try {
      const newQty = selectedItem.stock_qty + qtyChange

      if (newQty < 0) {
        toast.error("Stok akhir tidak boleh kurang dari 0")
        setSubmitting(false)
        return
      }

      // 1. Insert stock movement log
      const { error: moveErr } = await supabase
        .from("stock_movements")
        .insert({
          product_id: selectedItem.product_id,
          change_qty: qtyChange,
          reason: adjustReason,
        })
      if (moveErr) throw moveErr

      // 2. Update stock qty in inventory
      const { error: invErr } = await supabase
        .from("inventory")
        .update({
          stock_qty: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", selectedItem.product_id)
      if (invErr) throw invErr

      toast.success("Stok berhasil disesuaikan!")
      setAdjustOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menyesuaikan stok: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter list
  const filteredInventory = inventory.filter(
    (item) =>
      item.products?.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.products?.sku && item.products.sku.toLowerCase().includes(search.toLowerCase()))
  )

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
            <h1 className="text-3xl font-bold tracking-tight">Kelola Stok & Inventori</h1>
            <p className="text-muted-foreground mt-1">
              Pantau tingkat ketersediaan stok, kelola lokasi penyimpanan rak, dan lakukan penyesuaian stok.
            </p>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Inventori Produk</CardTitle>
                  <CardDescription>
                    Total {filteredInventory.length} produk terdaftar dalam log stok
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari SKU atau Nama Produk..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat data inventori...</p>
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                  <IconAlertTriangle className="size-12 text-muted-foreground/60 mb-2" />
                  <h3 className="font-semibold text-lg">Inventori Kosong</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Silakan tambahkan produk baru di halaman Produk untuk menginisiasi inventori.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead>Lokasi Rak</TableHead>
                        <TableHead className="text-right">Stok Saat Ini</TableHead>
                        <TableHead className="text-right">Min. Stok (Reorder)</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[180px] text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((item) => {
                        const isLowStock = item.stock_qty <= item.reorder_level
                        return (
                          <TableRow key={item.product_id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-xs font-semibold">
                              {item.products?.sku || "-"}
                            </TableCell>
                            <TableCell className="font-medium">{item.products?.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-semibold px-2 py-0.5">
                                {item.location || "Belum diatur"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-base">
                              {item.stock_qty} <span className="text-xs font-normal text-muted-foreground">{item.products?.unit || "pcs"}</span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.reorder_level} {item.products?.unit || "pcs"}
                            </TableCell>
                            <TableCell className="text-center">
                              {isLowStock ? (
                                <Badge className="bg-amber-500 hover:bg-amber-600 border-none flex items-center justify-center w-24 mx-auto gap-1">
                                  <IconAlertTriangle className="size-3" /> Stok Rendah
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none flex items-center justify-center w-24 mx-auto gap-1">
                                  <IconCheck className="size-3" /> Aman
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAdjustOpen(item)}
                                  className="h-8 text-xs"
                                >
                                  <IconAdjustmentsHorizontal className="size-3.5 mr-1" /> Stok
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditOpen(item)}
                                  className="h-8 text-xs"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleHistoryOpen(item)}
                                  className="h-8 w-8"
                                >
                                  <IconHistory className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Location & Reorder Level Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Pengaturan Inventori</DialogTitle>
              <DialogDescription>
                Sesuaikan lokasi rak penyimpanan dan batas minimum stok untuk {selectedItem?.products?.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Lokasi Rak</Label>
                <Input
                  id="location"
                  placeholder="Contoh: A1, B4, C12"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderLevel">Batas Minimum Stok (Alert)</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  placeholder="5"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Qty Dialog */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Penyesuaian Stok</DialogTitle>
              <DialogDescription>
                Tambah (+) atau kurangi (-) stok fisik untuk {selectedItem?.products?.name}. Stok saat ini: {selectedItem?.stock_qty} {selectedItem?.products?.unit}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjustQty">Jumlah Perubahan Stok</Label>
                <Input
                  id="adjustQty"
                  type="number"
                  placeholder="Gunakan +10 untuk restock, -5 untuk kerusakan"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustReason">Alasan Perubahan</Label>
                <Input
                  id="adjustReason"
                  placeholder="Restock / Barang Rusak / Penyesuaian Manual"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustOpen(false)}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Sesuaikan"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Stock Movement History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Riwayat Pergerakan Stok</DialogTitle>
              <DialogDescription>
                Audit log perubahan kuantitas untuk {selectedItem?.products?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-4 pr-1">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Memuat riwayat...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Tidak ada catatan pergerakan stok untuk produk ini.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Perubahan</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className={`font-bold ${h.change_qty > 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {h.change_qty > 0 ? `+${h.change_qty}` : h.change_qty}
                        </TableCell>
                        <TableCell className="text-sm">{h.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setHistoryOpen(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
