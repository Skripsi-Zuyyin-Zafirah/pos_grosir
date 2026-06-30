"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { toast } from "sonner"
import {
  IconLoader2,
  IconSearch,
  IconDashboard,
  IconLogout,
  IconPackage,
  IconPhoto,
  IconShoppingCart,
  IconTrash,
  IconPlus,
  IconMinus,
  IconClock,
  IconHistory,
  IconSparkles,
  IconChevronDown,
  IconCheck,
  IconCpu,
  IconChartBar,
  IconBolt
} from "@tabler/icons-react"
import { computeECT, type ECTParams } from "@/lib/ect/calculate"

type Product = {
  id: string
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
  inventory?: {
    stock_qty: number
    reorder_level: number
  }[] | null
}

type Category = {
  id: string
  name: string
}

type CartItem = {
  id: string
  name: string
  price: number
  unit: string | null
  weight: number
  quantity: number
  maxStock: number
}

export default function CatalogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([])
  const [ectParams, setEctParams] = useState<ECTParams>({ t_base: 2.0, t_pick: 1.5, t_pack: 0.2 })
  const [customerName, setCustomerName] = useState("")
  const [checkingOut, setCheckingOut] = useState(false)

  // Auth State
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string>("")

  const fetchAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single()
      if (profile) {
        setUserRole(profile.role)
        setProfileName(profile.full_name || "User")
        setCustomerName(profile.full_name || "")
      }
    } else {
      setUser(null)
      setUserRole(null)
      setProfileName("")
      setCustomerName("")
    }
  }

  const fetchCatalog = async () => {
    try {
      setLoading(true)
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      // Fetch products and join inventories and categories
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("*, categories:category_id ( name ), inventory:inventory ( stock_qty, reorder_level )")
        .order("name")

      if (prodErr) throw prodErr
      setProducts(prodData || [])
    } catch (err: any) {
      toast.error("Gagal memuat katalog: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const settings = await response.json()
        const params: ECTParams = { t_base: 2.0, t_pick: 1.5, t_pack: 0.2 }
        settings.forEach((s: any) => {
          if (s.key === "t_base") params.t_base = Number(s.value)
          if (s.key === "t_pick") params.t_pick = Number(s.value)
          if (s.key === "t_pack") params.t_pack = Number(s.value)
        })
        setEctParams(params)
      }
    } catch (err) {
      console.error("Gagal memuat parameter ECT:", err)
    }
  }

  useEffect(() => {
    fetchAuth()
    fetchCatalog()
    fetchSettings()
  }, [])

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success("Berhasil keluar.")
      fetchAuth()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Add to Shopping Cart Drawer helper
  const addToCart = (product: Product) => {
    const inv = product.inventory?.[0]
    const stock = inv ? inv.stock_qty : 0

    if (stock <= 0) {
      toast.error("Stok barang habis!")
      return
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id)
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(`Kuantitas melebihi stok tersedia (${stock} pcs)`)
          return prevCart;
        }
        toast.success(`Menambahkan kuantitas ${product.name}.`)
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }

      toast.success(`Produk ${product.name} dimasukkan ke keranjang.`)
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          weight: product.weight || 0,
          quantity: 1,
          maxStock: stock,
        },
      ]
    })
  }

  const updateCartQty = (id: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta
            if (nextQty > item.maxStock) {
              toast.error(`Batas stok terlampaui (${item.maxStock} pcs)`)
              return item
            }
            return { ...item, quantity: nextQty }
          }
          return item
        })
        .filter((item) => item.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id))
    toast.success("Produk dihapus dari keranjang.")
  }

  // ECT & Price Totals
  const calculatedEct = computeECT(cart, ectParams)
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + item.quantity * item.price, 0)

  // Checkout submission
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return
    if (!customerName.trim()) {
      toast.error("Nama pelanggan harus diisi")
      return
    }

    setCheckingOut(true)

    try {
      // Execute atomic checkout via database RPC function
      const { data: orderId, error } = await supabase.rpc("checkout_order", {
        p_customer_name: customerName,
        p_ewp: calculatedEct,
        p_items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice,
      })

      if (error) throw error

      toast.success("Pemesanan berhasil dibuat!")
      setCart([])
      router.push("/customer/orders")
    } catch (err: any) {
      toast.error("Gagal melakukan checkout: " + err.message)
    } finally {
      setCheckingOut(false)
    }
  }

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  const scrollToCatalog = () => {
    document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="min-h-svh bg-background relative flex flex-col overflow-x-hidden selection:bg-indigo-500/20">
      {/* MagicUI SVG Dot Grid Mask Overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:16px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Radial colorful light blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[450px] w-[700px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 blur-[130px] rounded-full" />

      {/* Header bar (Glassmorphism) */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black shadow-md group-hover:scale-105 transition-transform">
              PG
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-900 to-purple-800 dark:from-indigo-100 dark:to-purple-200 bg-clip-text text-transparent">
              POS Grosir Jasa
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-right hidden md:block">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {userRole === "admin" ? "Admin" : userRole === "cashier" ? "Kasir" : "Pelanggan"}
                  </p>
                  <p className="text-xs font-semibold">{profileName}</p>
                </div>
                <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold">
                  <Link href="/customer/orders">
                    <IconHistory className="size-3.5 mr-1" /> <span className="hidden sm:inline">Pesanan Saya</span>
                  </Link>
                </Button>
                {userRole === "admin" || userRole === "cashier" ? (
                  <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold">
                    <Link href="/dashboard">
                      <IconDashboard className="size-3.5 mr-1" /> <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 text-xs">
                  <IconLogout className="size-3.5 sm:mr-1" /> <span className="hidden sm:inline">Keluar</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-semibold">
                  <Link href="/login">Masuk</Link>
                </Button>
                <Button size="sm" asChild className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                  <Link href="/register">Daftar</Link>
                </Button>
              </div>
            )}

            {/* Shopping Cart Drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative size-9 border-border/50 hover:bg-muted/40">
                  <IconShoppingCart className="size-4 text-foreground/80" />
                  {totalItems > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px] bg-indigo-600 text-white border-none font-bold">
                      {totalItems}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col justify-between border-l border-border/50 bg-background/95 backdrop-blur-md">
                <div>
                  <SheetHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="flex items-center gap-2 text-lg font-extrabold text-foreground">
                        <IconShoppingCart className="size-5 text-indigo-500" /> Keranjang Belanja
                      </SheetTitle>
                    </div>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto py-4 space-y-4 max-h-[55vh] pr-1">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                        <IconShoppingCart className="size-14 text-muted-foreground/30 mb-2" />
                        <p className="text-sm font-semibold">Keranjang belanja kosong</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">Tambahkan produk dari katalog di bawah.</p>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.id} className="flex gap-3 items-start justify-between border-b border-border/30 pb-3">
                          <div className="flex-1">
                            <p className="font-bold text-sm text-foreground line-clamp-1">{item.name}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                              {formatRupiah(item.price)} / {item.unit || "pcs"}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateCartQty(item.id, -1)}
                                className="size-7 border-border/60"
                              >
                                <IconMinus className="size-3" />
                              </Button>
                              <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateCartQty(item.id, 1)}
                                className="size-7 border-border/60"
                              >
                                <IconPlus className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                              {formatRupiah(item.price * item.quantity)}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.id)}
                              className="size-7 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                            >
                              <IconTrash className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {cart.length > 0 && (
                  <div className="border-t border-border/50 pt-4 space-y-4">
                    {/* Live ECT Wait Estimate */}
                    <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3.5">
                      <div className="flex items-center gap-2.5">
                        <IconClock className="size-5 text-indigo-500 animate-pulse" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Estimasi Waktu Tunggu (ECT)</p>
                          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{calculatedEct} menit</p>
                        </div>
                      </div>
                      <Badge className="bg-indigo-500 text-white font-bold border-none text-[10px]">
                        SJF Prioritas
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Item:</span>
                        <span className="font-semibold text-foreground">{totalItems} unit</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border/30 pt-2 font-bold">
                        <span>Total Tagihan:</span>
                        <span className="text-base text-indigo-600 dark:text-indigo-400 font-extrabold">{formatRupiah(totalPrice)}</span>
                      </div>
                    </div>

                    <form onSubmit={handleCheckout} className="space-y-3 pb-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="custName" className="text-xs">Nama Pelanggan / Toko Pemesan</Label>
                        <Input
                          id="custName"
                          placeholder="Nama Anda atau Nama Toko..."
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          disabled={checkingOut}
                          className="bg-background border-border/50 h-9"
                        />
                      </div>
                      <Button type="submit" className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs" disabled={checkingOut}>
                        {checkingOut ? (
                          <>
                            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                            Mengirim Pesanan...
                          </>
                        ) : (
                          "Kirim Pesanan"
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section - MagicUI Theme */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden border-b border-border/30">
        <div className="container mx-auto px-4 flex flex-col items-center text-center space-y-6 max-w-4xl">
          <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1 text-xs gap-1.5 rounded-full shadow-sm">
            <IconSparkles className="size-3.5 animate-spin" /> Next-Gen Priority Queue System
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-foreground">
            Optimasi Antrean Gudang <br className="hidden sm:inline" />
            Secara <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x">Cerdas & Real-Time</span>
          </h1>
          
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
            Sistem POS Grosir pintar yang menyusun antrian gudang secara dinamis menggunakan algoritma 
            <strong> Shortest Job First (SJF) dengan Anti-Starvation Aging</strong> berbasis estimasi waktu kemas (ECT).
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center w-full max-w-md">
            <Button onClick={scrollToCatalog} size="lg" className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md text-sm h-11">
              Mulai Belanja <IconChevronDown className="size-4 ml-1" />
            </Button>
            <Button variant="outline" size="lg" asChild className="font-bold border-border/50 text-sm h-11">
              <Link href="/login">Masuk Dashboard</Link>
            </Button>
          </div>

          {/* Bento-style Features widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-16 text-left">
            <div className="p-5 border border-border/50 bg-background/50 backdrop-blur-md rounded-2xl flex flex-col space-y-2 shadow-sm hover:border-indigo-500/20 transition-colors">
              <div className="size-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                <IconCpu className="size-5" />
              </div>
              <h3 className="font-bold text-sm">Algoritma Min-Heap</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Penyusunan antrean terurut instan $O(\log n)$ yang selalu memprioritaskan pesanan efisien dengan parameter aging.
              </p>
            </div>
            <div className="p-5 border border-border/50 bg-background/50 backdrop-blur-md rounded-2xl flex flex-col space-y-2 shadow-sm hover:border-indigo-500/20 transition-colors">
              <div className="size-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center">
                <IconBolt className="size-5" />
              </div>
              <h3 className="font-bold text-sm">Estimasi ECT & EWP</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Perhitungan otomatis sisa waktu tunggu berdasarkan jumlah SKU, total barang, dan berat fisik kiriman.
              </p>
            </div>
            <div className="p-5 border border-border/50 bg-background/50 backdrop-blur-md rounded-2xl flex flex-col space-y-2 shadow-sm hover:border-indigo-500/20 transition-colors">
              <div className="size-10 bg-pink-500/10 text-pink-500 rounded-xl flex items-center justify-center">
                <IconChartBar className="size-5" />
              </div>
              <h3 className="font-bold text-sm">Evaluasi FIFO vs PQ</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Grafik performa langsung membandingkan efisiensi antrean, sensitivitas parameter, dan simulasi beban acak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main id="catalog-section" className="container mx-auto px-4 py-16 flex-1 flex flex-col space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/30 pb-6">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Katalog Produk Grosir</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Pilih produk dan masukkan keranjang belanja untuk memulai proses antrian gudang.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/50 h-10"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full text-xs h-8.5 font-bold ${selectedCategory === "all" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-border/60"}`}
          >
            Semua Kategori
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full text-xs h-8.5 font-bold ${selectedCategory === cat.id ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-border/60"}`}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Grid Products List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-muted-foreground text-sm">Memuat katalog barang...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl bg-background/50">
            <IconPackage className="size-14 text-muted-foreground/50 mb-2" />
            <h3 className="font-semibold text-lg">Produk Tidak Ditemukan</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Tidak ada produk yang cocok dengan kata kunci pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const inv = product.inventory?.[0]
              const stock = inv ? inv.stock_qty : 0
              const threshold = inv ? inv.reorder_level : 0

              let badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
              let badgeText = "Tersedia"

              if (stock <= 0) {
                badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/25"
                badgeText = "Stok Habis"
              } else if (stock <= threshold) {
                badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                badgeText = "Stok Terbatas"
              }

              return (
                <Card key={product.id} className="border-border/40 shadow-sm flex flex-col justify-between overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-300 bg-background/50 backdrop-blur-sm group">
                  <div>
                    {/* Image section */}
                    <div className="relative aspect-video w-full bg-muted/30 flex items-center justify-center border-b border-border/40 overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <IconPhoto className="size-10 text-muted-foreground/40 group-hover:scale-105 transition-transform duration-500" />
                      )}
                      <Badge className={`absolute top-2.5 right-2.5 border font-bold text-[10px] ${badgeColor}`}>
                        {badgeText}
                      </Badge>
                    </div>

                    <CardHeader className="p-4 pb-2">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        {product.categories?.name || "Kategori"}
                      </p>
                      <CardTitle className="text-base font-extrabold line-clamp-1 mt-0.5 text-foreground/90">
                        {product.name}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground/80 min-h-[50px] leading-relaxed">
                      <p className="line-clamp-2">{product.description || "Tidak ada deskripsi produk."}</p>
                    </CardContent>
                  </div>

                  <CardFooter className="p-4 border-t border-border/40 flex flex-col gap-3 bg-muted/5">
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Harga ({product.unit || "pcs"})</p>
                        <p className="text-base font-extrabold text-foreground">{formatRupiah(product.price)}</p>
                      </div>
                      {product.weight && (
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 border-border/50">
                          {product.weight} kg
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => addToCart(product)}
                      disabled={stock <= 0}
                      className={`w-full text-xs font-bold h-9 shadow-sm ${stock > 0 ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      Tambah Ke Keranjang
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/50 backdrop-blur-md py-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} POS Grosir Jasa. Dibuat dengan Gaya MagicUI untuk Keperluan Evaluasi & Skripsi.
        </div>
      </footer>
    </div>
  )
}
