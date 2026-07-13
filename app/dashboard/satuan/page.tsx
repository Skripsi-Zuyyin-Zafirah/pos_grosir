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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconRuler2,
  IconPackage,
  IconLayersLinked,
  IconX,
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

type ProductAssignRow = {
  id: string
  name: string
  sku: string | null
  unit_id: string | null
  is_multi_unit: boolean | null
  categories?: { name: string } | null
}

type ProductUnitRow = {
  id: string | null
  unit_id: string
  multiplier: string
  price: string
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

  // Assign-to-product tab state
  const [products, setProducts] = useState<ProductAssignRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productSearch, setProductSearch] = useState("")
  const [assigningId, setAssigningId] = useState<string | null>(null)

  // Products (assign) table: sorting + pagination
  type ProductSortKey = "sku" | "name" | "category" | "unit"
  const [productSortKey, setProductSortKey] = useState<ProductSortKey>("name")
  const [productSortDir, setProductSortDir] = useState<"asc" | "desc">("asc")
  const [productPage, setProductPage] = useState(1)
  const [productItemsPerPage, setProductItemsPerPage] = useState(10)

  // Variant (multi-unit) management dialog state
  const [variantOpen, setVariantOpen] = useState(false)
  const [variantProduct, setVariantProduct] = useState<ProductAssignRow | null>(null)
  const [variantIsMulti, setVariantIsMulti] = useState(false)
  const [variantRows, setVariantRows] = useState<ProductUnitRow[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [savingVariants, setSavingVariants] = useState(false)

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

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, unit_id, is_multi_unit, categories:category_id ( name )")
        .order("name")
      if (error) throw error
      setProducts((data as unknown as ProductAssignRow[]) || [])
    } catch (err: any) {
      toast.error("Gagal memuat data produk: " + err.message)
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchProducts()
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

  // Assign a unit to a product directly from this screen
  const handleAssignUnit = async (product: ProductAssignRow, unitId: string) => {
    setAssigningId(product.id)
    try {
      const unitName = units.find((u) => u.id === unitId)?.name || null
      const { error } = await supabase
        .from("products")
        .update({ unit_id: unitId || null, unit: unitName })
        .eq("id", product.id)
      if (error) throw error

      setProducts((rows) =>
        rows.map((r) => (r.id === product.id ? { ...r, unit_id: unitId || null } : r))
      )
      toast.success(`Satuan produk "${product.name}" berhasil diperbarui!`)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal mengubah satuan produk: " + err.message)
    } finally {
      setAssigningId(null)
    }
  }

  // Open the multi-unit variant management dialog for a product
  const handleOpenVariants = async (product: ProductAssignRow) => {
    setVariantProduct(product)
    setVariantIsMulti(!!product.is_multi_unit)
    setVariantRows([])
    setVariantOpen(true)
    setLoadingVariants(true)
    try {
      const { data, error } = await supabase
        .from("product_units")
        .select("id, unit_id, multiplier, price")
        .eq("product_id", product.id)
        .order("multiplier")
      if (error) throw error
      setVariantRows(
        (data || []).map((row) => ({
          id: row.id,
          unit_id: row.unit_id || "",
          multiplier: row.multiplier?.toString() || "",
          price: row.price?.toString() || "",
        }))
      )
    } catch (err: any) {
      toast.error("Gagal memuat varian satuan: " + err.message)
    } finally {
      setLoadingVariants(false)
    }
  }

  const addVariantRow = () => {
    setVariantRows((rows) => [
      ...rows,
      { id: null, unit_id: "", multiplier: "1", price: "" },
    ])
  }

  const updateVariantRow = (index: number, field: keyof ProductUnitRow, value: string) => {
    setVariantRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const removeVariantRow = (index: number) => {
    setVariantRows((rows) => rows.filter((_, i) => i !== index))
  }

  const handleSaveVariants = async () => {
    if (!variantProduct) return
    setSavingVariants(true)
    try {
      const { error: updateErr } = await supabase
        .from("products")
        .update({ is_multi_unit: variantIsMulti })
        .eq("id", variantProduct.id)
      if (updateErr) throw updateErr

      const { error: deleteErr } = await supabase
        .from("product_units")
        .delete()
        .eq("product_id", variantProduct.id)
      if (deleteErr) throw deleteErr

      if (variantIsMulti) {
        const validRows = variantRows.filter((row) => row.unit_id && row.price)
        if (validRows.length > 0) {
          const rowsPayload = validRows.map((row) => ({
            product_id: variantProduct.id,
            unit_id: row.unit_id,
            unit_name: units.find((u) => u.id === row.unit_id)?.name || "",
            multiplier: parseFloat(row.multiplier) || 1,
            price: parseFloat(row.price),
          }))
          const { error: insertErr } = await supabase.from("product_units").insert(rowsPayload)
          if (insertErr) throw insertErr
        }
      }

      toast.success(`Varian satuan produk "${variantProduct.name}" berhasil disimpan!`)
      setVariantOpen(false)
      fetchProducts()
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menyimpan varian satuan: " + err.message)
    } finally {
      setSavingVariants(false)
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

  const handleProductSort = (key: ProductSortKey) => {
    if (productSortKey === key) {
      setProductSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setProductSortKey(key)
      setProductSortDir("asc")
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

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valA: string
    let valB: string
    switch (productSortKey) {
      case "sku":
        valA = a.sku || ""
        valB = b.sku || ""
        break
      case "category":
        valA = a.categories?.name || ""
        valB = b.categories?.name || ""
        break
      case "unit":
        valA = units.find((u) => u.id === a.unit_id)?.name || ""
        valB = units.find((u) => u.id === b.unit_id)?.name || ""
        break
      default:
        valA = a.name
        valB = b.name
    }
    return productSortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
  })

  const productTotalPages = Math.ceil(sortedProducts.length / productItemsPerPage)
  const paginatedAssignProducts = sortedProducts.slice(
    (productPage - 1) * productItemsPerPage,
    productPage * productItemsPerPage
  )

  useEffect(() => {
    setUnitPage(1)
  }, [search, unitItemsPerPage, unitSortKey, unitSortDir])

  useEffect(() => {
    setProductPage(1)
  }, [productSearch, productItemsPerPage, productSortKey, productSortDir])

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
                Kelola daftar satuan (pcs, kg, dus, dll) dan hubungkan ke produk.
              </p>
            </div>
          </div>

          <Tabs defaultValue="kelola" className="w-full">
            <TabsList>
              <TabsTrigger value="kelola">Kelola Satuan</TabsTrigger>
              <TabsTrigger value="assign">Assign ke Produk</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="assign" className="mt-4">
              <Card className="border-border/50 shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Assign Satuan ke Produk</CardTitle>
                      <CardDescription>
                        Ubah satuan dasar produk secara langsung tanpa membuka form Produk. Menampilkan {filteredProducts.length} produk.
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari SKU atau Nama Produk..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-9 bg-background"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-muted-foreground text-sm">Memuat data produk...</p>
                    </div>
                  ) : filteredProducts.length === 0 ? (
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
                              <button type="button" onClick={() => handleProductSort("sku")} className="flex items-center gap-1 hover:text-foreground">
                                SKU <SortIcon active={productSortKey === "sku"} dir={productSortDir} />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button type="button" onClick={() => handleProductSort("name")} className="flex items-center gap-1 hover:text-foreground">
                                Nama Produk <SortIcon active={productSortKey === "name"} dir={productSortDir} />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button type="button" onClick={() => handleProductSort("category")} className="flex items-center gap-1 hover:text-foreground">
                                Kategori <SortIcon active={productSortKey === "category"} dir={productSortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="w-[220px]">
                              <button type="button" onClick={() => handleProductSort("unit")} className="flex items-center gap-1 hover:text-foreground">
                                Satuan Dasar <SortIcon active={productSortKey === "unit"} dir={productSortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="w-[140px] text-center">Multi-Satuan</TableHead>
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
                              <TableCell>{product.categories?.name || "-"}</TableCell>
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
                                  onClick={() => handleOpenVariants(product)}
                                  className="h-8 px-2 text-xs font-semibold"
                                  title="Kelola Varian Satuan"
                                >
                                  <IconLayersLinked className="size-3.5 mr-1" /> Kelola Varian
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
                        <Select value={productItemsPerPage.toString()} onValueChange={(val) => setProductItemsPerPage(parseInt(val))}>
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

                      {productTotalPages > 1 && (
                        <div className="flex items-center gap-3">
                          <p>
                            Halaman <span className="font-semibold text-foreground">{productPage}</span> dari{" "}
                            <span className="font-semibold text-foreground">{productTotalPages}</span>
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={productPage === 1}
                              onClick={() => setProductPage((p) => Math.max(p - 1, 1))}
                              className="size-8"
                            >
                              <IconChevronLeft className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={productPage === productTotalPages}
                              onClick={() => setProductPage((p) => Math.min(p + 1, productTotalPages))}
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

        {/* Multi-unit variant management dialog */}
        <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kelola Varian Satuan: {variantProduct?.name}</DialogTitle>
              <DialogDescription>
                Atur beberapa satuan untuk satu produk ini, masing-masing dengan isi dan harga sendiri (mis. Pcs, Pack, Dus).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="variantIsMulti"
                  checked={variantIsMulti}
                  onCheckedChange={(checked) => setVariantIsMulti(!!checked)}
                  disabled={savingVariants || loadingVariants}
                />
                <Label htmlFor="variantIsMulti" className="text-sm font-medium leading-none">
                  Produk ini punya lebih dari satu satuan (multi-satuan)
                </Label>
              </div>

              {variantIsMulti && (
                <div className="space-y-3 rounded-md border border-border p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Daftar Varian Satuan</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addVariantRow}
                      disabled={savingVariants || loadingVariants}
                      className="h-7 text-xs"
                    >
                      <IconPlus className="size-3.5 mr-1" /> Tambah Varian
                    </Button>
                  </div>

                  {loadingVariants ? (
                    <div className="flex items-center justify-center py-4">
                      <IconLoader2 className="animate-spin size-4 text-muted-foreground" />
                    </div>
                  ) : variantRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Belum ada varian satuan. Klik "Tambah Varian" untuk menambahkan (mis. Pack, Dus).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {variantRows.map((row, index) => (
                        <div key={index} className="flex items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Satuan</Label>
                            <Select
                              value={row.unit_id}
                              onValueChange={(val) => updateVariantRow(index, "unit_id", val)}
                              disabled={savingVariants}
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
                              onChange={(e) => updateVariantRow(index, "multiplier", e.target.value)}
                              disabled={savingVariants}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Harga (IDR)</Label>
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={row.price}
                              onChange={(e) => updateVariantRow(index, "price", e.target.value)}
                              disabled={savingVariants}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 shrink-0 text-destructive hover:bg-destructive/10"
                            onClick={() => removeVariantRow(index)}
                            disabled={savingVariants}
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

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantOpen(false)}
                disabled={savingVariants}
              >
                Batal
              </Button>
              <Button type="button" onClick={handleSaveVariants} disabled={savingVariants || loadingVariants}>
                {savingVariants ? (
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
