"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  IconShoppingCart,
  IconBuildingStore,
  IconPlus,
  IconMinus,
  IconTrash,
  IconArrowLeft,
  IconCreditCard,
  IconScale,
  IconPackage,
  IconLoader2,
  IconClock,
  IconCheck,
} from "@tabler/icons-react"

// ─── Types ────────────────────────────────────────────────────────────────────

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

const formatTime = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds} detik`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return remainingSeconds > 0 ? `${minutes} menit ${remainingSeconds} detik` : `${minutes} menit`
}

function CartContentComponent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const isCheckoutActive = searchParams.get("checkout") === "active"

  // Cart & loading states
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)

  // Checkout form states
  const [customerName, setCustomerName] = useState("")
  const [userProfileLoaded, setUserProfileLoaded] = useState(false)

  // ── Load Cart ──────────────────────────────────────────────────────────────
  const loadCart = () => {
    try {
      const stored = localStorage.getItem("pos_grosir_cart")
      if (stored) {
        setCart(JSON.parse(stored))
      } else {
        setCart([])
      }
    } catch (e) {
      setCart([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch customer profile name
  const fetchUserProfile = async () => {
    if (userProfileLoaded) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single()
        
        if (profile?.full_name) {
          setCustomerName(profile.full_name)
        } else {
          setCustomerName(session.user.email?.split("@")[0] || "Customer")
        }
        setUserProfileLoaded(true)
      }
    } catch (e) {
      setCustomerName("Pelanggan Grosir")
    }
  }

  useEffect(() => {
    loadCart()
    if (isCheckoutActive) {
      fetchUserProfile()
    }
  }, [isCheckoutActive])

  // ── Save Cart Helper ───────────────────────────────────────────────────────
  const saveCart = (updatedCart: CartItem[]) => {
    localStorage.setItem("pos_grosir_cart", JSON.stringify(updatedCart))
    setCart(updatedCart)
    window.dispatchEvent(new Event("storage"))
  }

  // ── Increment Qty ──────────────────────────────────────────────────────────
  const handleIncrement = (productId: string, unitId: string) => {
    const updated = cart.map((item) => {
      if (item.productId === productId && item.unitId === unitId) {
        const nextQty = item.quantity + 1
        const requiredBaseStock = nextQty * item.multiplier
        if (requiredBaseStock > item.stockQty) {
          toast.warning(`Stok tidak mencukupi! Batas maksimal stok adalah ${Math.floor(item.stockQty / item.multiplier)} ${item.unitName}.`)
          return item
        }
        return { ...item, quantity: nextQty }
      }
      return item
    })
    saveCart(updated)
  }

  // ── Decrement Qty ──────────────────────────────────────────────────────────
  const handleDecrement = (productId: string, unitId: string) => {
    const item = cart.find((i) => i.productId === productId && i.unitId === unitId)
    if (!item) return

    if (item.quantity <= 1) {
      handleRemove(productId, unitId)
      return
    }

    const updated = cart.map((i) => {
      if (i.productId === productId && i.unitId === unitId) {
        return { ...i, quantity: i.quantity - 1 }
      }
      return i
    })
    saveCart(updated)
  }

  // ── Remove Item ────────────────────────────────────────────────────────────
  const handleRemove = (productId: string, unitId: string) => {
    const item = cart.find((i) => i.productId === productId && i.unitId === unitId)
    if (!item) return

    if (confirm(`Hapus ${item.name} (${item.unitName}) dari keranjang?`)) {
      const updated = cart.filter((i) => !(i.productId === productId && i.unitId === unitId))
      saveCart(updated)
      toast.success(`${item.name} (${item.unitName}) dihapus dari keranjang.`)
    }
  }

  // ── Totals Calculation ─────────────────────────────────────────────────────
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Rumus EWP: sum(Q_i * W_i)
  const totalEwpSeconds = cart.reduce((sum, item) => sum + (item.quantity * item.pickupTimeSeconds), 0)

  // ── Open Checkout Form ─────────────────────────────────────────────────────
  const handleCheckoutInit = () => {
    if (cart.length === 0) return
    router.push("/customer/cart?checkout=active")
  }

  // ── Process Checkout ───────────────────────────────────────────────────────
  const handleCheckoutConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0 || checkingOut) return

    const trimmedName = customerName.trim()
    if (!trimmedName) {
      toast.error("Nama penerima pesanan tidak boleh kosong")
      return
    }

    setCheckingOut(true)
    try {
      // 1. Ambil session user id
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        toast.error("Sesi login berakhir. Silakan login kembali.")
        router.push("/login")
        return
      }

      // 2. VALIDASI STOK AKHIR: Cek ketersediaan stok riil di database tabel products
      const productIds = Array.from(new Set(cart.map(item => item.productId)))
      const { data: dbProducts, error: stockCheckErr } = await supabase
        .from("products")
        .select("id, stock_qty")
        .in("id", productIds)

      if (stockCheckErr) throw stockCheckErr

      for (const item of cart) {
        const dbProd = dbProducts?.find(p => p.id === item.productId)
        const currentBaseStock = dbProd ? (dbProd.stock_qty || 0) : 0
        const requiredBaseQty = item.quantity * item.multiplier

        if (currentBaseStock < requiredBaseQty) {
          toast.error(`Gagal Checkout: Stok produk "${item.name}" baru saja berubah di sistem dan tidak mencukupi. Silakan sesuaikan keranjang belanja Anda.`)
          setCheckingOut(false)
          
          // Update stockQty lokal
          const updated = cart.map(c => {
            if (c.productId === item.productId) {
              return { ...c, stockQty: currentBaseStock }
            }
            return c
          })
          saveCart(updated)
          return
        }
      }

      // 3. PANGGIL RPC checkout_order
      const { data: orderId, error: checkoutErr } = await supabase.rpc("checkout_order", {
        p_customer_name: trimmedName,
        p_ewp: totalEwpSeconds,
        p_items: cart.map(item => ({
          product_id: item.productId,
          qty: item.quantity * item.multiplier, // Kuantitas unit dasar (pcs)
          unit_price: item.price / item.multiplier // Harga satuan unit dasar (pcs)
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice
      })

      if (checkoutErr) throw checkoutErr

      if (orderId) {
        // KOSONGKAN KERANJANG
        localStorage.removeItem("pos_grosir_cart")
        setCart([])
        window.dispatchEvent(new Event("storage"))

        toast.success(`Pesanan #${orderId.substring(0, 8).toUpperCase()} berhasil dibuat!`)
        router.push("/customer/orders")
      }
    } catch (err: any) {
      toast.error("Gagal memproses pesanan: " + err.message)
    } finally {
      setCheckingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] space-y-4">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Memuat keranjang Anda...</p>
      </div>
    )
  }

  // ── Render Form Checkout ───────────────────────────────────────────────────
  if (isCheckoutActive && cart.length > 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Checkout */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <IconCreditCard className="size-5 text-primary" />
                Informasi Penerima Pesanan
              </CardTitle>
              <CardDescription>
                Tulis nama lengkap penerima untuk keperluan pengambilan barang di gudang.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCheckoutConfirm}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Nama Penerima / Pengambil Barang</Label>
                  <Input
                    id="receiverName"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    required
                    disabled={checkingOut}
                    maxLength={100}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nama ini akan dipanggil oleh kasir dan staff gudang saat penyiapan & pengambilan barang.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="border-t pt-4 flex justify-between gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/customer/cart")}
                  disabled={checkingOut}
                >
                  <IconArrowLeft className="size-4 mr-1.5" />
                  Kembali
                </Button>
                <Button type="submit" disabled={checkingOut} className="font-bold">
                  {checkingOut ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses Pesanan...
                    </>
                  ) : (
                    <>
                      <IconCheck className="size-4 mr-1.5" />
                      Konfirmasi & Buat Pesanan
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Card Item Preview */}
          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <IconPackage className="size-4 text-muted-foreground" />
                Review Item Pesanan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-center w-24">Jumlah</TableHead>
                    <TableHead className="text-right">Total Harga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={`${item.productId}-${item.unitId}`} className="hover:bg-transparent">
                      <TableCell className="text-sm font-semibold">
                        {item.name} <span className="text-xs text-muted-foreground font-normal">({item.unitName})</span>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {item.quantity} {item.unitName}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-primary">
                        {formatRupiah(item.price * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Rincian Biaya & Waktu */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IconClock className="size-4 text-primary" />
                Estimasi Penyiapan
              </CardTitle>
              <CardDescription>Perkiraan waktu pengambilan fisik barang di toko</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <IconClock className="size-5 shrink-0" />
                  <span>Estimasi Waktu Proses (EWP)</span>
                </div>
                <p className="text-xs leading-relaxed">
                  EWP dihitung secara linear berdasarkan unit kemasan barang belanjaan Anda:
                </p>
                <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {formatTime(totalEwpSeconds)}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Kuantitas:</span>
                  <span className="font-semibold">{totalItems} kemasan</span>
                </div>
              </div>

              <Separator />

              {/* Grand Total */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Total Tagihan Pembayaran:</span>
                <p className="text-2xl font-black text-primary">
                  {formatRupiah(totalPrice)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Render Tabel Keranjang (Default) ───────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
        <IconShoppingCart className="size-16 text-muted-foreground/35 mb-3" />
        <h3 className="font-semibold text-lg">Keranjang Belanja Kosong</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
          Anda belum menambahkan barang apapun ke keranjang belanja Anda.
        </p>
        <Button asChild>
          <Link href="/customer/shop">Mulai Belanja</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Cart Table */}
      <div className="lg:col-span-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IconPackage className="size-4 text-primary" />
              Item Keranjang
            </CardTitle>
            <CardDescription>
              Review dan sesuaikan kuantitas barang belanjaan Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-center w-32">Jumlah</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-center w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={`${item.productId}-${item.unitId}`} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-10 w-10 rounded object-cover border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted/60 flex items-center justify-center border text-muted-foreground/50">
                              <IconBuildingStore className="size-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold leading-tight">{item.name}</p>
                            <Badge variant="secondary" className="text-[10px] mt-1 font-bold">
                              {item.unitName}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right text-sm font-semibold whitespace-nowrap">
                        {formatRupiah(item.price)}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md"
                            onClick={() => handleDecrement(item.productId, item.unitId)}
                          >
                            <IconMinus className="size-3.5" />
                          </Button>
                          <span className="text-sm font-bold w-6">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md"
                            onClick={() => handleIncrement(item.productId, item.unitId)}
                            disabled={item.quantity * item.multiplier >= item.stockQty}
                          >
                            <IconPlus className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-extrabold text-sm whitespace-nowrap text-primary">
                        {formatRupiah(item.price * item.quantity)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => handleRemove(item.productId, item.unitId)}
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Order Summary */}
      <div className="lg:col-span-1">
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconCreditCard className="size-4 text-primary" />
              Ringkasan Belanja
            </CardTitle>
            <CardDescription>Rincian harga dan estimasi waktu penyiapan</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Item Kemasan:</span>
              <span className="font-semibold">{totalItems} kemasan</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <IconClock className="size-3.5" />
                Estimasi EWP:
              </span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 font-bold">
                {formatTime(totalEwpSeconds)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between items-baseline pt-2">
              <span className="font-semibold text-sm">Total Pembayaran:</span>
              <span className="text-2xl font-black text-primary">
                {formatRupiah(totalPrice)}
              </span>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/50">
            <Button
              onClick={handleCheckoutInit}
              className="w-full font-bold shadow-md"
              size="lg"
            >
              Checkout Sekarang
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function CustomerCartPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] space-y-4">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Memuat halaman keranjang...</p>
      </div>
    }>
      <CartContentComponent />
    </Suspense>
  )
}
