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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconCategory,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconChevronLeft,
  IconChevronRight,
  IconPackage,
} from "@tabler/icons-react"

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
  return dir === "asc" ? (
    <IconSortAscending className="size-3.5 text-foreground" />
  ) : (
    <IconSortDescending className="size-3.5 text-foreground" />
  )
}

type Category = {
  id: string
  name: string
  created_at: string
}

type CategoryProductRow = {
  id: string
  sku: string | null
  name: string
  price: number
}

type AssignProductRow = {
  id: string
  sku: string | null
  name: string
  category_id: string | null
}

export default function KategoriPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState("")

  type CategorySortKey = "name" | "usage"
  const [sortKey, setSortKey] = useState<CategorySortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [productsOpen, setProductsOpen] = useState(false)
  const [productsCategory, setProductsCategory] = useState<Category | null>(null)
  const [categoryProducts, setCategoryProducts] = useState<CategoryProductRow[]>([])
  const [loadingCategoryProducts, setLoadingCategoryProducts] = useState(false)

  const [assignProducts, setAssignProducts] = useState<AssignProductRow[]>([])
  const [loadingAssignProducts, setLoadingAssignProducts] = useState(true)
  const [assignSearch, setAssignSearch] = useState("")
  const [assigningId, setAssigningId] = useState<string | null>(null)

  type AssignSortKey = "sku" | "name" | "category"
  const [assignSortKey, setAssignSortKey] = useState<AssignSortKey>("name")
  const [assignSortDir, setAssignSortDir] = useState<"asc" | "desc">("asc")
  const [assignPage, setAssignPage] = useState(1)
  const [assignItemsPerPage, setAssignItemsPerPage] = useState(10)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name, created_at")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      const { data: productRows, error: prodErr } = await supabase
        .from("products")
        .select("category_id")
        .not("category_id", "is", null)
      if (prodErr) throw prodErr

      const counts: Record<string, number> = {}
      for (const row of productRows || []) {
        if (row.category_id) counts[row.category_id] = (counts[row.category_id] || 0) + 1
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
        .select("id, sku, name, category_id")
        .order("name")
      if (error) throw error
      setAssignProducts(data || [])
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

  const handleAssignCategory = async (product: AssignProductRow, categoryId: string) => {
    setAssigningId(product.id)
    try {
      const { error } = await supabase
        .from("products")
        .update({ category_id: categoryId || null })
        .eq("id", product.id)
      if (error) throw error

      setAssignProducts((rows) =>
        rows.map((r) => (r.id === product.id ? { ...r, category_id: categoryId || null } : r))
      )
      toast.success(`Kategori produk "${product.name}" berhasil diperbarui!`)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal mengubah kategori produk: " + err.message)
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

  const handleEdit = (category: Category) => {
    setEditId(category.id)
    setName(category.name)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const normalizedName = name.trim().toLowerCase()
    const duplicateExists = categories.some(
      (c) => c.name.trim().toLowerCase() === normalizedName && c.id !== editId
    )
    if (duplicateExists) {
      toast.error("Kategori tersebut sudah ada.")
      return
    }

    setSubmitting(true)

    try {
      const payload = { name: name.trim() }

      if (editId) {
        const { error } = await supabase
          .from("categories")
          .update(payload)
          .eq("id", editId)
        if (error) throw error
        toast.success("Kategori berhasil diperbarui!")
      } else {
        const { error } = await supabase
          .from("categories")
          .insert(payload)
        if (error) throw error
        toast.success("Kategori berhasil ditambahkan!")
      }

      setOpen(false)
      fetchData()
    } catch (err: any) {
      if (err?.code === "23505") {
        toast.error("Kategori tersebut sudah ada.")
      } else {
        toast.error("Gagal menyimpan kategori: " + err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (category: Category) => {
    if (usageCounts[category.id]) {
      toast.error(
        `Kategori "${category.name}" masih dipakai oleh ${usageCounts[category.id]} produk dan tidak bisa dihapus.`
      )
      return
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${category.name}"?`)) return

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id)
      if (error) throw error
      toast.success("Kategori berhasil dihapus!")
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menghapus kategori: " + err.message)
    }
  }

  const handleSort = (key: CategorySortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const handleViewProducts = async (category: Category) => {
    setProductsCategory(category)
    setProductsOpen(true)
    setLoadingCategoryProducts(true)
    setCategoryProducts([])

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, price")
        .eq("category_id", category.id)
        .order("name")
      if (error) throw error
      setCategoryProducts(data || [])
    } catch (err: any) {
      toast.error("Gagal memuat produk untuk kategori ini: " + err.message)
    } finally {
      setLoadingCategoryProducts(false)
    }
  }

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const sortedCategories = [...filteredCategories].sort((a, b) => {
    const valA = sortKey === "name" ? a.name : usageCounts[a.id] || 0
    const valB = sortKey === "name" ? b.name : usageCounts[b.id] || 0
    if (typeof valA === "number" && typeof valB === "number") {
      return sortDir === "asc" ? valA - valB : valB - valA
    }
    return sortDir === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  const totalPages = Math.ceil(sortedCategories.length / itemsPerPage)
  const paginatedCategories = sortedCategories.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  )

  useEffect(() => {
    setPage(1)
  }, [search, itemsPerPage, sortKey, sortDir])

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
        valA = categories.find((c) => c.id === a.category_id)?.name || ""
        valB = categories.find((c) => c.id === b.category_id)?.name || ""
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
              <h1 className="text-3xl font-bold tracking-tight">Kelola Kategori</h1>
              <p className="text-muted-foreground mt-1">
                Kelola daftar kategori produk dan assign kategori ke produk.
              </p>
            </div>
          </div>

          <Tabs defaultValue="kelola" className="w-full">
            <TabsList>
              <TabsTrigger value="kelola">Kelola Kategori</TabsTrigger>
              <TabsTrigger value="assign">Assign Produk</TabsTrigger>
            </TabsList>

            <TabsContent value="kelola" className="mt-4">
              <Card className="border-border/50 shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Daftar Kategori</CardTitle>
                      <CardDescription>
                        Menampilkan total {filteredCategories.length} kategori terdaftar
                      </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-64">
                        <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                          placeholder="Cari nama kategori..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-9 bg-background"
                        />
                      </div>
                      <Button onClick={handleAdd} className="w-full sm:w-auto">
                        <IconPlus className="size-4 mr-2" /> Tambah Kategori
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-muted-foreground text-sm">Memuat data kategori...</p>
                    </div>
                  ) : filteredCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                      <IconCategory className="size-12 text-muted-foreground/60 mb-2" />
                      <h3 className="font-semibold text-lg">Tidak Ada Kategori</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mt-1">
                        Silakan tambahkan kategori baru atau sesuaikan pencarian untuk melihat data.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                <button type="button" onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                                  Nama Kategori <SortIcon active={sortKey === "name"} dir={sortDir} />
                                </button>
                              </TableHead>
                              <TableHead className="text-right">
                                <button type="button" onClick={() => handleSort("usage")} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                  Jumlah Produk Terpakai <SortIcon active={sortKey === "usage"} dir={sortDir} />
                                </button>
                              </TableHead>
                              <TableHead className="w-[160px] text-center">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedCategories.map((category) => (
                              <TableRow key={category.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium">{category.name}</TableCell>
                                <TableCell className="text-right">{usageCounts[category.id] || 0}</TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleViewProducts(category)}
                                      className="size-8"
                                      title="Lihat Produk"
                                    >
                                      <IconPackage className="size-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleEdit(category)}
                                      className="size-8"
                                      title="Edit Kategori"
                                    >
                                      <IconEdit className="size-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleDelete(category)}
                                      className="size-8 text-destructive hover:bg-destructive/10"
                                      title="Hapus Kategori"
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
                      <CardTitle>Assign Kategori ke Produk</CardTitle>
                      <CardDescription>
                        Ubah kategori produk secara langsung. Menampilkan {filteredAssignProducts.length} produk.
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
                              <TableHead className="w-[220px]">
                                <button type="button" onClick={() => handleAssignSort("category")} className="flex items-center gap-1 hover:text-foreground">
                                  Kategori <SortIcon active={assignSortKey === "category"} dir={assignSortDir} />
                                </button>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedAssignProducts.map((product) => (
                              <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-mono text-xs font-semibold">
                                  {product.sku || "-"}
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>
                                  <Select
                                    value={product.category_id || ""}
                                    onValueChange={(val) => handleAssignCategory(product, val)}
                                    disabled={assigningId === product.id}
                                  >
                                    <SelectTrigger className="h-8 w-full">
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
              <DialogTitle>{editId ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
              <DialogDescription>
                Masukkan nama kategori (contoh: Sembako, Minuman).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Kategori</Label>
                <Input
                  id="name"
                  placeholder="Sembako"
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

        <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Produk dengan Kategori: {productsCategory?.name}</DialogTitle>
              <DialogDescription>
                Daftar produk yang menggunakan kategori ini.
              </DialogDescription>
            </DialogHeader>

            {loadingCategoryProducts ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : categoryProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-muted rounded-lg">
                <IconPackage className="size-10 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground max-w-xs">
                  Belum ada produk yang menggunakan kategori ini.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
                {categoryProducts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {p.sku || "-"} &middot; Rp {p.price.toLocaleString("id-ID")}
                      </p>
                    </div>
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
      </SidebarInset>
    </SidebarProvider>
  )
}
