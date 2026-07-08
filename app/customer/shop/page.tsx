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
  IconAlertCircle,
  IconRefresh,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string
  name: string
}

type Product = {
  id: string
  sku: string | null
  name: string
  price: number
  unit: string | null
  weight: number | null
  image_url: string | null
  categories: {
    id: string
    name: string
  } | null
}

type InventoryItem = {
  product_id: string
  stock_qty: number
  products: Product | null
}

type CartItem = {
  productId: string
  name: string
  price: number
  unit: string | null
  weight: number | null
  quantity: number
  stockQty: number
  imageUrl: string | null
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
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cartCount, setCartCount] = useState(0)

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

      // Fetch Inventory with Products and Categories join
      const { data: invData, error: invErr } = await supabase
        .from("inventory")
        .select(`
          product_id,
          stock_qty,
          products:product_id (
            id,
            sku,
            name,
            price,
            unit,
            weight,
            image_url,
            categories:category_id (
              id,
              name
            )
          )
        `)

      if (invErr) throw invErr
      setInventory((invData as any) || [])
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

    // ── Supabase Realtime Channels ──
    const inventoryChannel = supabase
      .channel("realtime-shop-inventory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          fetchProductsAndCategories()
        }
      )
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
      supabase.removeChannel(inventoryChannel)
    }
  }, [])

  // ── Add to Cart Handler ────────────────────────────────────────────────────
  const handleAddToCart = (item: InventoryItem) => {
    const product = item.products
    if (!product) return

    if (item.stock_qty <= 0) {
      toast.error("Stok produk habis!")
      return
    }

    try {
      const stored = localStorage.getItem("pos_grosir_cart")
      let cart: CartItem[] = stored ? JSON.parse(stored) : []

      const existingIndex = cart.findIndex((i) => i.productId === product.id)

      if (existingIndex > -1) {
        const currentQty = cart[existingIndex].quantity
        if (currentQty >= item.stock_qty) {
          toast.warning(`Gagal menambahkan: Batas maksimal stok (${item.stock_qty} ${product.unit || 'pcs'}) tercapai.`)
          return
        }
        cart[existingIndex].quantity += 1
      } else {
        cart.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          weight: product.weight,
          quantity: 1,
          stockQty: item.stock_qty,
          imageUrl: product.image_url,
        })
      }

      localStorage.setItem("pos_grosir_cart", JSON.stringify(cart))
      updateCartCount()
      toast.success(`${product.name} ditambahkan ke keranjang.`)
    } catch (e: any) {
      toast.error("Gagal menambahkan ke keranjang: " + e.message)
    }
  }

  // ── Filtered Products ──────────────────────────────────────────────────────
  const filtered = inventory.filter((item) => {
    const product = item.products
    if (!product) return false

    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || 
                          (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()))
    
    const matchesCategory = selectedCategory === "all" || 
                            (product.categories && product.categories.id === selectedCategory)

    return matchesSearch && matchesCategory
  })

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
      
      {/* ── Page Header ── */}
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

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
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

        {/* Category Filter */}
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

        {/* Refresh Button */}
        <Button variant="outline" size="icon" onClick={fetchProductsAndCategories}>
          <IconRefresh className="size-4" />
        </Button>
      </div>

      {/* ── Product Grid ── */}
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
          {filtered.map((item) => {
            const product = item.products
            if (!product) return null

            const isOutOfStock = item.stock_qty <= 0
            const isLowStock = item.stock_qty > 0 && item.stock_qty <= 5

            return (
              <Card key={product.id} className="flex flex-col border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 bg-background overflow-hidden">
                {/* Image / Placeholder */}
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

                  {/* Kategori Badge */}
                  {product.categories && (
                    <Badge variant="secondary" className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 bg-background/90 backdrop-blur-sm border shadow-sm">
                      {product.categories.name}
                    </Badge>
                  )}

                  {/* Stock Status Badge */}
                  <div className="absolute top-3 right-3">
                    {isOutOfStock ? (
                      <Badge className="bg-rose-500 hover:bg-rose-600 border-none font-bold text-[10px]">HABIS</Badge>
                    ) : isLowStock ? (
                      <Badge className="bg-amber-500 hover:bg-amber-600 border-none font-bold text-[10px]">STOK MENIPIS</Badge>
                    ) : (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none font-bold text-[10px]">Tersedia</Badge>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <CardHeader className="p-4 pb-2 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                    {product.sku || "NO SKU"}
                  </span>
                  <CardTitle className="text-base font-bold line-clamp-2 min-h-[3rem] leading-snug">
                    {product.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 pt-0 pb-2 flex-1 flex flex-col justify-end space-y-2">
                  {/* Price */}
                  <div>
                    <span className="text-xl font-extrabold text-primary">
                      {formatRupiah(product.price)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      / {product.unit || "pcs"}
                    </span>
                  </div>

                  {/* Stock Quantity */}
                  <div className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <span>Sisa Stok:</span>
                    <strong className={`font-bold ${isOutOfStock ? "text-rose-500" : isLowStock ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {item.stock_qty} {product.unit || "unit"}
                    </strong>
                  </div>

                  {/* Weight */}
                  {product.weight && (
                    <div className="text-[10px] text-muted-foreground">
                      Berat: {product.weight} kg
                    </div>
                  )}
                </CardContent>

                {/* Footer Action */}
                <CardFooter className="p-4 pt-0">
                  <Button
                    onClick={() => handleAddToCart(item)}
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
