"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  IconPackage,
  IconX,
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

type UnitProductRow = {
  key: string
  productId: string
  sku: string | null
  name: string
  category: string | null
  price: number
  usageType: "Dasar" | "Varian"
}

type Category = {
  id: string
  name: string
}

type VariantRow = {
  id: string | null
  unit_id: string
  multiplier: string
  price: string
}

type AssignProductRow = {
  id: string
  sku: string | null
  name: string
  unit_id: string | null
  is_multi_unit: boolean | null
  category: string | null
}

export default function SatuanPage() {
  const supabase = createClient()
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<Category[]>([])
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

  // "Lihat Produk" dialog: products using a given unit
  const [productsOpen, setProductsOpen] = useState(false)
  const [productsUnit, setProductsUnit] = useState<Unit | null>(null)
  const [unitProducts, setUnitProducts] = useState<UnitProductRow[]>([])
  const [loadingUnitProducts, setLoadingUnitProducts] = useState(false)

  // "Kelola Produk" edit dialog (in-place, no navigation)
  const [editProductOpen, setEditProductOpen] = useState(false)
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [loadingEditProduct, setLoadingEditProduct] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [epName, setEpName] = useState("")
  const [epSku, setEpSku] = useState("")
  const [epCategoryId, setEpCategoryId] = useState("")
  const [epPrice, setEpPrice] = useState("")
  const [epUnitId, setEpUnitId] = useState("")
  const [epIsMultiUnit, setEpIsMultiUnit] = useState(false)
  const [epVariantRows, setEpVariantRows] = useState<VariantRow[]>([])

  // "Assign Produk" tab: assign satuan dasar ke banyak produk
  const [assignProducts, setAssignProducts] = useState<AssignProductRow[]>([])
  const [loadingAssignProducts, setLoadingAssignProducts] = useState(true)
  const [assignSearch, setAssignSearch] = useState("")
  const [assigningId, setAssigningId] = useState<string | null>(null)

  type AssignSortKey = "sku" | "name" | "category" | "unit"
  const [assignSortKey, setAssignSortKey] = useState<AssignSortKey>("name")
  const [assignSortDir, setAssignSortDir] = useState<"asc" | "desc">("asc")
  const [assignPage, setAssignPage] = useState(1)
  const [assignItemsPerPage, setAssignItemsPerPage] = useState(10)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: unitData, error: unitErr } = await supabase
        .from("units")
        .select("id, name, created_at")
        .order("name")
      if (unitErr) throw unitErr
      setUnits(unitData || [])

      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

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

  const fetchAssignProducts = async () => {
    try {
      setLoadingAssignProducts(true)
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, unit_id, is_multi_unit, categories:category_id ( name )")
        .order("name")
      if (error) throw error
      setAssignProducts(
        (data || []).map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit_id: p.unit_id,
          is_multi_unit: p.is_multi_unit,
          category: p.categories?.name || null,
        }))
      )
    } catch (err: any) {
      toast.error("Gagal memuat data produk: " + err.message)
    } finally {
      setLoadingAssignProducts(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchAssignProducts()
  }, [])

  const handleAssignUnit = async (product: AssignProductRow, unitId: string) => {
    setAssigningId(product.id)
    try {
      const unitName = units.find((u) => u.id === unitId)?.name || null
      const { error } = await supabase
        .from("products")
        .update({ unit_id: unitId || null, unit: unitName })
        .eq("id", product.id)
      if (error) throw error

      setAssignProducts((rows) => rows.map((r) => (r.id === product.id ? { ...r, unit_id: unitId || null } : r)))
      toast.success(`Satuan produk "${product.name}" berhasil diperbarui!`)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal mengubah satuan produk: " + err.message)
    } finally {
      setAssigningId(null)
    }
  }

  const handleAssignSort = (key: AssignSortKey) => {
    if (assignSortKey === key) {
      setAssignSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setAssignSortKey(key)
      setAssignSortDir("asc")
    }
  }

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

  const handleViewProducts = async (unit: Unit) => {
    setProductsUnit(unit)
    setProductsOpen(true)
    setLoadingUnitProducts(true)
    setUnitProducts([])

    try {
      const [{ data: baseRows, error: baseErr }, { data: variantRows, error: variantErr }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, price, categories:category_id ( name )")
          .eq("unit_id", unit.id)
          .order("name"),
        supabase
          .from("product_units")
          .select("price, products:product_id ( id, sku, name, categories:category_id ( name ) )")
          .eq("unit_id", unit.id),
      ])
      if (baseErr) throw baseErr
      if (variantErr) throw variantErr

      const rows: UnitProductRow[] = []
      for (const p of baseRows || []) {
        rows.push({
          key: `base-${p.id}`,
          productId: p.id,
          sku: p.sku,
          name: p.name,
          category: (p.categories as any)?.name || null,
          price: p.price,
          usageType: "Dasar",
        })
      }
      for (const row of variantRows || []) {
        const p = row.products as any
        if (!p) continue
        rows.push({
          key: `variant-${p.id}-${row.price}`,
          productId: p.id,
          sku: p.sku,
          name: p.name,
          category: p.categories?.name || null,
          price: row.price,
          usageType: "Varian",
        })
      }

      setUnitProducts(rows)
    } catch (err: any) {
      toast.error("Gagal memuat produk untuk satuan ini: " + err.message)
    } finally {
      setLoadingUnitProducts(false)
    }
  }

  const handleOpenEditProduct = async (productId: string) => {
    setEditProductId(productId)
    setEditProductOpen(true)
    setLoadingEditProduct(true)
    setEpVariantRows([])

    try {
      const { data: product, error: prodErr } = await supabase
        .from("products")
        .select("id, sku, name, category_id, price, unit_id, is_multi_unit")
        .eq("id", productId)
        .single()
      if (prodErr) throw prodErr

      setEpName(product.name)
      setEpSku(product.sku || "")
      setEpCategoryId(product.category_id || "")
      setEpPrice(product.price.toString())
      setEpUnitId(product.unit_id || "")
      setEpIsMultiUnit(!!product.is_multi_unit)

      if (product.is_multi_unit) {
        const { data: variantData, error: variantErr } = await supabase
          .from("product_units")
          .select("id, unit_id, multiplier, price")
          .eq("product_id", productId)
          .order("multiplier")
        if (variantErr) throw variantErr
        setEpVariantRows(
          (variantData || []).map((row) => ({
            id: row.id,
            unit_id: row.unit_id || "",
            multiplier: row.multiplier?.toString() || "",
            price: row.price?.toString() || "",
          }))
        )
      }
    } catch (err: any) {
      toast.error("Gagal memuat data produk: " + err.message)
      setEditProductOpen(false)
    } finally {
      setLoadingEditProduct(false)
    }
  }

  const addEpVariantRow = () => {
    setEpVariantRows((rows) => [...rows, { id: null, unit_id: "", multiplier: "1", price: "" }])
  }

  const updateEpVariantRow = (index: number, field: keyof VariantRow, value: string) => {
    setEpVariantRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const removeEpVariantRow = (index: number) => {
    setEpVariantRows((rows) => rows.filter((_, i) => i !== index))
  }

  const handleSaveProduct = async () => {
    if (!editProductId) return
    if (!epName.trim() || !epPrice) {
      toast.error("Nama dan harga produk wajib diisi.")
      return
    }
    setSavingProduct(true)

    try {
      const { error: updateErr } = await supabase
        .from("products")
        .update({
          name: epName.trim(),
          category_id: epCategoryId || null,
          price: parseFloat(epPrice) || 0,
          unit_id: epUnitId || null,
          is_multi_unit: epIsMultiUnit,
        })
        .eq("id", editProductId)
      if (updateErr) throw updateErr

      const { error: deleteErr } = await supabase
        .from("product_units")
        .delete()
        .eq("product_id", editProductId)
      if (deleteErr) throw deleteErr

      if (epIsMultiUnit) {
        const validRows = epVariantRows.filter((row) => row.unit_id && row.price)
        if (validRows.length > 0) {
          const rowsPayload = validRows.map((row) => ({
            product_id: editProductId,
            unit_id: row.unit_id,
            unit_name: units.find((u) => u.id === row.unit_id)?.name || "",
            multiplier: parseFloat(row.multiplier) || 1,
            price: parseFloat(row.price),
          }))
          const { error: insertErr } = await supabase.from("product_units").insert(rowsPayload)
          if (insertErr) throw insertErr
        }
      }

      toast.success(`Produk "${epName.trim()}" berhasil diperbarui!`)
      setEditProductOpen(false)
      fetchData()
      fetchAssignProducts()
      if (productsUnit) handleViewProducts(productsUnit)
    } catch (err: any) {
      toast.error("Gagal menyimpan produk: " + err.message)
    } finally {
      setSavingProduct(false)
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

  const filteredAssignProducts = assignProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(assignSearch.toLowerCase()))
  )

  const sortedAssignProducts = [...filteredAssignProducts].sort((a, b) => {
    let valA: string
    let valB: string
    switch (assignSortKey) {
      case "sku":
        valA = a.sku || ""
        valB = b.sku || ""
        break
      case "category":
        valA = a.category || ""
        valB = b.category || ""
        break
      case "unit":
        valA = units.find((u) => u.id === a.unit_id)?.name || ""
        valB = units.find((u) => u.id === b.unit_id)?.name || ""
        break
      default:
        valA = a.name
        valB = b.name
    }
    return assignSortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
  })

  const assignTotalPages = Math.ceil(sortedAssignProducts.length / assignItemsPerPage)
  const paginatedAssignProducts = sortedAssignProducts.slice(
    (assignPage - 1) * assignItemsPerPage,
    assignPage * assignItemsPerPage
  )

  useEffect(() => {
    setAssignPage(1)
  }, [assignSearch, assignItemsPerPage, assignSortKey, assignSortDir])

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
                Kelola daftar satuan dasar (pcs, kg, dus, dll) dan assign satuan dasar ke produk.
              </p>
            </div>
          </div>

          <Tabs defaultValue="kelola" className="w-full">
            <TabsList>
              <TabsTrigger value="kelola">Kelola Satuan</TabsTrigger>
              <TabsTrigger value="assign">Assign Produk</TabsTrigger>
            </TabsList>

            <TabsContent value="kelola" className="mt-4">
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
                          <TableHead className="w-[160px] text-center">Aksi</TableHead>
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
                                  onClick={() => handleViewProducts(unit)}
                                  className="size-8"
                                  title="Lihat Produk"
                                >
                                  <IconPackage className="size-4" />
                                </Button>
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
            </TabsContent>

            <TabsContent value="assign" className="mt-4">
              <Card className="border-border/50 shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Assign Satuan ke Produk</CardTitle>
                      <CardDescription>
                        Ubah satuan dasar produk secara langsung. Menampilkan {filteredAssignProducts.length} produk.
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari SKU atau Nama Produk..."
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        className="pl-9 bg-background"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingAssignProducts ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-muted-foreground text-sm">Memuat data produk...</p>
                    </div>
                  ) : filteredAssignProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                      <IconPackage className="size-12 text-muted-foreground/60 mb-2" />
                      <h3 className="font-semibold text-lg">Tidak Ada Produk</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mt-1">
                        Sesuaikan pencarian untuk melihat data produk.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                <button type="button" onClick={() => handleAssignSort("sku")} className="flex items-center gap-1 hover:text-foreground">
                                  SKU <SortIcon active={assignSortKey === "sku"} dir={assignSortDir} />
                                </button>
                              </TableHead>
                              <TableHead>
                                <button type="button" onClick={() => handleAssignSort("name")} className="flex items-center gap-1 hover:text-foreground">
                                  Nama Produk <SortIcon active={assignSortKey === "name"} dir={assignSortDir} />
                                </button>
                              </TableHead>
                              <TableHead>
                                <button type="button" onClick={() => handleAssignSort("category")} className="flex items-center gap-1 hover:text-foreground">
                                  Kategori <SortIcon active={assignSortKey === "category"} dir={assignSortDir} />
                                </button>
                              </TableHead>
                              <TableHead className="w-[220px]">
                                <button type="button" onClick={() => handleAssignSort("unit")} className="flex items-center gap-1 hover:text-foreground">
                                  Satuan Dasar <SortIcon active={assignSortKey === "unit"} dir={assignSortDir} />
                                </button>
                              </TableHead>
                              <TableHead className="w-[100px] text-center">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedAssignProducts.map((product) => (
                              <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-mono text-xs font-semibold">
                                  {product.sku || "-"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {product.name}
                                  {product.is_multi_unit && (
                                    <span className="ml-2 inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-700/10 dark:bg-sky-400/10 dark:text-sky-400 dark:ring-sky-400/20">
                                      Multi-Unit
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>{product.category || "-"}</TableCell>
                                <TableCell>
                                  <Select
                                    value={product.unit_id || ""}
                                    onValueChange={(val) => handleAssignUnit(product, val)}
                                    disabled={assigningId === product.id}
                                  >
                                    <SelectTrigger className="h-8 w-full">
                                      <SelectValue placeholder="Pilih Satuan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {units.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                          {u.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEditProduct(product.id)}
                                    className="h-8 px-2 text-xs font-semibold"
                                    title="Kelola Produk"
                                  >
                                    <IconEdit className="size-3.5 mr-1" /> Kelola
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50 pt-4 mt-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>Tampilkan</span>
                          <Select value={assignItemsPerPage.toString()} onValueChange={(val) => setAssignItemsPerPage(parseInt(val))}>
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

                        {assignTotalPages > 1 && (
                          <div className="flex items-center gap-3">
                            <p>
                              Halaman <span className="font-semibold text-foreground">{assignPage}</span> dari{" "}
                              <span className="font-semibold text-foreground">{assignTotalPages}</span>
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                disabled={assignPage === 1}
                                onClick={() => setAssignPage((p) => Math.max(p - 1, 1))}
                                className="size-8"
                              >
                                <IconChevronLeft className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                disabled={assignPage === assignTotalPages}
                                onClick={() => setAssignPage((p) => Math.min(p + 1, assignTotalPages))}
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
            </TabsContent>
          </Tabs>
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

        {/* Lihat/Kelola Produk dalam satuan ini */}
        <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Produk dengan Satuan: {productsUnit?.name}</DialogTitle>
              <DialogDescription>
                Daftar produk yang menggunakan satuan ini, baik sebagai satuan dasar maupun varian multi-satuan.
              </DialogDescription>
            </DialogHeader>

            {loadingUnitProducts ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : unitProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-muted rounded-lg">
                <IconPackage className="size-10 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground max-w-xs">
                  Belum ada produk yang menggunakan satuan ini.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
                {unitProducts.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{row.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            row.usageType === "Dasar"
                              ? "border-primary/30 text-primary bg-primary/5 text-[10px]"
                              : "border-sky-500/30 text-sky-700 dark:text-sky-400 bg-sky-500/5 text-[10px]"
                          }
                        >
                          {row.usageType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.sku || "-"} {row.category && <>&middot; {row.category}</>} &middot; Rp{" "}
                        {row.price.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs shrink-0"
                      onClick={() => handleOpenEditProduct(row.productId)}
                    >
                      <IconEdit className="size-3.5 mr-1" /> Kelola
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setProductsOpen(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Kelola Produk (edit langsung tanpa pindah halaman) */}
        <Dialog open={editProductOpen} onOpenChange={setEditProductOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kelola Produk: {epName || "..."}</DialogTitle>
              <DialogDescription>
                Ubah data produk dan satuan/varian yang digunakan langsung dari sini.
              </DialogDescription>
            </DialogHeader>

            {loadingEditProduct ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>SKU</Label>
                    <Input value={epSku} disabled className="bg-muted/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="epPrice">Harga (IDR)</Label>
                    <Input
                      id="epPrice"
                      type="number"
                      value={epPrice}
                      onChange={(e) => setEpPrice(e.target.value)}
                      disabled={savingProduct}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="epName">Nama Produk</Label>
                  <Input
                    id="epName"
                    value={epName}
                    onChange={(e) => setEpName(e.target.value)}
                    disabled={savingProduct}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Kategori</Label>
                    <Select value={epCategoryId} onValueChange={setEpCategoryId} disabled={savingProduct}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih Kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Satuan Dasar</Label>
                    <Select value={epUnitId} onValueChange={setEpUnitId} disabled={savingProduct}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih Satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id="epIsMultiUnit"
                    checked={epIsMultiUnit}
                    onCheckedChange={(checked) => setEpIsMultiUnit(!!checked)}
                    disabled={savingProduct}
                  />
                  <Label htmlFor="epIsMultiUnit" className="text-sm font-medium leading-none">
                    Produk ini punya lebih dari satu satuan (multi-satuan)
                  </Label>
                </div>

                {epIsMultiUnit && (
                  <div className="space-y-3 rounded-md border border-border p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Daftar Varian Satuan</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addEpVariantRow}
                        disabled={savingProduct}
                        className="h-7 text-xs"
                      >
                        <IconPlus className="size-3.5 mr-1" /> Tambah Varian
                      </Button>
                    </div>

                    {epVariantRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Belum ada varian satuan. Klik "Tambah Varian" untuk menambahkan (mis. Pack, Dus).
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {epVariantRows.map((row, index) => (
                          <div key={index} className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs text-muted-foreground">Satuan</Label>
                              <Select
                                value={row.unit_id}
                                onValueChange={(val) => updateEpVariantRow(index, "unit_id", val)}
                                disabled={savingProduct}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Pilih" />
                                </SelectTrigger>
                                <SelectContent>
                                  {units.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-20 space-y-1">
                              <Label className="text-xs text-muted-foreground">Isi (x)</Label>
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                value={row.multiplier}
                                onChange={(e) => updateEpVariantRow(index, "multiplier", e.target.value)}
                                disabled={savingProduct}
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs text-muted-foreground">Harga (IDR)</Label>
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                value={row.price}
                                onChange={(e) => updateEpVariantRow(index, "price", e.target.value)}
                                disabled={savingProduct}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8 shrink-0 text-destructive hover:bg-destructive/10"
                              onClick={() => removeEpVariantRow(index)}
                              disabled={savingProduct}
                            >
                              <IconX className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditProductOpen(false)}
                disabled={savingProduct}
              >
                Batal
              </Button>
              <Button type="button" onClick={handleSaveProduct} disabled={savingProduct || loadingEditProduct}>
                {savingProduct ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
