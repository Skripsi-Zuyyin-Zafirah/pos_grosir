"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Receipt } from "@/components/receipt"
import { cartItemKey } from "@/lib/cart/cart-context"
import { computeEWP, formatDuration } from "@/lib/queue/ewp"
import { toast } from "sonner"
import {
  IconLoader2,
  IconClock,
  IconSearch,
  IconPhoto,
  IconMinus,
  IconPlus,
  IconTrash,
  IconTrashX,
  IconShoppingCartPlus,
  IconPackageOff,
  IconShoppingCart,
  IconPrinter,
} from "@tabler/icons-react"

type ProductUnit = {
  id: string
  name: string
  price: number
  multiplier: number
  stock: number // stok terhitung dalam satuan kemasan ini (stock produk / multiplier)
  time_weight: number | null // bobot waktu (Wi) untuk kalkulasi EWP antrian
}

type Product = {
  id: string
  sku: string | null
  name: string
  price: number
  stock: number
  unit: string | null
  image_url: string | null
  category_id: string | null
  is_multi_unit: boolean | null
  time_weight: number // bobot waktu (Wi) satuan dasar untuk kalkulasi EWP antrian
  categories: { name: string } | null
  product_units: ProductUnit[]
}

type Category = {
  id: string
  name: string
}

// Id sintetis untuk merepresentasikan satuan dasar produk di dalam dropdown kemasan
const BASE_UNIT_ID = "__base__"

type CartItem = {
  productId: string
  unitId: string | null
  unitName: string | null
  multiplier: number
  name: string
  price: number
  stockQty: number
  quantity: number
  timeWeight: number // Wi (bobot waktu per satuan) untuk kalkulasi EWP antrian
}

type ReceiptOrder = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  payment_method?: string
  payment_channel?: string | null
  payment_amount?: number
  change_amount?: number
  order_items: {
    id: string
    qty: number
    unit_price: number
    products: { 
      name: string
      sku?: string | null
      unit?: string | null
    } | null
  }[]
  staff_name?: string | null
}

export default function PosWalkinPage() {
  const supabase = createClient()

  // Product catalog state
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  // Per-product state: kemasan/unit yang dipilih untuk produk multi-satuan
  const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({})

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])

  // Checkout form
  const [customerName, setCustomerName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "transfer" | "qris">("tunai")
  const [amountPaid, setAmountPaid] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [lastOrder, setLastOrder] = useState<ReceiptOrder | null>(null)

  // Total EWP pesanan yang sedang antri, dipakai untuk estimasi waktu selesai keranjang kasir
  const [queueBacklog, setQueueBacklog] = useState(0)

  useEffect(() => {
    const fetchQueueBacklog = async () => {
      const { data } = await supabase.from("orders").select("ewp").eq("status", "antri")
      setQueueBacklog((data || []).reduce((sum, o) => sum + (o.ewp || 0), 0))
    }
    fetchQueueBacklog()

    const channel = supabase
      .channel("pos-queue-backlog")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchQueueBacklog())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select(`
          id, sku, name, price, stock, unit, image_url, category_id, is_multi_unit, time_weight,
          categories:category_id ( name ),
          product_units ( id, name:unit_name, price, multiplier, time_weight )
        `)
        .order("name")
      if (prodErr) throw prodErr

      const mappedProducts: Product[] = ((prodData as any) || []).map((p: any) => {
        const units: ProductUnit[] = (p.product_units || []).map((u: any) => ({
          ...u,
          stock: u.multiplier > 0 ? Math.floor((p.stock ?? 0) / u.multiplier) : 0,
        }))
        return { ...p, product_units: units }
      })
      setProducts(mappedProducts)

      // Pilih kemasan pertama yang masih ada stoknya untuk tiap produk multi-satuan
      setSelectedUnit((prev) => {
        const next = { ...prev }
        mappedProducts.forEach((p) => {
          if (p.is_multi_unit && p.product_units.length > 0 && !next[p.id]) {
            const firstAvailable = p.product_units.find((u) => u.stock > 0) || p.product_units[0]
            next[p.id] = firstAvailable.id
          }
        })
        return next
      })
    } catch (err: any) {
      toast.error("Gagal memuat produk: " + err.message)
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    fetchProducts()
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

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = cart.reduce((sum, i) => sum + i.quantity * i.price, 0)

  // Estimasi waktu selesai keranjang ini (detik): sisa antrian saat ini + waktu kemas keranjang sendiri
  const cartEwp = computeEWP(cart.map((i) => ({ qty: i.quantity, weight: i.timeWeight })))
  const estimatedCompletionSeconds = queueBacklog + cartEwp

  // Satuan dasar produk, direpresentasikan sebagai "kemasan" dengan multiplier 1
  const getBaseUnit = (product: Product): ProductUnit => ({
    id: BASE_UNIT_ID,
    name: product.unit || "pcs",
    price: product.price,
    multiplier: 1,
    stock: product.stock ?? 0,
    time_weight: product.time_weight,
  })

  // Kemasan yang sedang dipilih untuk produk multi-satuan (termasuk satuan dasar)
  const getActiveUnit = (product: Product): ProductUnit | null => {
    if (!product.is_multi_unit || product.product_units.length === 0) return null
    const uid = selectedUnit[product.id]
    if (uid === BASE_UNIT_ID) return getBaseUnit(product)
    return product.product_units.find((u) => u.id === uid) || product.product_units[0]
  }

  const getEffectiveStock = (product: Product): number => {
    if (product.is_multi_unit) return getActiveUnit(product)?.stock ?? 0
    return product.stock ?? 0
  }

  const getEffectivePrice = (product: Product): number => {
    if (product.is_multi_unit) return getActiveUnit(product)?.price ?? product.price
    return product.price
  }

  // QTY produk ini yang sudah ada di keranjang (untuk kemasan yang sedang dipilih)
  const getCartQty = (product: Product): number => {
    const unit = product.is_multi_unit ? getActiveUnit(product) : null
    const key = cartItemKey(product.id, unit?.id ?? null)
    return cart.find((i) => cartItemKey(i.productId, i.unitId) === key)?.quantity ?? 0
  }

  const addToCart = (product: Product) => {
    const effectiveStock = getEffectiveStock(product)
    if (effectiveStock <= 0) {
      toast.error(`Stok ${product.name} tidak mencukupi.`)
      return
    }

    const unit = product.is_multi_unit ? getActiveUnit(product) : null
    const unitId = unit?.id ?? null
    const unitName = unit?.name ?? product.unit ?? null
    const multiplier = unit?.multiplier ?? 1
    const price = unit?.price ?? product.price
    const timeWeight = unit?.time_weight ?? product.time_weight
    const key = cartItemKey(product.id, unitId)

    setCart((prev) => {
      const existing = prev.find((i) => cartItemKey(i.productId, i.unitId) === key)
      if (existing) {
        if (existing.quantity >= effectiveStock) {
          toast.error(`Stok ${product.name} tidak mencukupi.`)
          return prev
        }
        return prev.map((i) =>
          cartItemKey(i.productId, i.unitId) === key ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          unitId,
          unitName,
          multiplier,
          name: product.name,
          price,
          stockQty: effectiveStock,
          quantity: 1,
          timeWeight,
        },
      ]
    })
  }

  // Keep the "amount paid" field pre-filled with the running total so cashiers
  // aren't blocked by an empty/stale value when they hit checkout.
  useEffect(() => {
    if (paymentMethod === "tunai") {
      setAmountPaid(totalPrice > 0 ? totalPrice.toString() : "")
    } else {
      setAmountPaid(totalPrice.toString())
    }
  }, [totalPrice, paymentMethod])

  const updateQuantity = (productId: string, unitId: string | null, qty: number) => {
    const key = cartItemKey(productId, unitId)
    setCart((prev) => {
      if (qty <= 0) return prev.filter((i) => cartItemKey(i.productId, i.unitId) !== key)
      return prev.map((i) =>
        cartItemKey(i.productId, i.unitId) === key ? { ...i, quantity: Math.min(qty, i.stockQty) } : i
      )
    })
  }

  const removeFromCart = (productId: string, unitId: string | null) => {
    const key = cartItemKey(productId, unitId)
    setCart((prev) => prev.filter((i) => cartItemKey(i.productId, i.unitId) !== key))
  }

  const handleClearCart = () => {
    if (cart.length === 0) return
    if (!confirm("Kosongkan keranjang transaksi ini?")) return
    setCart([])
  }

  const calculatedChange =
    paymentMethod === "tunai" && !isNaN(parseFloat(amountPaid))
      ? parseFloat(amountPaid) - totalPrice
      : 0

  const handleCheckout = async () => {
    if (cart.length === 0) return

    const paidVal = paymentMethod === "tunai" ? parseFloat(amountPaid) : totalPrice
    if (paymentMethod === "tunai" && (isNaN(paidVal) || paidVal < totalPrice)) {
      toast.error("Jumlah bayar kurang atau tidak valid.")
      return
    }

    setSubmitting(true)
    try {
      // 1. Re-validate current stock before submitting (dalam pcs, akun untuk multiplier kemasan)
      const productIds = [...new Set(cart.map((i) => i.productId))]
      const { data: stockData, error: stockErr } = await supabase
        .from("products")
        .select("id, stock")
        .in("id", productIds)
      if (stockErr) throw stockErr

      const stockMap = new Map((stockData || []).map((s) => [s.id, s.stock]))
      for (const item of cart) {
        const rawStock = stockMap.get(item.productId) ?? 0
        const pcsNeeded = item.quantity * item.multiplier
        if (pcsNeeded > rawStock) {
          const unitStock = item.multiplier > 0 ? Math.floor(rawStock / item.multiplier) : 0
          toast.error(`Stok ${item.name} (${item.unitName || "pcs"}) tidak mencukupi (tersisa ${unitStock}).`)
          setSubmitting(false)
          return
        }
      }

      // 2. Create the order
      const finalCustomerName = customerName.trim() || "Pelanggan Umum"
      const ewp = computeEWP(cart.map((i) => ({ qty: i.quantity, weight: i.timeWeight })))
      const { data: orderId, error: checkoutErr } = await supabase.rpc("checkout_order", {
        p_customer_name: finalCustomerName,
        p_ewp: ewp,
        p_items: cart.map((i) => ({
          product_id: i.productId,
          qty: i.quantity,
          unit_price: i.price,
          unit_id: i.unitId === BASE_UNIT_ID ? null : i.unitId,
          unit_name: i.unitName,
          multiplier: i.multiplier,
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice,
      })
      if (checkoutErr) throw checkoutErr

      // 3. Immediately finalize payment (walk-in = instant transaction)
      const { error: payErr } = await supabase.rpc("finalize_order_payment", {
        p_order_id: orderId,
        p_payment_method: paymentMethod === "tunai" ? "tunai" : "online",
        p_payment_channel: paymentMethod,
        p_staff_id: null,
      })
      if (payErr) throw payErr

      toast.success("Transaksi berhasil diselesaikan!")

      setLastOrder({
        id: orderId as string,
        order_number: null,
        created_at: new Date().toISOString(),
        customer_name: finalCustomerName,
        total_items: totalItems,
        total_price: totalPrice,
        payment_method: paymentMethod === "tunai" ? "tunai" : "online",
        payment_channel: paymentMethod,
        payment_amount: paidVal,
        change_amount: paymentMethod === "tunai" ? paidVal - totalPrice : 0,
        order_items: cart.map((i) => ({
          id: i.productId,
          qty: i.quantity,
          unit_price: i.price,
          unit_name: i.unitName,
          products: { 
            name: i.name,
            unit: i.unitName || "pcs"
          },
        })),
      })
      setReceiptOpen(true)

      // Reset for next transaction
      setCart([])
      setCustomerName("")
      setAmountPaid("")
      setPaymentMethod("tunai")
      fetchProducts()
    } catch (err: any) {
      toast.error("Gagal menyelesaikan transaksi: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">POS Walk-in / Kasir Langsung</h1>
            <p className="text-muted-foreground mt-1">
              Layani pelanggan yang datang langsung ke toko: pilih produk, checkout, dan cetak struk secara instan.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Katalog produk */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
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

              {loadingProducts ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat produk...</p>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filteredProducts.map((product) => {
                    const isMulti = !!product.is_multi_unit && product.product_units.length > 0
                    const activeUnit = getActiveUnit(product)
                    const effectiveStock = getEffectiveStock(product)
                    const effectivePrice = getEffectivePrice(product)
                    const outOfStock = effectiveStock <= 0
                    const cartQty = getCartQty(product)
                    const unitId = isMulti ? activeUnit?.id ?? null : null
                    return (
                      <div
                        key={product.id}
                        style={{ contentVisibility: "auto", containIntrinsicSize: "0 220px" } as React.CSSProperties}
                        className="rounded-lg border border-border/50 bg-card p-2 hover:border-primary/40 transition-colors flex flex-col"
                      >
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() => addToCart(product)}
                          className="text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="aspect-square w-full rounded-md bg-muted flex items-center justify-center overflow-hidden mb-2 relative">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <IconPhoto className="size-8 text-muted-foreground/50" />
                            )}
                            {isMulti && (
                              <span className="absolute top-1 right-1 rounded bg-primary/90 px-1 py-0.5 text-[8px] font-bold text-primary-foreground">
                                GROSIR
                              </span>
                            )}
                            {cartQty > 0 && (
                              <span className="absolute top-1 left-1 rounded-full bg-emerald-600 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white">
                                {cartQty}
                              </span>
                            )}
                          </div>
                          {product.categories?.name && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 mb-1 font-normal">
                              {product.categories.name}
                            </Badge>
                          )}
                          <h3 className="text-xs font-semibold leading-snug line-clamp-2 min-h-[2rem]">
                            {product.name}
                          </h3>
                          {product.sku && (
                            <p className="text-[9px] text-muted-foreground/70 mt-0.5 font-mono truncate">
                              {product.sku}
                            </p>
                          )}
                          <p className="text-sm font-bold text-primary mt-0.5">{formatRupiah(effectivePrice)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {outOfStock
                              ? "Stok habis"
                              : `Stok ${effectiveStock} ${isMulti ? activeUnit?.name || "unit" : product.unit || "pcs"}`}
                          </p>
                          {isMulti && activeUnit && activeUnit.id !== BASE_UNIT_ID && (
                            <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                              1 {activeUnit.name} = {activeUnit.multiplier} {product.unit || "pcs"}
                            </p>
                          )}
                        </button>

                        {isMulti && (
                          <Select
                            value={selectedUnit[product.id] || ""}
                            onValueChange={(val) =>
                              setSelectedUnit((prev) => ({ ...prev, [product.id]: val }))
                            }
                          >
                            <SelectTrigger className="h-6 text-[10px] mt-1.5 font-semibold border-primary/30">
                              <SelectValue placeholder="Pilih kemasan..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const baseUnit = getBaseUnit(product)
                                const baseOutOfStock = baseUnit.stock <= 0
                                return (
                                  <SelectItem
                                    value={baseUnit.id}
                                    disabled={baseOutOfStock}
                                    className={`text-[11px] ${baseOutOfStock ? "opacity-50 line-through" : ""}`}
                                  >
                                    {baseUnit.name} (Satuan Dasar)
                                  </SelectItem>
                                )
                              })()}
                              {product.product_units.map((unit) => {
                                const unitOutOfStock = unit.stock <= 0
                                return (
                                  <SelectItem
                                    key={unit.id}
                                    value={unit.id}
                                    disabled={unitOutOfStock}
                                    className={`text-[11px] ${unitOutOfStock ? "opacity-50 line-through" : ""}`}
                                  >
                                    {unit.name}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}

                        {cartQty > 0 ? (
                          <div className="flex items-center border border-primary/30 rounded-md mt-1.5 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 rounded-none"
                              onClick={() => updateQuantity(product.id, unitId, cartQty - 1)}
                            >
                              <IconMinus className="size-3" />
                            </Button>
                            <span className="flex-1 text-center text-xs font-semibold tabular-nums">{cartQty}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 rounded-none"
                              disabled={cartQty >= effectiveStock}
                              onClick={() => updateQuantity(product.id, unitId, cartQty + 1)}
                            >
                              <IconPlus className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={outOfStock}
                            onClick={() => addToCart(product)}
                            className="h-6 text-[10px] mt-1.5 disabled:opacity-50"
                          >
                            <IconPlus className="size-3 mr-1" /> Tambah
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Keranjang transaksi */}
            <Card className="border-border/50 shadow-md xl:sticky xl:top-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconShoppingCart className="size-5 text-primary" /> Keranjang
                  </CardTitle>
                  <CardDescription>{cart.length} produk dipilih</CardDescription>
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={handleClearCart}>
                    <IconTrashX className="size-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Klik produk di sebelah kiri untuk menambahkan ke keranjang.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={cartItemKey(item.productId, item.unitId)} className="flex items-center gap-2 border border-border/50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatRupiah(item.price)} / {item.unitName || "pcs"}
                          </p>
                        </div>
                        <div className="flex items-center border border-border rounded-md shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 rounded-none"
                            onClick={() => updateQuantity(item.productId, item.unitId, item.quantity - 1)}
                          >
                            <IconMinus className="size-3" />
                          </Button>
                          <span className="w-6 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 rounded-none"
                            disabled={item.quantity >= item.stockQty}
                            onClick={() => updateQuantity(item.productId, item.unitId, item.quantity + 1)}
                          >
                            <IconPlus className="size-3" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeFromCart(item.productId, item.unitId)}
                        >
                          <IconTrash className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="customerName" className="text-xs">Nama Pelanggan (opsional)</Label>
                  <Input
                    id="customerName"
                    placeholder="Pelanggan Umum"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Metode Pembayaran</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === "tunai" ? "default" : "outline"}
                      className="w-full text-xs font-semibold px-1"
                      onClick={() => setPaymentMethod("tunai")}
                      disabled={submitting}
                    >
                      Tunai / Cash
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "transfer" ? "default" : "outline"}
                      className="w-full text-xs font-semibold px-1"
                      onClick={() => setPaymentMethod("transfer")}
                      disabled={submitting}
                    >
                      Transfer Bank
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "qris" ? "default" : "outline"}
                      className="w-full text-xs font-semibold px-1"
                      onClick={() => setPaymentMethod("qris")}
                      disabled={submitting}
                    >
                      QRIS Digital
                    </Button>
                  </div>
                </div>

                {paymentMethod === "tunai" && (
                  <div className="space-y-2">
                    <Label htmlFor="amountPaid" className="text-xs">Uang Diterima (IDR)</Label>
                    <Input
                      id="amountPaid"
                      type="number"
                      placeholder="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                )}

                <div className="space-y-1.5 text-sm border-t pt-3">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Item</span>
                    <span className="font-semibold text-foreground">{totalItems} unit</span>
                  </div>
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Total Bayar</span>
                    <span className="font-bold text-lg text-primary">{formatRupiah(totalPrice)}</span>
                  </div>
                  {cart.length > 0 && (
                    <div className="flex justify-between items-center bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mt-2">
                      <span className="flex items-center gap-1.5 font-semibold text-primary text-xs">
                        <IconClock className="size-3.5" /> Estimasi Selesai
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {formatDuration(estimatedCompletionSeconds)}
                      </span>
                    </div>
                  )}
                  {paymentMethod === "tunai" && (
                    <div className="flex justify-between items-center bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mt-2">
                      <span className="font-semibold text-primary text-xs">Kembalian</span>
                      <span className={`text-sm font-bold ${calculatedChange < 0 ? "text-rose-500" : "text-primary"}`}>
                        {calculatedChange < 0 ? "Kurang bayar" : formatRupiah(calculatedChange)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full font-semibold"
                  size="lg"
                  disabled={
                    cart.length === 0 ||
                    submitting ||
                    (paymentMethod === "tunai" && (isNaN(parseFloat(amountPaid)) || parseFloat(amountPaid) < totalPrice))
                  }
                  onClick={handleCheckout}
                >
                  {submitting ? (
                    <>
                      <IconLoader2 className="mr-2 size-4 animate-spin" /> Memproses...
                    </>
                  ) : (
                    <>
                      <IconShoppingCartPlus className="size-4 mr-1.5" /> Selesaikan Transaksi
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Receipt Modal */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <IconPrinter className="size-5" /> Transaksi Selesai
              </DialogTitle>
              <DialogDescription>
                Cetak struk belanja thermal untuk diserahkan kepada pelanggan.
              </DialogDescription>
            </DialogHeader>

            {lastOrder && <Receipt order={lastOrder} />}

            <DialogFooter className="mt-4">
              <Button variant="outline" className="w-full" onClick={() => setReceiptOpen(false)}>
                Tutup & Transaksi Baru
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
