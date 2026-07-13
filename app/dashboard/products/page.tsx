"use client"

import { useEffect, useState, useRef } from "react"
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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconPackage,
  IconPhoto,
  IconRefresh,
  IconCamera,
  IconHistory,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
} from "@tabler/icons-react"

type Product = {
  id: string
  sku: string | null
  name: string
  description: string | null
  price: number
  unit: string | null
  weight: number | null
  image_url: string | null
  category_id: string | null
  stock: number
  waktu_pengambilan: number | null
  is_multi_unit: boolean | null
  categories?: {
    name: string
  } | null
}

type Category = {
  id: string
  name: string
}

type StockMutation = {
  id: string
  change_qty: number
  type: string
  notes: string | null
  created_at: string
}

export default function ProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Main Form modal state
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Main Form fields
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [unit, setUnit] = useState("pcs")
  const [weight, setWeight] = useState("")
  const [description, setDescription] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [waktuPengambilan, setWaktuPengambilan] = useState("60") // default 60 detik
  const [isMultiUnit, setIsMultiUnit] = useState(false)
  const [stokAwal, setStokAwal] = useState("0")

  // Quick Stock Edit modal state
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockAction, setStockAction] = useState<"set" | "adjust">("adjust")
  const [stockValue, setStockValue] = useState("")
  const [stockNotes, setStockNotes] = useState("")
  const [updatingStock, setUpdatingStock] = useState(false)

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [mutations, setMutations] = useState<StockMutation[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Fetch products and categories
  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch categories
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      // Fetch products with their categories
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("*, categories:category_id ( name )")
        .order("created_at", { ascending: false })
      if (prodErr) throw prodErr
      setProducts((prodData as Product[]) || [])
    } catch (err: any) {
      toast.error("Gagal memuat data: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // SKU generator
  const generateSKU = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    setSku(`PRD-${randomNum}`)
  }

  // Open modal for add
  const handleAdd = () => {
    setEditId(null)
    setSku("")
    setName("")
    setCategoryId("")
    setPrice("")
    setUnit("pcs")
    setWeight("")
    setDescription("")
    setImageFile(null)
    setImageUrl("")
    setWaktuPengambilan("60")
    setIsMultiUnit(false)
    setStokAwal("0")
    setOpen(true)
  }

  // Open modal for edit
  const handleEdit = (product: Product) => {
    setEditId(product.id)
    setSku(product.sku || "")
    setName(product.name)
    setCategoryId(product.category_id || "")
    setPrice(product.price.toString())
    setUnit(product.unit || "pcs")
    setWeight(product.weight ? product.weight.toString() : "")
    setDescription(product.description || "")
    setImageFile(null)
    setImageUrl(product.image_url || "")
    setWaktuPengambilan(product.waktu_pengambilan ? product.waktu_pengambilan.toString() : "60")
    setIsMultiUnit(!!product.is_multi_unit)
    setStokAwal(product.stock.toString())
    setOpen(true)
  }

  // Handle Image Upload
  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `product_images/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(filePath, file)

    if (uploadError) {
      throw new Error("Gagal mengunggah foto: " + uploadError.message)
    }

    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let finalImageUrl = imageUrl

      if (imageFile) {
        finalImageUrl = await uploadImage(imageFile)
      }

      const productPayload = {
        sku: sku || null,
        name,
        category_id: categoryId || null,
        price: parseFloat(price),
        unit: unit || "pcs",
        weight: weight ? parseFloat(weight) : null,
        description: description || null,
        image_url: finalImageUrl || null,
        waktu_pengambilan: parseInt(waktuPengambilan) || 0,
        is_multi_unit: isMultiUnit,
        stock: editId ? undefined : parseInt(stokAwal) || 0, // only set stock directly on creation
      }

      if (editId) {
        // Update product
        const { error } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", editId)

        if (error) throw error
        toast.success("Produk berhasil diperbarui!")
      } else {
        // Create product
        const { data: newProd, error } = await supabase
          .from("products")
          .insert(productPayload)
          .select("id")
          .single()

        if (error) throw error

        toast.success("Produk berhasil ditambahkan!")
      }

      setOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menyimpan produk: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Quick Stock Edit action
  const handleOpenStockEdit = (product: Product) => {
    setStockProduct(product)
    setStockValue("")
    setStockAction("adjust")
    setStockNotes("")
    setStockModalOpen(true)
  }

  const handleUpdateStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockProduct) return
    const value = parseInt(stockValue)
    if (isNaN(value)) {
      toast.error("Stok harus berupa angka valid.")
      return
    }

    setUpdatingStock(true)
    try {
      let newStock = stockProduct.stock
      if (stockAction === "set") {
        newStock = value
      } else {
        newStock += value
      }

      if (newStock < 0) {
        toast.error("Stok akhir tidak boleh kurang dari 0.")
        setUpdatingStock(false)
        return
      }

      const { error } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", stockProduct.id)

      if (error) throw error

      toast.success("Stok berhasil diperbarui!")
      setStockModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal memperbarui stok: " + err.message)
    } finally {
      setUpdatingStock(false)
    }
  }

  // View Stock History action
  const handleOpenHistory = async (product: Product) => {
    setHistoryProduct(product)
    setMutations([])
    setHistoryModalOpen(true)
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from("stock_mutations")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false })
      if (error) throw error
      setMutations(data || [])
    } catch (err: any) {
      toast.error("Gagal mengambil riwayat stok: " + err.message)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Delete product
  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus produk ini?")) return

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)

      if (error) throw error
      toast.success("Produk berhasil dihapus!")
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menghapus produk: " + err.message)
    }
  }

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = filterCategory === "all" || p.category_id === filterCategory
    return matchesSearch && matchesCategory
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterCategory])

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kelola Produk dan Stok</h1>
              <p className="text-muted-foreground mt-1">
                Kelola daftar produk, SKU, harga, stok, dan kategori barang grosir Anda.
              </p>
            </div>
            <Button onClick={handleAdd} className="w-full md:w-auto">
              <IconPlus className="size-4 mr-2" /> Tambah Produk
            </Button>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Daftar Produk</CardTitle>
                  <CardDescription>
                    Menampilkan total {filteredProducts.length} produk terdaftar
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  {/* Category Filter Dropdown */}
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-full sm:w-48 bg-background border-border">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kategori</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Search bar */}
                  <div className="relative w-full sm:w-64">
                    <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari SKU atau Nama Produk..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat data produk...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                  <IconPackage className="size-12 text-muted-foreground/60 mb-2" />
                  <h3 className="font-semibold text-lg">Tidak Ada Produk</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Silakan tambahkan produk baru atau sesuaikan filter untuk melihat data.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Foto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Nama Produk</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead className="text-right">Harga Grosir</TableHead>
                          <TableHead className="text-center">Satuan</TableHead>
                          <TableHead className="text-right">Stok</TableHead>
                          <TableHead className="w-[180px] text-center">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProducts.map((product) => (
                          <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="h-10 w-10 object-cover rounded-md border border-border"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border">
                                  <IconPhoto className="size-5" />
                                </div>
                              )}
                            </TableCell>
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
                            <TableCell>
                              {product.categories?.name || "-"}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {formatRupiah(product.price)}
                            </TableCell>
                            <TableCell className="text-center">{product.unit || "pcs"}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {product.stock}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenStockEdit(product)}
                                  className="h-8 px-2 text-xs font-semibold"
                                  title="Update Stok"
                                >
                                  <IconDatabase className="size-3.5 mr-1" /> Update Stok
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleOpenHistory(product)}
                                  className="size-8"
                                  title="Riwayat Stok"
                                >
                                  <IconHistory className="size-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEdit(product)}
                                  className="size-8"
                                  title="Edit Produk"
                                >
                                  <IconEdit className="size-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(product.id)}
                                  className="size-8 text-destructive hover:bg-destructive/10"
                                  title="Hapus Produk"
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

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-4 text-sm text-muted-foreground">
                      <p>
                        Menampilkan halaman <span className="font-semibold text-foreground">{currentPage}</span> dari{" "}
                        <span className="font-semibold text-foreground">{totalPages}</span>
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                          className="size-8"
                        >
                          <IconChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                          className="size-8"
                        >
                          <IconChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Product Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
              <DialogDescription>
                Masukkan informasi detail produk grosir di bawah ini.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU (Stock Keeping Unit)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sku"
                      placeholder="PRD-XXXXX"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      disabled={submitting}
                      className="font-mono text-xs font-semibold"
                    />
                    <Button type="button" variant="outline" onClick={generateSKU} className="px-2" title="Generate SKU">
                      <IconRefresh className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Kategori</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} disabled={submitting}>
                    <SelectTrigger>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nama Produk</Label>
                <Input
                  id="name"
                  placeholder="Gula Pasir 1kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="price">Harga Grosir (IDR)</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="15000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Satuan</Label>
                  <Select value={unit} onValueChange={setUnit} disabled={submitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">pcs</SelectItem>
                      <SelectItem value="pack">pack</SelectItem>
                      <SelectItem value="dus">dus</SelectItem>
                      <SelectItem value="box">box</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="liter">liter</SelectItem>
                      <SelectItem value="meter">meter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="waktuPengambilan">Waktu Pengambilan (detik)</Label>
                  <Input
                    id="waktuPengambilan"
                    type="number"
                    placeholder="60"
                    value={waktuPengambilan}
                    onChange={(e) => setWaktuPengambilan(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                {!editId && (
                  <div className="space-y-2">
                    <Label htmlFor="stokAwal">Stok Awal</Label>
                    <Input
                      id="stokAwal"
                      type="number"
                      placeholder="0"
                      value={stokAwal}
                      onChange={(e) => setStokAwal(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="isMultiUnit"
                  checked={isMultiUnit}
                  onCheckedChange={(checked) => setIsMultiUnit(!!checked)}
                  disabled={submitting}
                />
                <Label htmlFor="isMultiUnit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Produk Multi-Unit (Memiliki multi-kemasan seperti Pack/Dus/Pcs)
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="image">Foto Produk (Upload File)</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <Label htmlFor="cameraInput">Ambil Gambar Kamera</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 gap-1.5"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={submitting}
                    >
                      <IconCamera className="size-4 text-muted-foreground" /> Kamera Langsung
                    </Button>
                    <input
                      ref={cameraInputRef}
                      id="cameraInput"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              </div>

              {imageFile && (
                <p className="text-xs text-emerald-600 font-medium">
                  File terpilih: {imageFile.name}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi Produk</Label>
                <textarea
                  id="description"
                  placeholder="Penjelasan detail tentang produk..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm bg-background border-input focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

        {/* Quick Stock Edit Dialog */}
        <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Update Stok: {stockProduct?.name}</DialogTitle>
              <DialogDescription>
                Sesuaikan stok untuk produk ini.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateStockSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <Label>Metode Update</Label>
                  <Select value={stockAction} onValueChange={(val: "set" | "adjust") => setStockAction(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adjust">Tambah/Kurangi Stok</SelectItem>
                      <SelectItem value="set">Setel Jumlah Stok Baru</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="stockValue">
                    {stockAction === "set" ? "Stok Baru" : "Jumlah Tambah/Kurang (+/-)"}
                  </Label>
                  <Input
                    id="stockValue"
                    type="number"
                    placeholder={stockAction === "set" ? "100" : "+10 atau -5"}
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    required
                    disabled={updatingStock}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stockNotes">Catatan / Keterangan</Label>
                <Input
                  id="stockNotes"
                  placeholder="Restok mingguan, Koreksi stok opname, dll..."
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  disabled={updatingStock}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStockModalOpen(false)} disabled={updatingStock}>
                  Batal
                </Button>
                <Button type="submit" disabled={updatingStock}>
                  {updatingStock ? <IconLoader2 className="animate-spin mr-1.5 size-4" /> : null}
                  Update
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Riwayat Stok: {historyProduct?.name}</DialogTitle>
              <DialogDescription>
                Menampilkan log mutasi stok produk secara real-time.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <IconLoader2 className="animate-spin text-primary size-6" />
                  <span className="text-xs text-muted-foreground">Memuat riwayat...</span>
                </div>
              ) : mutations.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Tidak ada riwayat mutasi stok.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mutations.map((m) => (
                        <TableRow key={m.id} className="text-xs">
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="capitalize font-semibold">
                            {m.type === "initial" ? "Stok Awal" : m.type === "restock" ? "Restok" : m.type === "sale" ? "Penjualan" : "Penyesuaian"}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${m.change_qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {m.change_qty >= 0 ? `+${m.change_qty}` : m.change_qty}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate" title={m.notes || ""}>
                            {m.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
