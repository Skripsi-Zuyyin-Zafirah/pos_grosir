"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Receipt } from "@/components/receipt"
import { toast } from "sonner"
import {
  IconLoader2,
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

type Product = {
  id: string
  sku: string | null
  name: string
  price: number
  stock_qty: number
  image_url: string | null
  category_id: string | null
  categories: { name: string } | null
}

type Category = {
  id: string
  name: string
}

type CartItem = {
  productId: string
  name: string
  price: number
  stockQty: number
  quantity: number
}

type ReceiptOrder = {
  id: string
  order_number: string | null
  created_at: string
  customer_name: string | null
  total_items: number
  total_price: number
  payment_method?: string
  payment_amount?: number
  change_amount?: number
  order_items: {
    id: string
    qty: number
    unit_price: number
    products: { name: string } | null
  }[]
}

export default function PosWalkinPage() {
  const supabase = createClient()

  // Product catalog state
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

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
        .select("*, categories:category_id ( name )")
        .order("name")
      if (prodErr) throw prodErr
      setProducts((prodData as any) || [])
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

  const addToCart = (product: Product) => {
    const stock = product.stock_qty ?? 0
    if (stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(`Stok ${product.name} tidak mencukupi.`)
          return prev
        }
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, stockQty: stock, quantity: 1 }]
    })
  }

  // Keep the "amount paid" field pre-filled with the running total so cashiers
  // aren't blocked by an empty/stale value when they hit checkout.
  useEffect(() => {
    if (paymentMethod === "tunai") {
      setAmountPaid(totalPrice > 0 ? totalPrice.toString() : "")
    }
  }, [totalPrice, paymentMethod])

  const updateQuantity = (productId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((i) => i.productId !== productId)
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(qty, i.stockQty) } : i))
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
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
      // 1. Re-validate current stock before submitting
      const productIds = cart.map((i) => i.productId)
      const { data: stockData, error: stockErr } = await supabase
        .from("products")
        .select("id, stock_qty")
        .in("id", productIds)
      if (stockErr) throw stockErr

      const stockMap = new Map((stockData || []).map((s) => [s.id, s.stock_qty]))
      for (const item of cart) {
        const available = stockMap.get(item.productId) ?? 0
        if (item.quantity > available) {
          toast.error(`Stok ${item.name} tidak mencukupi (tersisa ${available}).`)
          setSubmitting(false)
          return
        }
      }

      // 2. Create the order
      const finalCustomerName = customerName.trim() || "Pelanggan Umum"
      const { data: orderId, error: checkoutErr } = await supabase.rpc("checkout_order", {
        p_customer_name: finalCustomerName,
        p_ewp: 0,
        p_items: cart.map((i) => ({
          product_id: i.productId,
          qty: i.quantity,
          unit_price: i.price,
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice,
      })
      if (checkoutErr) throw checkoutErr

      // 3. Immediately finalize payment (walk-in = instant transaction)
      const { error: payErr } = await supabase.rpc("finalize_order_payment", {
        p_order_id: orderId,
        p_payment_method: paymentMethod,
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
        payment_method: paymentMethod,
        payment_amount: paidVal,
        change_amount: paymentMethod === "tunai" ? paidVal - totalPrice : 0,
        order_items: cart.map((i) => ({
          id: i.productId,
          qty: i.quantity,
          unit_price: i.price,
          products: { name: i.name },
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {filteredProducts.map((product) => {
                    const stock = product.stock_qty ?? 0
                    const outOfStock = stock <= 0
                    return (
                      <Card
                        key={product.id}
                        size="sm"
                        className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-2"
                        onClick={() => addToCart(product)}
                      >
                        <div className="aspect-square w-full bg-muted flex items-center justify-center relative overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <IconPhoto className="size-8 text-muted-foreground/50" />
                          )}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] flex items-center justify-center">
                              <Badge variant="destructive" className="text-[10px] font-semibold px-1.5 py-0">
                                Habis
                              </Badge>
                            </div>
                          )}
                        </div>
                        <CardHeader className="pb-0 gap-1">
                          <h3 className="font-semibold text-xs leading-snug line-clamp-2 min-h-[2rem]">
                            {product.name}
                          </h3>
                          <p className="text-sm font-bold text-primary">{formatRupiah(product.price)}</p>
                        </CardHeader>
                        <CardContent className="pb-2 mt-auto">
                          <p className="text-[10px] text-muted-foreground">
                            Stok: <span className="font-semibold">{outOfStock ? "Habis" : `${stock} pcs`}</span>
                          </p>
                        </CardContent>
                      </Card>
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
                      <div key={item.productId} className="flex items-center gap-2 border border-border/50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatRupiah(item.price)} / pcs</p>
                        </div>
                        <div className="flex items-center border border-border rounded-md shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 rounded-none"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
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
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          >
                            <IconPlus className="size-3" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeFromCart(item.productId)}
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
                  <Select
                    value={paymentMethod}
                    onValueChange={(val) => {
                      setPaymentMethod(val as any)
                      if (val !== "tunai") setAmountPaid(totalPrice.toString())
                    }}
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">Tunai / Cash</SelectItem>
                      <SelectItem value="transfer">Transfer Bank</SelectItem>
                      <SelectItem value="qris">QRIS Digital</SelectItem>
                    </SelectContent>
                  </Select>
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
