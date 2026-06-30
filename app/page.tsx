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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet"
import { toast } from "sonner"
import { IconLoader2, IconSearch, IconLogin, IconDashboard, IconLogout, IconPackage, IconPhoto, IconShoppingCart, IconTrash, IconPlus, IconMinus, IconClock, IconHistory } from "@tabler/icons-react"
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

      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("*, categories:category_id ( name ), inventory ( stock_qty, reorder_level )")
        .order("name")
      if (prodErr) throw prodErr
      setProducts(prodData || [])
    } catch (err: any) {
      toast.error("Gagal memuat katalog: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchEctParams = async () => {
    try {
      const res = await fetch("/api/settings")
      if (res.ok) {
        const data = await res.json()
        setEctParams(data)
      }
    } catch (err) {
      console.error("Gagal mengambil parameter ECT:", err)
    }
  }

  useEffect(() => {
    fetchAuth()
    fetchCatalog()
    fetchEctParams()
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Anda berhasil keluar.")
      setUser(null)
      setUserRole(null)
      setProfileName("")
      setCustomerName("")
      router.refresh()
    } catch (err: any) {
      toast.error("Gagal keluar: " + err.message)
    }
  }

  // Cart operations
  const addToCart = (product: Product) => {
    const inv = product.inventory?.[0]
    const stock = inv ? inv.stock_qty : 0

    if (stock <= 0) {
      toast.error("Produk habis!")
      return
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id)
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(`Maksimum stok tersedia: ${stock} ${product.unit}`)
          return prevCart
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      toast.success(`${product.name} dimasukkan ke keranjang.`)
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          weight: Number(product.weight) || 0,
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
              toast.error(`Maksimum stok tersedia: ${item.maxStock} ${item.unit}`)
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

  return (
    <div className="min-h-svh bg-muted/30 flex flex-col">
      {/* Header bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              PG
            </div>
            <span className="font-bold text-lg tracking-tight">POS Grosir Jasa</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {userRole === "admin" ? "Admin" : userRole === "cashier" ? "Kasir" : "Pelanggan"}
                  </p>
                  <p className="text-xs font-medium">{profileName}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/customer/orders">
                    <IconHistory className="size-4 mr-1.5" /> <span className="hidden sm:inline">Pesanan Saya</span>
                  </Link>
                </Button>
                {userRole === "admin" || userRole === "cashier" ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard">
                      <IconDashboard className="size-4 mr-1.5" /> <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <IconLogout className="size-4 sm:mr-1.5" /> <span className="hidden sm:inline">Keluar</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Masuk</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Daftar</Link>
                </Button>
              </div>
            )}

            {/* Shopping Cart Drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative size-9">
                  <IconShoppingCart className="size-4" />
                  {totalItems > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center p-0 text-[10px]">
                      {totalItems}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col justify-between">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-lg font-bold">
                    <IconShoppingCart className="size-5" /> Keranjang Belanja
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
                      <IconShoppingCart className="size-16 text-muted-foreground/40 mb-2" />
                      <p className="text-sm font-medium">Keranjang belanja Anda kosong.</p>
                      <p className="text-xs mt-1">Tambahkan produk dari katalog untuk memesan.</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="flex gap-3 items-start justify-between border-b pb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm line-clamp-1">{item.name}</p>
                          <p className="text-xs text-muted-foreground font-semibold">
                            {formatRupiah(item.price)} / {item.unit || "pcs"}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateCartQty(item.id, -1)}
                              className="size-7"
                            >
                              <IconMinus className="size-3" />
                            </Button>
                            <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateCartQty(item.id, 1)}
                              className="size-7"
                            >
                              <IconPlus className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <p className="font-bold text-sm text-primary">
                            {formatRupiah(item.price * item.quantity)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.id)}
                            className="size-7 text-destructive hover:bg-destructive/10"
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="border-t pt-4 space-y-4">
                    {/* Live ECT Wait Estimate */}
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-3.5">
                      <div className="flex items-center gap-2">
                        <IconClock className="size-5 text-primary animate-pulse" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Estimasi Waktu Tunggu (ECT)</p>
                          <p className="text-lg font-bold text-primary">{calculatedEct} menit</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-primary/20 text-primary font-semibold">
                        SJF Prioritas
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Item:</span>
                        <span className="font-semibold">{totalItems} unit</span>
                      </div>
                      <div className="flex justify-between text-base border-t pt-2">
                        <span className="font-semibold">Total Pembayaran:</span>
                        <span className="font-bold text-lg text-primary">{formatRupiah(totalPrice)}</span>
                      </div>
                    </div>

                    <form onSubmit={handleCheckout} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="custName">Nama Pelanggan / Pemesan</Label>
                        <Input
                          id="custName"
                          placeholder="Nama Anda atau Nama Toko..."
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          disabled={checkingOut}
                          className="bg-background"
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={checkingOut}>
                        {checkingOut ? (
                          <>
                            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                            Memproses Checkout...
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

      {/* Main Container */}
      <main className="container mx-auto px-4 py-8 flex-1 flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Katalog Produk Grosir</h2>
            <p className="text-muted-foreground text-sm">
              Temukan barang grosir pilihan Anda dengan info stok real-time.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className="rounded-full text-xs h-8"
          >
            Semua Kategori
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="rounded-full text-xs h-8"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Grid Products List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Memuat katalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
            <IconPackage className="size-16 text-muted-foreground/60 mb-2" />
            <h3 className="font-semibold text-lg">Produk Tidak Ditemukan</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Tidak ada produk yang cocok dengan pencarian atau filter Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const inv = product.inventory?.[0]
              const stock = inv ? inv.stock_qty : 0
              const threshold = inv ? inv.reorder_level : 0

              let badgeColor = "bg-emerald-500 hover:bg-emerald-600"
              let badgeText = "Tersedia"

              if (stock <= 0) {
                badgeColor = "bg-rose-500 hover:bg-rose-600"
                badgeText = "Habis"
              } else if (stock <= threshold) {
                badgeColor = "bg-amber-500 hover:bg-amber-600"
                badgeText = "Stok Terbatas"
              }

              return (
                <Card key={product.id} className="border-border/50 shadow-md flex flex-col justify-between overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-background">
                  <div>
                    {/* Image section */}
                    <div className="relative aspect-video w-full bg-muted flex items-center justify-center border-b border-border">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <IconPhoto className="size-10 text-muted-foreground/60" />
                      )}
                      <Badge className={`absolute top-2 right-2 border-none ${badgeColor}`}>
                        {badgeText}
                      </Badge>
                    </div>

                    <CardHeader className="p-4 pb-2">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        {product.categories?.name || "Kategori"}
                      </p>
                      <CardTitle className="text-base font-bold line-clamp-1 mt-0.5">
                        {product.name}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 text-sm text-muted-foreground min-h-[50px]">
                      <p className="line-clamp-2">{product.description || "Tidak ada deskripsi produk."}</p>
                    </CardContent>
                  </div>

                  <CardFooter className="p-4 border-t border-border/50 flex flex-col gap-3 bg-muted/10">
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Harga ({product.unit || "pcs"})</p>
                        <p className="text-base font-bold text-primary">{formatRupiah(product.price)}</p>
                      </div>
                      {product.weight && (
                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-border">
                          {product.weight} kg
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => addToCart(product)}
                      disabled={stock <= 0}
                      className="w-full text-xs h-9"
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
      <footer className="border-t border-border bg-background py-6">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} POS Grosir Jasa. Dibuat untuk Keperluan Evaluasi & Skripsi.
        </div>
      </footer>
    </div>
  )
}
