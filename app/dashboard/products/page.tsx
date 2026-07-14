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
  IconX,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconClock,
} from "@tabler/icons-react"

type Product = {
  id: string
  sku: string | null
  name: string
  description: string | null
  price: number
  unit: string | null
  unit_id: string | null
  weight: number | null
  image_url: string | null
  category_id: string | null
  stock: number
  waktu_pengambilan: number | null
  is_multi_unit: boolean | null
  categories?: {
    name: string
  } | null
  units?: {
    name: string
  } | null
}

type Category = {
  id: string
  name: string
}

type Unit = {
  id: string
  name: string
}

type ProductUnitRow = {
  id: string | null
  unit_id: string
  multiplier: string
  price: string
  pickup_time_seconds: string
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
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Sorting state
  type SortKey = "sku" | "name" | "category" | "price" | "unit" | "stock"
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
    return sortDir === "asc" ? (
      <IconSortAscending className="size-3.5 text-foreground" />
    ) : (
      <IconSortDescending className="size-3.5 text-foreground" />
    )
  }

  // Bulk edit waktu pengambilan modal state
  const [bulkWaktuOpen, setBulkWaktuOpen] = useState(false)
  const [bulkWaktuCategory, setBulkWaktuCategory] = useState("all")
  const [bulkWaktuValue, setBulkWaktuValue] = useState("")
  const [bulkWaktuSaving, setBulkWaktuSaving] = useState(false)

  // Main Form modal state
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Main Form fields
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [unitId, setUnitId] = useState("")
  const [weight, setWeight] = useState("")
  const [description, setDescription] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [waktuPengambilan, setWaktuPengambilan] = useState("60") // default 60 detik
  const [isMultiUnit, setIsMultiUnit] = useState(false)
  const [stokAwal, setStokAwal] = useState("0")
  const [productUnitRows, setProductUnitRows] = useState<ProductUnitRow[]>([])
  const [loadingProductUnits, setLoadingProductUnits] = useState(false)

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

  // Live camera capture modal state
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

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

      // Fetch units
      const { data: unitData, error: unitErr } = await supabase
        .from("units")
        .select("id, name")
        .order("name")
      if (unitErr) throw unitErr
      setUnits(unitData || [])

      // Fetch products with their categories and units
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("*, categories:category_id ( name ), units:unit_id ( name )")
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
    setUnitId(units[0]?.id || "")
    setWeight("")
    setDescription("")
    setImageFile(null)
    setImageUrl("")
    setWaktuPengambilan("60")
    setIsMultiUnit(false)
    setStokAwal("0")
    setProductUnitRows([])
    setOpen(true)
  }

  // Open modal for edit
  const handleEdit = async (product: Product) => {
    setEditId(product.id)
    setSku(product.sku || "")
    setName(product.name)
    setCategoryId(product.category_id || "")
    setPrice(product.price.toString())
    setUnitId(product.unit_id || "")
    setWeight(product.weight ? product.weight.toString() : "")
    setDescription(product.description || "")
    setImageFile(null)
    setImageUrl(product.image_url || "")
    setWaktuPengambilan(product.waktu_pengambilan ? product.waktu_pengambilan.toString() : "60")
    setIsMultiUnit(!!product.is_multi_unit)
    setStokAwal(product.stock.toString())
    setProductUnitRows([])
    setOpen(true)

    if (product.is_multi_unit) {
      setLoadingProductUnits(true)
      try {
        const { data, error } = await supabase
          .from("product_units")
          .select("id, unit_id, multiplier, price, pickup_time_seconds")
          .eq("product_id", product.id)
          .order("multiplier")
        if (error) throw error
        setProductUnitRows(
          (data || []).map((row) => ({
            id: row.id,
            unit_id: row.unit_id || "",
            multiplier: row.multiplier?.toString() || "",
            price: row.price?.toString() || "",
            pickup_time_seconds: row.pickup_time_seconds?.toString() || "",
          }))
        )
      } catch (err: any) {
        toast.error("Gagal memuat varian satuan: " + err.message)
      } finally {
        setLoadingProductUnits(false)
      }
    }
  }

  // Multi-unit variant row helpers
  const addUnitRow = () => {
    setProductUnitRows((rows) => [
      ...rows,
      { id: null, unit_id: "", multiplier: "1", price: "", pickup_time_seconds: "" },
    ])
  }

  const updateUnitRow = (index: number, field: keyof ProductUnitRow, value: string) => {
    setProductUnitRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const removeUnitRow = (index: number) => {
    setProductUnitRows((rows) => rows.filter((_, i) => i !== index))
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

  // Open the live camera capture modal
  const handleOpenCamera = async () => {
    setCameraError(null)
    setCameraModalOpen(true)
    setCameraLoading(true)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Perangkat/browser ini tidak mendukung akses kamera.")
      setCameraLoading(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err: any) {
      setCameraError("Gagal mengakses kamera: " + (err.message || "Izin ditolak atau kamera tidak tersedia."))
    } finally {
      setCameraLoading(false)
    }
  }

  // Stop camera tracks and close the modal
  const handleCloseCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraModalOpen(false)
    setCameraError(null)
  }

  // Snapshot the current video frame as the product image
  const handleCapturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })
      setImageFile(file)
      handleCloseCamera()
    }, "image/jpeg", 0.9)
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

      const selectedUnitName = units.find((u) => u.id === unitId)?.name || null

      const productPayload = {
        sku: sku || null,
        name,
        category_id: categoryId || null,
        price: parseFloat(price),
        unit_id: unitId || null,
        unit: selectedUnitName,
        weight: weight ? parseFloat(weight) : null,
        description: description || null,
        image_url: finalImageUrl || null,
        waktu_pengambilan: parseInt(waktuPengambilan) || 0,
        is_multi_unit: isMultiUnit,
        stock: editId ? undefined : parseInt(stokAwal) || 0, // only set stock directly on creation
      }

      let productId = editId

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
        productId = newProd.id

        const initialStock = parseInt(stokAwal) || 0
        if (initialStock > 0) {
          const { data: { user } } = await supabase.auth.getUser()
          const { error: mutationErr } = await supabase.from("stock_mutations").insert({
            product_id: productId,
            change_qty: initialStock,
            type: "initial",
            notes: "Stok awal saat produk dibuat",
            user_id: user?.id || null,
          })
          if (mutationErr) console.error("Gagal mencatat riwayat stok:", mutationErr.message)
        }

        toast.success("Produk berhasil ditambahkan!")
      }

      // Sync multi-unit variants (product_units)
      if (productId) {
        const { error: deleteErr } = await supabase
          .from("product_units")
          .delete()
          .eq("product_id", productId)
        if (deleteErr) throw deleteErr

        if (isMultiUnit) {
          const validRows = productUnitRows.filter((row) => row.unit_id && row.price)
          if (validRows.length > 0) {
            const rowsPayload = validRows.map((row) => ({
              product_id: productId,
              unit_id: row.unit_id,
              unit_name: units.find((u) => u.id === row.unit_id)?.name || "",
              multiplier: parseFloat(row.multiplier) || 1,
              price: parseFloat(row.price),
              pickup_time_seconds: row.pickup_time_seconds ? parseFloat(row.pickup_time_seconds) : null,
            }))
            const { error: insertErr } = await supabase.from("product_units").insert(rowsPayload)
            if (insertErr) throw insertErr
          }
        }
      }

      setOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menyimpan produk: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Bulk edit waktu pengambilan
  const handleApplyBulkWaktu = async () => {
    const val = parseInt(bulkWaktuValue)
    if (isNaN(val) || val < 0) {
      toast.error("Waktu massal harus berupa angka detik yang valid.")
      return
    }
    setBulkWaktuSaving(true)
    try {
      const targets = products.filter((p) => bulkWaktuCategory === "all" || p.category_id === bulkWaktuCategory)
      const updates = targets.map((p) =>
        supabase.from("products").update({ waktu_pengambilan: val }).eq("id", p.id)
      )
      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)
      if (failed) throw failed.error

      toast.success(`Waktu pengambilan berhasil diterapkan ke ${targets.length} produk!`)
      setBulkWaktuOpen(false)
      setBulkWaktuValue("")
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menerapkan waktu pengambilan massal: " + err.message)
    } finally {
      setBulkWaktuSaving(false)
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

      const { data: { user } } = await supabase.auth.getUser()
      const { error: mutationErr } = await supabase.from("stock_mutations").insert({
        product_id: stockProduct.id,
        change_qty: stockAction === "set" ? newStock - stockProduct.stock : value,
        type: stockAction === "set" ? "adjustment" : value >= 0 ? "restock" : "adjustment",
        notes: stockNotes || null,
        user_id: user?.id || null,
      })
      if (mutationErr) console.error("Gagal mencatat riwayat stok:", mutationErr.message)

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

  // Sorted products list
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortKey) return 0
    let valA: string | number
    let valB: string | number
    switch (sortKey) {
      case "sku":
        valA = a.sku || ""
        valB = b.sku || ""
        break
      case "name":
        valA = a.name
        valB = b.name
        break
      case "category":
        valA = a.categories?.name || ""
        valB = b.categories?.name || ""
        break
      case "price":
        valA = a.price
        valB = b.price
        break
      case "unit":
        valA = a.units?.name || a.unit || ""
        valB = b.units?.name || b.unit || ""
        break
      case "stock":
        valA = a.stock
        valB = b.stock
        break
    }
    if (typeof valA === "number" && typeof valB === "number") {
      return sortDir === "asc" ? valA - valB : valB - valA
    }
    return sortDir === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  // Pagination calculation
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage)
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterCategory, itemsPerPage, sortKey, sortDir])

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
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button variant="outline" onClick={() => setBulkWaktuOpen(true)} className="w-full sm:w-auto">
                <IconClock className="size-4 mr-2" /> Bulk Edit Waktu Pengambilan
              </Button>
              <Button onClick={handleAdd} className="w-full sm:w-auto">
                <IconPlus className="size-4 mr-2" /> Tambah Produk
              </Button>
            </div>
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
                          <TableHead>
                            <button type="button" onClick={() => handleSort("sku")} className="flex items-center gap-1 hover:text-foreground">
                              SKU <SortIcon column="sku" />
                            </button>
                          </TableHead>
                          <TableHead>
                            <button type="button" onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                              Nama Produk <SortIcon column="name" />
                            </button>
                          </TableHead>
                          <TableHead>
                            <button type="button" onClick={() => handleSort("category")} className="flex items-center gap-1 hover:text-foreground">
                              Kategori <SortIcon column="category" />
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button type="button" onClick={() => handleSort("price")} className="flex items-center gap-1 ml-auto hover:text-foreground">
                              Harga Grosir <SortIcon column="price" />
                            </button>
                          </TableHead>
                          <TableHead className="text-center">
                            <button type="button" onClick={() => handleSort("unit")} className="flex items-center gap-1 mx-auto hover:text-foreground">
                              Satuan <SortIcon column="unit" />
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button type="button" onClick={() => handleSort("stock")} className="flex items-center gap-1 ml-auto hover:text-foreground">
                              Stok <SortIcon column="stock" />
                            </button>
                          </TableHead>
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
                            <TableCell className="text-center">{product.units?.name || product.unit || "pcs"}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {product.stock}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleOpenStockEdit(product)}
                                  className="size-8"
                                  title="Update Stok"
                                >
                                  <IconDatabase className="size-4" />
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
                          Halaman <span className="font-semibold text-foreground">{currentPage}</span> dari{" "}
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
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Product Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
              <DialogDescription>
                Masukkan informasi detail produk grosir di bawah ini.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Left column: core product info */}
                <div className="space-y-4">
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
                      <Select value={unitId} onValueChange={setUnitId} disabled={submitting}>
                        <SelectTrigger>
                          <SelectValue placeholder="Satuan" />
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

                  <div className="space-y-2">
                    <Label htmlFor="description">Deskripsi Produk</Label>
                    <textarea
                      id="description"
                      placeholder="Penjelasan detail tentang produk..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting}
                      className="w-full min-h-[100px] px-3 py-2 border rounded-md text-sm bg-background border-input focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {/* Right column: image + multi-unit variants */}
                <div className="space-y-4">
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
                  <div className="space-y-2">
                    <Label>Ambil Gambar Kamera</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 gap-1.5"
                      onClick={handleOpenCamera}
                      disabled={submitting}
                    >
                      <IconCamera className="size-4 text-muted-foreground" /> Kamera Langsung
                    </Button>
                  </div>

                  {imageFile && (
                    <p className="text-xs text-emerald-600 font-medium">
                      File terpilih: {imageFile.name}
                    </p>
                  )}

                  {imageUrl && !imageFile && (
                    <img
                      src={imageUrl}
                      alt="Pratinjau produk"
                      className="h-28 w-28 object-cover rounded-md border border-border"
                    />
                  )}

                  <div className="flex items-center space-x-2 py-2">
                    <Checkbox
                      id="isMultiUnit"
                      checked={isMultiUnit}
                      onCheckedChange={(checked) => setIsMultiUnit(!!checked)}
                      disabled={submitting}
                    />
                    <Label htmlFor="isMultiUnit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Produk Multi-Unit (Pack/Dus/Pcs)
                    </Label>
                  </div>

                  {isMultiUnit && (
                    <div className="space-y-3 rounded-md border border-border p-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Varian Satuan Produk</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addUnitRow}
                          disabled={submitting || loadingProductUnits}
                          className="h-7 text-xs"
                        >
                          <IconPlus className="size-3.5 mr-1" /> Tambah Varian
                        </Button>
                      </div>

                      {loadingProductUnits ? (
                        <div className="flex items-center justify-center py-4">
                          <IconLoader2 className="animate-spin size-4 text-muted-foreground" />
                        </div>
                      ) : productUnitRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Belum ada varian satuan. Klik "Tambah Varian" untuk menambahkan (mis. Pack, Dus).
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {productUnitRows.map((row, index) => (
                            <div key={index} className="flex items-end gap-2">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-muted-foreground">Satuan</Label>
                                <Select
                                  value={row.unit_id}
                                  onValueChange={(val) => updateUnitRow(index, "unit_id", val)}
                                  disabled={submitting}
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
                                  onChange={(e) => updateUnitRow(index, "multiplier", e.target.value)}
                                  disabled={submitting}
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-muted-foreground">Harga (IDR)</Label>
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  value={row.price}
                                  onChange={(e) => updateUnitRow(index, "price", e.target.value)}
                                  disabled={submitting}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8 shrink-0 text-destructive hover:bg-destructive/10"
                                onClick={() => removeUnitRow(index)}
                                disabled={submitting}
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

        {/* Live Camera Capture Dialog */}
        <Dialog
          open={cameraModalOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) handleCloseCamera()
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Ambil Gambar Kamera</DialogTitle>
              <DialogDescription>
                Arahkan kamera ke produk, lalu klik "Ambil Foto".
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {cameraError ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleOpenCamera}>
                    <IconRefresh className="size-3.5 mr-1.5" /> Coba Lagi
                  </Button>
                </div>
              ) : (
                <div className="relative rounded-md overflow-hidden bg-black aspect-video">
                  {cameraLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconLoader2 className="animate-spin size-6 text-white" />
                    </div>
                  )}
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={handleCloseCamera}>
                Batal
              </Button>
              <Button type="button" onClick={handleCapturePhoto} disabled={!!cameraError || cameraLoading}>
                <IconCamera className="size-4 mr-2" /> Ambil Foto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Edit Waktu Pengambilan Dialog */}
        <Dialog open={bulkWaktuOpen} onOpenChange={setBulkWaktuOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconClock className="size-5 text-primary" /> Bulk Edit Waktu Pengambilan
              </DialogTitle>
              <DialogDescription>
                Terapkan estimasi waktu pengambilan (detik) ke banyak produk sekaligus, berdasarkan kategori. Nilai ini menjadi bobot waktu kalkulasi ECT.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Kategori Target</Label>
                <Select value={bulkWaktuCategory} onValueChange={setBulkWaktuCategory} disabled={bulkWaktuSaving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulkWaktuValue">Waktu Pengambilan Baru (detik)</Label>
                <Input
                  id="bulkWaktuValue"
                  type="number"
                  placeholder="60"
                  value={bulkWaktuValue}
                  onChange={(e) => setBulkWaktuValue(e.target.value)}
                  disabled={bulkWaktuSaving}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setBulkWaktuOpen(false)} disabled={bulkWaktuSaving}>
                Batal
              </Button>
              <Button type="button" onClick={handleApplyBulkWaktu} disabled={bulkWaktuSaving}>
                {bulkWaktuSaving ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  "Terapkan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
