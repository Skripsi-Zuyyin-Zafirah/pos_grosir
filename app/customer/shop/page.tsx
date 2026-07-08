"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  IconLoader2,
  IconSearch,
  IconShoppingCart,
  IconBuildingStore,
  IconCirclePlus,
  IconRefresh,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string
  name: string
}

type ProductUnit = {
  id: string
  unit_name: string
  price: number
  pickup_time_seconds: number | null
  multiplier: number
}

type Product = {
  id: string
  sku: string | null
  name: string
  price: number
  stock_qty: number | null
  image_url: string | null
  categories: {
    id: string
    name: string
  } | null
  product_units: ProductUnit[]
}

type CartItem = {
  productId: string
  unitId: string
  name: string
  unitName: string
  price: number
  pickupTimeSeconds: number
  quantity: number
  stockQty: number
  imageUrl: string | null
  multiplier: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)

export default function CustomerShopPage() {
  const supabase = createClient()

  // Data states
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cartCount, setCartCount] = useState(0)

  // Selected units mapping state: { [productId]: selectedUnitId }
  const [selectedUnits, setSelectedUnits] = useState<{ [key: string]: string }>({})

  // Filter & Search states
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchProductsAndCategories = async () => {
    try {
      setLoading(true)

      // Fetch Categories
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      // Fetch Products with Categories and Units
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select(`
          id,
          sku,
          name,
          price,
          image_url,
          stock_qty,
          categories:category_id (
            id,
            name
          ),
          product_units (
            id,
            unit_name,
            price,
            pickup_time_seconds,
            multiplier
          )
        `)
        .order("name")

      if (prodErr) throw prodErr

      const mappedProducts = (prodData as any) || []
      setProducts(mappedProducts)

      // Initialize default selected units (first unit available for each product)
      const defaultUnits: { [key: string]: string } = {}
      mappedProducts.forEach((p: Product) => {
        if (p.product_units && p.product_units.length > 0) {
          // Sort by multiplier ASC (usually Pcs is smallest)
          const sortedUnits = [...p.product_units].sort((a, b) => a.multiplier - b.multiplier)
          defaultUnits[p.id] = sortedUnits[0].id
        }
      })
      setSelectedUnits(defaultUnits)
    } catch (err: any) {
      toast.error("Gagal memuat produk: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Update Cart Count ──────────────────────────────────────────────────────
  const updateCartCount = () => {
    try {
      const stored = localStorage.getItem("pos_grosir_cart")
      if (stored) {
        const cart: CartItem[] = JSON.parse(stored)
        const total = cart.reduce((sum, item) => sum + item.quantity, 0)
        setCartCount(total)
      } else {
        setCartCount(0)
      }
    } catch (e) {
      setCartCount(0)
    }
  }

  useEffect(() => {
    fetchProductsAndCategories()
    updateCartCount()

    // Listen to localstorage change from other tabs
    window.addEventListener("storage", updateCartCount)

    // Realtime channel for product/stock changes
    const productsChannel = supabase
      .channel("realtime-shop-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchProductsAndCategories()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener("storage", updateCartCount)
      supabase.removeChannel(productsChannel)
    }
  }, [])

  // ── Add to Cart Handler ────────────────────────────────────────────────────
  const handleAddToCart = (product: Product) => {
    const selectedUnitId = selectedUnits[product.id]
    const unit = product.product_units?.find((u) => u.id === selectedUnitId)

    if (!unit) {
      toast.error("Silakan pilih unit produk terlebih dahulu!")
      return
    }

    const baseStock = product.stock_qty || 0
    const maxQtyForUnit = Math.floor(baseStock / unit.multiplier)

    if (maxQtyForUnit <= 0) {
      toast.error("Stok untuk unit yang dipilih tidak mencukupi!")
      return
    }

    try {
      const stored = localStorage.getItem("pos_grosir_cart")
      let cart: CartItem[] = stored ? JSON.parse(stored) : []

      // Find if same product with same unit exists
      const existingIndex = cart.findIndex(
        (i) => i.productId === product.id && i.unitId === unit.id
      )

      if (existingIndex > -1) {
        const currentQty = cart[existingIndex].quantity
        if (currentQty >= maxQtyForUnit) {
          toast.warning(
            `Gagal menambahkan: Batas maksimal stok (${maxQtyForUnit} ${unit.unit_name}) tercapai.`
          )
          return
        }
        cart[existingIndex].quantity += 1
      } else {
        cart.push({
          productId: product.id,
          unitId: unit.id,
          name: product.name,
          unitName: unit.unit_name,
          price: unit.price,
          pickupTimeSeconds: unit.pickup_time_seconds || 5,
          quantity: 1,
          stockQty: baseStock, // Store base stock qty
          imageUrl: product.image_url,
          multiplier: unit.multiplier,
        })
      }

      localStorage.setItem("pos_grosir_cart", JSON.stringify(cart))
      updateCartCount()
      toast.success(`${product.name} (${unit.unit_name}) ditambahkan ke keranjang.`)
    } catch (e: any) {
      toast.error("Gagal menambahkan ke keranjang: " + e.message)
    }
  }

  // ── Filtered Products ──────────────────────────────────────────────────────
  const filtered = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory =
      selectedCategory === "all" ||
      (product.categories && product.categories.id === selectedCategory)

    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Katalog Belanja</h1>
          <p className="text-muted-foreground mt-1">
            Pilih produk grosir berkualitas kami dengan ketersediaan stok real-time.
          </p>
        </div>

        {/* Cart Button */}
        <Button asChild className="w-full sm:w-auto relative shadow-md" size="lg">
          <Link href="/customer/cart" className="flex items-center gap-2">
            <IconShoppingCart className="size-5" />
            <span>Keranjang Belanja</span>
            {cartCount > 0 && (
              <Badge className="ml-1 bg-rose-500 hover:bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full text-xs">
                {cartCount}
              </Badge>
            )}
          </Link>
        </Button>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari nama produk atau SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full md:w-56">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
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
        </div>

        <Button variant="outline" size="icon" onClick={fetchProductsAndCategories}>
          <IconRefresh className="size-4" />
        </Button>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Memuat katalog produk...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
          <IconBuildingStore className="size-16 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg">Produk Tidak Ditemukan</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Coba cari produk lain atau ubah kategori filter Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((product) => {
            const activeUnitId = selectedUnits[product.id]
            const activeUnit = product.product_units?.find((u) => u.id === activeUnitId)

            const baseStock = product.stock_qty || 0
            const displayPrice = activeUnit ? activeUnit.price : product.price
            const displayUnitName = activeUnit ? activeUnit.unit_name : "pcs"
            const displayMultiplier = activeUnit ? activeUnit.multiplier : 1
            const displayStock = Math.floor(baseStock / displayMultiplier)

            const isOutOfStock = displayStock <= 0
            const isLowStock = displayStock > 0 && displayStock <= 5

            return (
              <Card
                key={product.id}
                className="flex flex-col border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 bg-background overflow-hidden"
              >
                {/* Image */}
                <div className="h-44 bg-muted/30 relative flex items-center justify-center border-b border-border/50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="object-cover h-full w-full"
                    />
                  ) : (
                    <IconBuildingStore className="size-12 text-muted-foreground/30" />
                  )}

                  {/* Category Badge */}
                  {product.categories && (
                    <Badge
                      variant="secondary"
                      className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 bg-background/90 backdrop-blur-sm border shadow-sm"
                    >
                      {product.categories.name}
                    </Badge>
                  )}

                  {/* Stock Status Badge */}
                  <div className="absolute top-3 right-3">
                    {isOutOfStock ? (
                      <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-bold text-[10px]">
                        HABIS
                      </Badge>
                    ) : isLowStock ? (
                      <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-bold text-[10px]">
                        STOK MENIPIS
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-bold text-[10px]">
                        Tersedia
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Header */}
                <CardHeader className="p-4 pb-2 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                    {product.sku || "NO SKU"}
                  </span>
                  <CardTitle className="text-base font-bold line-clamp-2 min-h-[3rem] leading-snug">
                    {product.name}
                  </CardTitle>
                </CardHeader>

                {/* Content */}
                <CardContent className="p-4 pt-0 pb-2 flex-1 flex flex-col justify-end space-y-3">
                  {/* Pilihan Kemasan Dropdown */}
                  {product.product_units && product.product_units.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">
                        Pilih Kemasan Grosir:
                      </label>
                      <Select
                        value={activeUnitId}
                        onValueChange={(val) =>
                          setSelectedUnits((prev) => ({ ...prev, [product.id]: val }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Kemasan" />
                        </SelectTrigger>
                        <SelectContent>
                          {product.product_units
                            .sort((a, b) => a.multiplier - b.multiplier)
                            .map((u) => (
                              <SelectItem key={u.id} value={u.id} className="text-xs">
                                {u.unit_name} ({formatRupiah(u.price)})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Price */}
                  <div>
                    <span className="text-xl font-extrabold text-primary">
                      {formatRupiah(displayPrice)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      / {displayUnitName}
                    </span>
                  </div>

                  {/* Stock Quantity */}
                  <div className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <span>Sisa Stok:</span>
                    <strong
                      className={`font-bold ${
                        isOutOfStock
                          ? "text-rose-500"
                          : isLowStock
                            ? "text-amber-500"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {displayStock} {displayUnitName}
                    </strong>
                    {displayMultiplier > 1 && (
                      <span className="text-[10px] text-muted-foreground">
                        ({baseStock} pcs)
                      </span>
                    )}
                  </div>
                </CardContent>

                {/* Footer Action */}
                <CardFooter className="p-4 pt-0">
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={isOutOfStock}
                    className="w-full font-bold shadow-sm"
                    variant={isOutOfStock ? "secondary" : "default"}
                  >
                    {isOutOfStock ? (
                      "Habis"
                    ) : (
                      <>
                        <IconCirclePlus className="size-4 mr-1.5" />
                        Beli Grosir
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
