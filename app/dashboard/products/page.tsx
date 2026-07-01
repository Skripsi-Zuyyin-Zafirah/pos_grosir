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
import { IconLoader2, IconPlus, IconSearch, IconEdit, IconTrash, IconPackage, IconPhoto, IconCamera } from "@tabler/icons-react"

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
  categories?: {
    name: string
  } | null
}

type Category = {
  id: string
  name: string
}

export default function ProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Form modal state
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [unit, setUnit] = useState("")
  const [weight, setWeight] = useState("")
  const [description, setDescription] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState("")

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
      setProducts(prodData || [])
    } catch (err: any) {
      toast.error("Gagal memuat data: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

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

        // Automatically create matching inventory row for the new product
        if (newProd) {
          const { error: invErr } = await supabase
            .from("inventory")
            .insert({
              product_id: newProd.id,
              stock_qty: 0,
              location: null,
              reorder_level: 5,
            })
          if (invErr) {
            console.error("Gagal membuat baris inventori:", invErr.message)
          }
        }

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
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  )

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
              <h1 className="text-3xl font-bold tracking-tight">Kelola Produk</h1>
              <p className="text-muted-foreground mt-1">
                Kelola daftar produk, SKU, harga, dan kategori barang grosir Anda.
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
                  <p className="text-muted-foreground text-sm">Memuat data produk...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
                  <IconPackage className="size-12 text-muted-foreground/60 mb-2" />
                  <h3 className="font-semibold text-lg">Tidak Ada Produk</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Silakan tambahkan produk baru untuk mengisi katalog produk.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Foto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Harga Grosir</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead className="w-[100px] text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
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
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>
                            {product.categories?.name || "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatRupiah(product.price)}
                          </TableCell>
                          <TableCell>{product.unit || "pcs"}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEdit(product)}
                                className="size-8"
                              >
                                <IconEdit className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDelete(product.id)}
                                className="size-8 text-destructive hover:bg-destructive/10"
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Product Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
              <DialogDescription>
                Masukkan informasi detail produk grosir di bawah ini.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="max-h-[60vh] overflow-y-auto px-1 pr-2 space-y-4">
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
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSku(`PRD-${Date.now().toString().slice(-6)}`)}
                      disabled={submitting}
                      className="text-xs shrink-0"
                    >
                      Generate
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
                    <SelectTrigger id="unit">
                      <SelectValue placeholder="Pilih Satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">pcs (Pcs)</SelectItem>
                      <SelectItem value="pack">pack (Pack)</SelectItem>
                      <SelectItem value="dus">dus (Dus)</SelectItem>
                      <SelectItem value="karton">karton (Karton)</SelectItem>
                      <SelectItem value="slop">slop (Slop)</SelectItem>
                      <SelectItem value="kg">kg (Kilogram)</SelectItem>
                      <SelectItem value="liter">liter (Liter)</SelectItem>
                      <SelectItem value="box">box (Box)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto Produk</Label>
                <div className="flex flex-col gap-3">
                  {/* Image Preview */}
                  {(imageFile || imageUrl) ? (
                    <div className="relative w-32 h-32 rounded-lg border border-border overflow-hidden bg-muted group">
                      <img
                        src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImageUrl("");
                          // Clear input values
                          const imgInput = document.getElementById("image") as HTMLInputElement;
                          if (imgInput) imgInput.value = "";
                          const camInput = document.getElementById("camera-capture-input") as HTMLInputElement;
                          if (camInput) camInput.value = "";
                        }}
                        className="absolute top-1.5 right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 opacity-90 transition-opacity shadow-sm"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground text-xs">
                      Belum ada foto
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                        if (file) setImageUrl("");
                      }}
                      disabled={submitting}
                      className="bg-background flex-1 cursor-pointer"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const camInput = document.getElementById("camera-capture-input");
                        if (camInput) camInput.click();
                      }}
                      disabled={submitting}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <IconCamera className="size-4" /> Ambil Kamera
                    </Button>
                    <input
                      id="camera-capture-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                        if (file) setImageUrl("");
                      }}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

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
