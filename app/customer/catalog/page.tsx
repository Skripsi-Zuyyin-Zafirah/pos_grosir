"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCart } from "@/lib/cart/cart-context"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  IconLoader2,
  IconSearch,
  IconPhoto,
  IconMinus,
  IconPlus,
  IconShoppingCartPlus,
  IconPackageOff,
  IconAlertTriangle,
  IconCircleCheck,
} from "@tabler/icons-react"

type ProductUnit = {
  id: string
  name: string
  price: number
  multiplier: number
  stock: number        // calculated stock in this unit (product.stock / multiplier)
  time_weight?: number | null
}

type Product = {
  id: string
  sku: string | null
  name: string
  description: string | null
  price: number
  stock: number
  unit: string | null
  image_url: string | null
  category_id: string | null
  is_multi_unit: boolean | null
  categories: { name: string } | null
  product_units: ProductUnit[]
}

type Category = {
  id: string
  name: string
}

export default function CustomerCatalogPage() {
  const supabase = createClient()
  const { addItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  // Per-product state: selected unit & qty
  const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({})
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select(`
          id, sku, name, description, price, stock, unit, image_url, category_id, is_multi_unit,
          categories:category_id ( name ),
          product_units ( id, name:unit_name, price, multiplier, time_weight )
        `)
        .order("name")
      if (prodErr) throw prodErr

      // Map: calculate per-unit stock from product.stock / multiplier
      const mappedProducts: Product[] = (prodData || []).map((p: any) => {
        const units: ProductUnit[] = (p.product_units || []).map((u: any) => ({
          ...u,
          stock: u.multiplier > 0 ? Math.floor(p.stock / u.multiplier) : 0,
        }))
        return { ...p, product_units: units }
      })

      setProducts(mappedProducts)

      // Initialize selected unit to the first available unit for multi-unit products
      const initialUnits: Record<string, string> = {}
      mappedProducts.forEach((p) => {
        if (p.is_multi_unit && p.product_units.length > 0) {
          // pick first unit that has stock, else pick first
          const firstAvailable = p.product_units.find((u) => u.stock > 0) || p.product_units[0]
          initialUnits[p.id] = firstAvailable.id
        }
      })
      setSelectedUnit(initialUnits)

    } catch (err: any) {
      toast.error("Gagal memuat katalog: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [products, search, categoryFilter])

  // Get current qty for a product
  const getQty = (productId: string) => quantities[productId] ?? 1

  // Set qty, clamped to [1, maxStock]
  const setQty = (productId: string, qty: number, maxStock: number) => {
    const clamped = Math.max(1, Math.min(qty, Math.max(maxStock, 1)))
    setQuantities((prev) => ({ ...prev, [productId]: clamped }))
  }

  // Get current selected unit object for a multi-unit product
  const getActiveUnit = (product: Product): ProductUnit | null => {
    if (!product.is_multi_unit || product.product_units.length === 0) return null
    const uid = selectedUnit[product.id]
    return product.product_units.find((u) => u.id === uid) || product.product_units[0]
  }

  // Effective stock in selected unit quantity
  const getEffectiveStock = (product: Product): number => {
    if (product.is_multi_unit) {
      const unit = getActiveUnit(product)
      return unit ? unit.stock : 0
    }
    return product.stock
  }

  // Effective price for currently selected unit
  const getEffectivePrice = (product: Product): number => {
    if (product.is_multi_unit) {
      const unit = getActiveUnit(product)
      return unit ? unit.price : product.price
    }
    return product.price
  }

  const handleAddToCart = (product: Product) => {
    const effectiveStock = getEffectiveStock(product)
    if (effectiveStock <= 0) {
      toast.error("Stok habis untuk kemasan yang dipilih.")
      return
    }
    const qty = getQty(product.id)

    if (product.is_multi_unit) {
      const unit = getActiveUnit(product)
      if (!unit) return
      addItem({
        productId: product.id,
        unitId: unit.id,
        unitName: unit.name,
        multiplier: unit.multiplier,
        name: product.name,
        price: unit.price,
        imageUrl: product.image_url,
        stockQty: unit.stock,
        timeWeight: unit.time_weight ?? 1,
      }, qty)
      toast.success(`${qty} ${unit.name} ${product.name} ditambahkan ke keranjang!`)
    } else {
      addItem({
        productId: product.id,
        unitId: null,
        unitName: product.unit || "pcs",
        multiplier: 1,
        name: product.name,
        price: product.price,
        imageUrl: product.image_url,
        stockQty: product.stock,
        timeWeight: 1,
      }, qty)
      toast.success(`${qty} ${product.unit || "pcs"} ${product.name} ditambahkan ke keranjang!`)
    }

    setQuantities((prev) => ({ ...prev, [product.id]: 1 }))
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const getStockStatus = (product: Product) => {
    const stock = getEffectiveStock(product)
    const unit = product.is_multi_unit ? getActiveUnit(product)?.name || product.unit || "pcs" : product.unit || "pcs"
    const pcsStock = product.is_multi_unit ? getActiveUnit(product) ? getActiveUnit(product)!.stock * (getActiveUnit(product)!.multiplier) : 0 : product.stock

    if (stock <= 0) {
      return { label: "Habis", icon: "❌", className: "text-destructive" }
    } else if (stock <= 3) {
      return {
        label: `${stock} ${unit} (${pcsStock} pcs) ⚠️`,
        icon: "⚠️",
        className: "text-amber-600 dark:text-amber-400",
      }
    }
    return {
      label: `${stock} ${unit}`,
      icon: "✅",
      className: "text-emerald-600 dark:text-emerald-400",
    }
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
      <CustomerSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Katalog Produk</h1>
              <p className="text-muted-foreground mt-1">
                Pilih produk dan kemasan grosir yang ingin Anda pesan, lalu tambahkan ke keranjang.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari SKU atau nama produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Semua Kategori" />
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
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Memuat katalog produk...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
              <IconPackageOff className="size-14 text-muted-foreground/60 mb-2" />
              <h3 className="font-semibold text-lg">Produk Tidak Ditemukan</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Coba ubah kata kunci pencarian atau filter kategori Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product) => {
                const isMulti = !!product.is_multi_unit
                const activeUnit = getActiveUnit(product)
                const effectiveStock = getEffectiveStock(product)
                const effectivePrice = getEffectivePrice(product)
                const outOfStock = effectiveStock <= 0
                const stockStatus = getStockStatus(product)

                return (
                  <Card
                    key={product.id}
                    className={`overflow-hidden border-border/50 shadow-sm hover:shadow-lg transition-all flex flex-col gap-0 ${outOfStock ? "opacity-75" : ""}`}
                  >
                    {/* Product Image */}
                    <div className="aspect-square w-full bg-muted flex items-center justify-center relative overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform hover:scale-105"
                        />
                      ) : (
                        <IconPhoto className="size-10 text-muted-foreground/40" />
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] flex items-center justify-center">
                          <Badge variant="destructive" className="text-[11px] font-bold shadow-md">
                            Stok Habis
                          </Badge>
                        </div>
                      )}
                      {/* Multi-unit badge */}
                      {isMulti && !outOfStock && (
                        <Badge className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 font-bold bg-primary/90 hover:bg-primary border-none">
                          GROSIR
                        </Badge>
                      )}
                    </div>

                    <CardHeader className="pb-1 pt-3 px-3 gap-1">
                      {product.categories?.name && (
                        <Badge variant="outline" className="w-fit text-[9px] font-semibold px-1.5 py-0 leading-4">
                          {product.categories.name}
                        </Badge>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono">{product.sku || ""}</p>
                      <h3 className="font-bold text-xs leading-snug line-clamp-2 min-h-[2rem]">
                        {product.name}
                      </h3>
                    </CardHeader>

                    <CardContent className="px-3 pb-2 space-y-2">
                      {/* Multi-unit: show dropdown */}
                      {isMulti && product.product_units.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Pilih Kemasan Grosir:
                          </p>
                          <Select
                            value={selectedUnit[product.id] || ""}
                            onValueChange={(val) => {
                              setSelectedUnit((prev) => ({ ...prev, [product.id]: val }))
                              setQuantities((prev) => ({ ...prev, [product.id]: 1 }))
                            }}
                          >
                            <SelectTrigger className="h-7 text-[11px] font-semibold border-primary/30 focus:ring-primary/20">
                              <SelectValue placeholder="Pilih kemasan..." />
                            </SelectTrigger>
                            <SelectContent>
                              {product.product_units.map((unit) => {
                                const unitOutOfStock = unit.stock <= 0
                                return (
                                  <SelectItem
                                    key={unit.id}
                                    value={unit.id}
                                    disabled={unitOutOfStock}
                                    className={`text-[11px] ${unitOutOfStock ? "opacity-50 line-through" : ""}`}
                                  >
                                    {unitOutOfStock ? "✗" : "✓"} {unit.name} ({formatRupiah(unit.price)})
                                    {unitOutOfStock ? " - Habis" : ` - Stok: ${unit.stock}`}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {/* Price */}
                      <div>
                        <p className="text-sm font-bold text-primary leading-tight">
                          {formatRupiah(effectivePrice)}
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {" "}/ {isMulti ? (activeUnit?.name || product.unit || "unit") : (product.unit || "pcs")}
                          </span>
                        </p>
                        {/* pcs sub-price for multi-unit */}
                        {isMulti && activeUnit && activeUnit.multiplier > 1 && (
                          <p className="text-[10px] text-muted-foreground">
                            ≈ {formatRupiah(Math.round(activeUnit.price / activeUnit.multiplier))} / pcs
                          </p>
                        )}
                      </div>

                      {/* Stock status */}
                      <p className={`text-[10px] font-semibold ${stockStatus.className}`}>
                        Stok: {stockStatus.label}
                      </p>
                    </CardContent>

                    <CardFooter className="pt-2 border-t border-border/50 flex flex-col items-stretch gap-1.5 px-3 pb-3 mt-auto">
                      {/* Qty stepper */}
                      <div className="flex items-center justify-between border border-border rounded-md h-7">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-none"
                          disabled={outOfStock}
                          onClick={() => setQty(product.id, getQty(product.id) - 1, effectiveStock)}
                        >
                          <IconMinus className="size-3" />
                        </Button>
                        <span className="flex-1 text-center text-xs font-semibold tabular-nums">
                          {outOfStock ? 0 : getQty(product.id)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-none"
                          disabled={outOfStock || getQty(product.id) >= effectiveStock}
                          onClick={() => setQty(product.id, getQty(product.id) + 1, effectiveStock)}
                        >
                          <IconPlus className="size-3" />
                        </Button>
                      </div>
                      {/* Add to cart button */}
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs font-semibold"
                        disabled={outOfStock}
                        onClick={() => handleAddToCart(product)}
                      >
                        <IconShoppingCartPlus className="size-3.5 mr-1" /> Tambah ke Keranjang
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
