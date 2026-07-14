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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconRuler2,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
  return dir === "asc" ? (
    <IconSortAscending className="size-3.5 text-foreground" />
  ) : (
    <IconSortDescending className="size-3.5 text-foreground" />
  )
}

type Unit = {
  id: string
  name: string
  created_at: string
}

export default function SatuanPage() {
  const supabase = createClient()
  const [units, setUnits] = useState<Unit[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState("")

  // Units table: sorting + pagination
  type UnitSortKey = "name" | "usage"
  const [unitSortKey, setUnitSortKey] = useState<UnitSortKey>("name")
  const [unitSortDir, setUnitSortDir] = useState<"asc" | "desc">("asc")
  const [unitPage, setUnitPage] = useState(1)
  const [unitItemsPerPage, setUnitItemsPerPage] = useState(10)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: unitData, error: unitErr } = await supabase
        .from("units")
        .select("id, name, created_at")
        .order("name")
      if (unitErr) throw unitErr
      setUnits(unitData || [])

      const [{ data: productRows }, { data: productUnitRows }] = await Promise.all([
        supabase.from("products").select("unit_id").not("unit_id", "is", null),
        supabase.from("product_units").select("unit_id").not("unit_id", "is", null),
      ])

      const counts: Record<string, number> = {}
      for (const row of productRows || []) {
        if (row.unit_id) counts[row.unit_id] = (counts[row.unit_id] || 0) + 1
      }
      for (const row of productUnitRows || []) {
        if (row.unit_id) counts[row.unit_id] = (counts[row.unit_id] || 0) + 1
      }
      setUsageCounts(counts)
    } catch (err: any) {
      toast.error("Gagal memuat data: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAdd = () => {
    setEditId(null)
    setName("")
    setOpen(true)
  }

  const handleEdit = (unit: Unit) => {
    setEditId(unit.id)
    setName(unit.name)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const payload = { name: name.trim() }

      if (editId) {
        const { error } = await supabase
          .from("units")
          .update(payload)
          .eq("id", editId)
        if (error) throw error
        toast.success("Satuan berhasil diperbarui!")
      } else {
        const { error } = await supabase
          .from("units")
          .insert(payload)
        if (error) throw error
        toast.success("Satuan berhasil ditambahkan!")
      }

      setOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menyimpan satuan: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (unit: Unit) => {
    if (usageCounts[unit.id]) {
      toast.error(`Satuan "${unit.name}" masih dipakai oleh ${usageCounts[unit.id]} produk dan tidak bisa dihapus.`)
      return
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus satuan "${unit.name}"?`)) return

    try {
      const { error } = await supabase
        .from("units")
        .delete()
        .eq("id", unit.id)
      if (error) throw error
      toast.success("Satuan berhasil dihapus!")
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menghapus satuan: " + err.message)
    }
  }

  const handleUnitSort = (key: UnitSortKey) => {
    if (unitSortKey === key) {
      setUnitSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setUnitSortKey(key)
      setUnitSortDir("asc")
    }
  }

  const filteredUnits = units.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const sortedUnits = [...filteredUnits].sort((a, b) => {
    const valA = unitSortKey === "name" ? a.name : usageCounts[a.id] || 0
    const valB = unitSortKey === "name" ? b.name : usageCounts[b.id] || 0
    if (typeof valA === "number" && typeof valB === "number") {
      return unitSortDir === "asc" ? valA - valB : valB - valA
    }
    return unitSortDir === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  const unitTotalPages = Math.ceil(sortedUnits.length / unitItemsPerPage)
  const paginatedUnits = sortedUnits.slice(
    (unitPage - 1) * unitItemsPerPage,
    unitPage * unitItemsPerPage
  )

  useEffect(() => {
    setUnitPage(1)
  }, [search, unitItemsPerPage, unitSortKey, unitSortDir])

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kelola Satuan</h1>
              <p className="text-muted-foreground mt-1">
                Kelola daftar satuan dasar (pcs, kg, dus, dll). Untuk menghubungkan satuan atau varian multi-satuan ke produk, gunakan halaman Kelola Produk dan Stok.
              </p>
            </div>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Satuan</CardTitle>
                  <CardDescription>
                    Menampilkan total {filteredUnits.length} satuan terdaftar
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama satuan..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  <Button onClick={handleAdd} className="w-full sm:w-auto">
                    <IconPlus className="size-4 mr-2" /> Tambah Satuan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat data satuan...</p>
                </div>
              ) : filteredUnits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                  <IconRuler2 className="size-12 text-muted-foreground/60 mb-2" />
                  <h3 className="font-semibold text-lg">Tidak Ada Satuan</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Silakan tambahkan satuan baru atau sesuaikan pencarian untuk melihat data.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <button type="button" onClick={() => handleUnitSort("name")} className="flex items-center gap-1 hover:text-foreground">
                              Nama Satuan <SortIcon active={unitSortKey === "name"} dir={unitSortDir} />
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button type="button" onClick={() => handleUnitSort("usage")} className="flex items-center gap-1 ml-auto hover:text-foreground">
                              Jumlah Produk Terpakai <SortIcon active={unitSortKey === "usage"} dir={unitSortDir} />
                            </button>
                          </TableHead>
                          <TableHead className="w-[120px] text-center">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUnits.map((unit) => (
                          <TableRow key={unit.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium">{unit.name}</TableCell>
                            <TableCell className="text-right">{usageCounts[unit.id] || 0}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEdit(unit)}
                                  className="size-8"
                                  title="Edit Satuan"
                                >
                                  <IconEdit className="size-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(unit)}
                                  className="size-8 text-destructive hover:bg-destructive/10"
                                  title="Hapus Satuan"
                                >
                                  <IconTrash className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50 pt-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Tampilkan</span>
                      <Select value={unitItemsPerPage.toString()} onValueChange={(val) => setUnitItemsPerPage(parseInt(val))}>
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

                    {unitTotalPages > 1 && (
                      <div className="flex items-center gap-3">
                        <p>
                          Halaman <span className="font-semibold text-foreground">{unitPage}</span> dari{" "}
                          <span className="font-semibold text-foreground">{unitTotalPages}</span>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={unitPage === 1}
                            onClick={() => setUnitPage((p) => Math.max(p - 1, 1))}
                            className="size-8"
                          >
                            <IconChevronLeft className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={unitPage === unitTotalPages}
                            onClick={() => setUnitPage((p) => Math.min(p + 1, unitTotalPages))}
                            className="size-8"
                          >
                            <IconChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Satuan" : "Tambah Satuan Baru"}</DialogTitle>
              <DialogDescription>
                Masukkan nama satuan (contoh: pcs, kg, dus).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Satuan</Label>
                <Input
                  id="name"
                  placeholder="pcs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
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
      </SidebarInset>
    </SidebarProvider>
  )
}
