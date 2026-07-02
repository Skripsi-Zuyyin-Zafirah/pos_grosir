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
  name: string
  price: number
  unit: string | null
  weight: number | null
  quantity: number
  stockQty: number
  imageUrl: string | null
}

type SystemSettings = {
  t_base: number
  t_pick: number
  t_pack: number
  queue_mode: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)

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
      // Fallback
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
  const handleIncrement = (productId: string) => {
    const updated = cart.map((item) => {
      if (item.productId === productId) {
        if (item.quantity >= item.stockQty) {
          toast.warning(`Stok tidak mencukupi! Batas maksimal stok adalah ${item.stockQty} ${item.unit || 'pcs'}.`)
          return item
        }
        return { ...item, quantity: item.quantity + 1 }
      }
      return item
    })
    saveCart(updated)
  }

  // ── Decrement Qty ──────────────────────────────────────────────────────────
  const handleDecrement = (productId: string) => {
    const item = cart.find((i) => i.productId === productId)
    if (!item) return

    if (item.quantity <= 1) {
      handleRemove(productId)
      return
    }

    const updated = cart.map((i) => {
      if (i.productId === productId) {
        return { ...i, quantity: i.quantity - 1 }
      }
      return i
    })
    saveCart(updated)
  }

  // ── Remove Item ────────────────────────────────────────────────────────────
  const handleRemove = (productId: string) => {
    const item = cart.find((i) => i.productId === productId)
    if (!item) return

    if (confirm(`Hapus ${item.name} dari keranjang?`)) {
      const updated = cart.filter((i) => i.productId !== productId)
      saveCart(updated)
      toast.success(`${item.name} dihapus dari keranjang.`)
    }
  }

  // ── Totals Calculation ─────────────────────────────────────────────────────
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalWeight = cart.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // ── Open Checkout Form ─────────────────────────────────────────────────────
  const handleCheckoutInit = () => {
    if (cart.length === 0) return
    router.push("/customer/cart?checkout=active")
  }

  // ── Process Checkout (Milestone 8) ─────────────────────────────────────────
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

      // 2. VALIDASI STOK AKHIR: Cek ketersediaan stok riil di database saat ini
      const productIds = cart.map(item => item.productId)
      const { data: dbInventory, error: stockCheckErr } = await supabase
        .from("inventory")
        .select("product_id, stock_qty")
        .in("product_id", productIds)

      if (stockCheckErr) throw stockCheckErr

      for (const item of cart) {
        const dbStock = dbInventory?.find(i => i.product_id === item.productId)
        const currentStock = dbStock ? dbStock.stock_qty : 0
        if (currentStock < item.quantity) {
          toast.error(`Gagal Checkout: Stok produk "${item.name}" baru saja berubah di sistem dan tidak mencukupi (Tersedia: ${currentStock} ${item.unit || 'unit'}). Silakan sesuaikan keranjang belanja Anda.`)
          setCheckingOut(false)
          // Update stok_qty lokal agar keranjang mendeteksi stok baru
          const updated = cart.map(c => {
            if (c.productId === item.productId) {
              return { ...c, stockQty: currentStock }
            }
            return c
          })
          saveCart(updated)
          return
        }
      }

      // 3. FETCH SETTING SISTEM untuk ECT
      const { data: settingsData, error: settingsErr } = await supabase
        .from("system_settings")
        .select("key, value")

      if (settingsErr) throw settingsErr

      const settings: SystemSettings = {
        t_base: 2,
        t_pick: 1,
        t_pack: 0.5,
        queue_mode: "fifo"
      }

      if (settingsData) {
        settingsData.forEach((s) => {
          if (s.key === "t_base") settings.t_base = Number(s.value)
          if (s.key === "t_pick") settings.t_pick = Number(s.value)
          if (s.key === "t_pack") settings.t_pack = Number(s.value)
          if (s.key === "queue_mode") settings.queue_mode = String(s.value)
        })
      }

      // 4. HITUNG ECT PESANAN BARU
      const distinctSKUs = cart.length
      const weightFactor = totalWeight > 20 ? 1.5 : 1.0
      const ect = settings.t_base + (settings.t_pick * distinctSKUs) + (settings.t_pack * totalItems * weightFactor)

      // 5. FETCH TOTAL EWP ANTREAN AKTIF LAINNYA
      const { data: activeOrders, error: activeOrdersErr } = await supabase
        .from("orders")
        .select("ewp")
        .in("status", ["waiting", "processing"])

      if (activeOrdersErr) throw activeOrdersErr

      const activeEwpSum = activeOrders?.reduce((sum, o) => sum + (o.ewp || 0), 0) || 0

      // 6. EWP FINAL PESANAN INI
      const finalEwp = Math.round(ect + activeEwpSum)

      // 7. PANGGIL RPC checkout_order UNTUK TRANSAKSI ATOMIC
      const { data: orderId, error: checkoutErr } = await supabase.rpc("checkout_order", {
        p_customer_name: trimmedName,
        p_ewp: finalEwp,
        p_items: cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice
      })

      if (checkoutErr) throw checkoutErr

      if (orderId) {
        // 8. INSERT KE queue_logs UNTUK PENCATATAN ANTREAN
        const { error: logErr } = await supabase
          .from("queue_logs")
          .insert({
            order_id: orderId,
            mode: settings.queue_mode as any,
            enqueued_at: new Date().toISOString()
          })

        if (logErr) {
          console.error("Gagal mencatat ke queue_logs:", logErr.message)
        }

        // 9. KOSONGKAN KERANJANG
        localStorage.removeItem("pos_grosir_cart")
        setCart([])
        window.dispatchEvent(new Event("storage"))

        toast.success(`Pesanan #${orderId.substring(0, 8).toUpperCase()} berhasil dibuat!`)
        
        // 10. REDIRECT KE PESANAN SAYA
        router.push("/customer/orders")
      }
    } catch (err: any) {
      toast.error("Gagal memproses pesanan: " + err.message)
    } finally {
      setCheckingOut(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
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
        
        {/* Left Column: Form Checkout & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Form */}
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
                    <TableRow key={item.productId} className="hover:bg-transparent">
                      <TableCell className="text-sm font-semibold">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {item.quantity} {item.unit || "unit"}
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
              <CardDescription>Perkiraan waktu tunggu barang siap diambil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <IconClock className="size-5 shrink-0" />
                  <span>Estimasi Waktu Tunggu (EWP)</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Pesanan Anda disusun secara cerdas berdasarkan antrean prioritas Min-Heap.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Kuantitas:</span>
                  <span className="font-semibold">{totalItems} unit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Berat Barang:</span>
                  <span className="font-semibold">{totalWeight.toFixed(2)} kg</span>
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
                    <TableRow key={item.productId} className="hover:bg-muted/30 transition-colors">
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
                            {item.weight && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Berat: {item.weight} kg
                              </p>
                            )}
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
                            onClick={() => handleDecrement(item.productId)}
                          >
                            <IconMinus className="size-3.5" />
                          </Button>
                          <span className="text-sm font-bold w-6">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md"
                            onClick={() => handleIncrement(item.productId)}
                            disabled={item.quantity >= item.stockQty}
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
                          onClick={() => handleRemove(item.productId)}
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
            <CardDescription>Rincian harga dan beban fisik belanjaan</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Kuantitas:</span>
              <span className="font-semibold">{totalItems} unit</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <IconScale className="size-3.5" />
                Total Berat:
              </span>
              <span className="font-semibold">{totalWeight.toFixed(2)} kg</span>
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
