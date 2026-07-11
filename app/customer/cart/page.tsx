"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useCart } from "@/lib/cart/cart-context"
import { computeECT } from "@/lib/ect/calculate"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  IconLoader2,
  IconShoppingCartOff,
  IconPhoto,
  IconMinus,
  IconPlus,
  IconTrash,
  IconShoppingBag,
  IconArrowRight,
} from "@tabler/icons-react"

export default function CustomerCartPage() {
  const router = useRouter()
  const supabase = createClient()
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalPrice } = useCart()

  const [customerName, setCustomerName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setLoadingProfile(false)
          router.push("/login")
          return
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single()
        setCustomerName(profile?.full_name || session.user.email?.split("@")[0] || "")
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  const handleCheckout = async () => {
    if (items.length === 0) return
    if (!customerName.trim()) {
      toast.error("Nama pemesan wajib diisi.")
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/login")
        return
      }

      // 1. Validate current stock before submitting the order
      const productIds = items.map((i) => i.productId)
      const { data: stockData, error: stockErr } = await supabase
        .from("products")
        .select("id, stock_qty")
        .in("id", productIds)
      if (stockErr) throw stockErr

      const stockMap = new Map((stockData || []).map((s) => [s.id, s.stock_qty]))
      for (const item of items) {
        const available = stockMap.get(item.productId) ?? 0
        if (item.quantity > available) {
          toast.error(`Stok ${item.name} tidak mencukupi (tersisa ${available}).`)
          setSubmitting(false)
          return
        }
      }

      // 2. Fetch ECT parameters from system settings (falls back to defaults if unavailable)
      let tBase = 5, tPick = 1, tPack = 0.5
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
      settings?.forEach((s) => {
        if (s.key === "t_base") tBase = Number(s.value)
        if (s.key === "t_pick") tPick = Number(s.value)
        if (s.key === "t_pack") tPack = Number(s.value)
      })

      const ewp = computeECT(
        items.map((i) => ({ quantity: i.quantity, weight: 0 })),
        { t_base: tBase, t_pick: tPick, t_pack: tPack }
      )

      // 3. Submit the order via checkout RPC
      const { data: orderId, error: checkoutErr } = await supabase.rpc("checkout_order", {
        p_customer_name: customerName.trim(),
        p_ewp: ewp,
        p_items: items.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
          price: i.price,
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice,
      })
      if (checkoutErr) throw checkoutErr

      toast.success("Pesanan berhasil dibuat! Menunggu diproses gudang.")
      clearCart()
      router.push("/customer/orders")
    } catch (err: any) {
      toast.error("Gagal membuat pesanan: " + err.message)
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
      <CustomerSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Keranjang Belanja</h1>
            <p className="text-muted-foreground mt-1">
              Tinjau kembali pesanan Anda sebelum melanjutkan ke proses pemesanan.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted rounded-xl bg-background">
              <IconShoppingCartOff className="size-16 text-muted-foreground/60 mb-2" />
              <h3 className="font-semibold text-lg">Keranjang Anda Kosong</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Silakan pilih produk dari katalog untuk mulai berbelanja.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/customer/catalog">
                  <IconShoppingBag className="size-4 mr-1.5" /> Buka Katalog Produk
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daftar item keranjang */}
              <Card className="lg:col-span-2 border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Item Pesanan ({items.length})</CardTitle>
                  <CardDescription>Ubah kuantitas atau hapus produk dari keranjang.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-3 border border-border/50 rounded-lg p-3"
                    >
                      <div className="h-14 w-14 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <IconPhoto className="size-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRupiah(item.price)} / pcs
                        </p>
                      </div>
                      <div className="flex items-center border border-border rounded-md shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-none"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        >
                          <IconMinus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-none"
                          disabled={item.quantity >= item.stockQty}
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        >
                          <IconPlus className="size-3.5" />
                        </Button>
                      </div>
                      <p className="w-24 text-right text-sm font-bold text-primary shrink-0">
                        {formatRupiah(item.price * item.quantity)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeItem(item.productId)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="border-t border-border/50 pt-4">
                  <Button variant="outline" asChild>
                    <Link href="/customer/catalog">
                      <IconShoppingBag className="size-4 mr-1.5" /> Lanjut Belanja
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Ringkasan pesanan & checkout */}
              <Card className="border-border/50 shadow-md h-fit">
                <CardHeader>
                  <CardTitle>Ringkasan Pesanan</CardTitle>
                  <CardDescription>Lengkapi data sebelum membuat pesanan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Nama Pemesan</Label>
                    <Input
                      id="customerName"
                      placeholder="Nama Anda"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      disabled={loadingProfile || submitting}
                    />
                  </div>

                  <div className="space-y-1.5 text-sm border-t pt-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Item</span>
                      <span className="font-semibold text-foreground">{totalItems} unit</span>
                    </div>
                    <div className="flex justify-between text-base border-t pt-2 mt-2">
                      <span className="font-semibold">Total Pembayaran</span>
                      <span className="font-bold text-lg text-primary">{formatRupiah(totalPrice)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full font-semibold"
                    size="lg"
                    onClick={handleCheckout}
                    disabled={submitting || loadingProfile}
                  >
                    {submitting ? (
                      <>
                        <IconLoader2 className="mr-2 size-4 animate-spin" /> Memproses Pesanan...
                      </>
                    ) : (
                      <>
                        Buat Pesanan <IconArrowRight className="size-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
