"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useCart, cartItemKey } from "@/lib/cart/cart-context"
import { computeEWP, formatDuration } from "@/lib/queue/ewp"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  IconTrashX,
  IconReceipt2,
  IconTag,
  IconHourglassHigh,
  IconCreditCard,
  IconQrcode,
  IconAlertCircle,
  IconUpload,
  IconCheck,
  IconDownload,
} from "@tabler/icons-react"

export default function CustomerCartPage() {
  const router = useRouter()
  const supabase = createClient()
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalPrice } = useCart()

  const [customerName, setCustomerName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "transfer" | "qris">("tunai")
  const [submitting, setSubmitting] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [queueBacklog, setQueueBacklog] = useState(0)

  // Upload proof states
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUploading, setProofUploading] = useState(false)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

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

    // Total EWP pesanan yang sudah antri, dipakai untuk estimasi waktu selesai keranjang ini
    const fetchQueueBacklog = async () => {
      const { data } = await supabase.from("orders").select("ewp").eq("status", "antri")
      setQueueBacklog((data || []).reduce((sum, o) => sum + (o.ewp || 0), 0))
    }
    fetchQueueBacklog()

    const channel = supabase
      .channel("customer-cart-queue-backlog")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchQueueBacklog())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Upload proof to products bucket under payment_proofs/
  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2MB")
      return
    }

    setProofFile(file)
    setProofUploading(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${paymentMethod}_${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `payment_proofs/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from("products")
        .getPublicUrl(filePath)

      setProofUrl(data.publicUrl)
      toast.success("Bukti transfer berhasil diunggah!")
    } catch (err: any) {
      toast.error("Gagal mengunggah bukti: " + err.message)
      setProofFile(null)
    } finally {
      setProofUploading(false)
    }
  }

  // Estimasi waktu selesai keranjang ini (detik): sisa antrian saat ini + waktu kemas pesanan ini sendiri
  const cartEwp = computeEWP(items.map((i) => ({ qty: i.quantity, weight: i.timeWeight ?? 1 })))
  const estimatedCompletionSeconds = queueBacklog + cartEwp

  const handleCheckout = async () => {
    if (items.length === 0) return
    if (!customerName.trim()) {
      toast.error("Nama pemesan wajib diisi.")
      return
    }
    if ((paymentMethod === "transfer" || paymentMethod === "qris") && !proofUrl) {
      toast.error(`Bukti pembayaran wajib diunggah untuk metode ${paymentMethod === "transfer" ? "Transfer Bank" : "QRIS Digital"}.`)
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
      // Fetch all relevant product stocks
      const productIds = [...new Set(items.map((i) => i.productId))]
      const { data: stockData, error: stockErr } = await supabase
        .from("products")
        .select("id, stock")
        .in("id", productIds)
      if (stockErr) throw stockErr

      const stockMap = new Map((stockData || []).map((s) => [s.id, s.stock]))

      for (const item of items) {
        const rawStock = stockMap.get(item.productId) ?? 0
        // For multi-unit items, quantity is in unit kemasan units
        // Each unit = multiplier pcs. So effective pcs needed = item.quantity * item.multiplier
        const pcsNeeded = item.quantity * item.multiplier
        if (pcsNeeded > rawStock) {
          const unitStock = item.multiplier > 0 ? Math.floor(rawStock / item.multiplier) : 0
          toast.error(
            `Stok ${item.name} (${item.unitName || "pcs"}) tidak mencukupi. Tersisa: ${unitStock} ${item.unitName || "unit"}.`
          )
          setSubmitting(false)
          return
        }
      }

      // 2. Kalkulasi prioritas antrian: EWP = Σ (Qi x Wi)
      const ewp = computeEWP(items.map((i) => ({ qty: i.quantity, weight: i.timeWeight ?? 1 })))

      // 3. Submit the order via checkout RPC
      // Pass unit_id and unit_name so warehouse knows which kemasan was ordered
      const { data: orderId, error: checkoutErr } = await supabase.rpc("checkout_order", {
        p_customer_name: customerName.trim(),
        p_ewp: ewp,
        p_items: items.map((i) => ({
          product_id: i.productId,
          qty: i.quantity,
          unit_price: i.price,
          unit_id: i.unitId,
          unit_name: i.unitName,
          multiplier: i.multiplier,
        })),
        p_total_items: totalItems,
        p_total_price: totalPrice,
        p_payment_method: paymentMethod === "tunai" ? "tunai" : "online",
        p_payment_proof_url: paymentMethod === "tunai" ? null : proofUrl,
        p_payment_channel: paymentMethod,
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

  const handleClearCart = () => {
    if (!confirm("Kosongkan seluruh item di keranjang?")) return
    clearCart()
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Keranjang Belanja</h1>
                <p className="text-muted-foreground mt-1">
                  Tinjau kembali pesanan Anda sebelum melanjutkan ke proses pemesanan.
                </p>
              </div>
              {items.length > 0 && (
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-bold px-2.5 py-1 rounded-full shrink-0">
                  {totalItems} item
                </Badge>
              )}
            </div>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-fit"
                onClick={handleClearCart}
              >
                <IconTrashX className="size-4 mr-1.5" /> Kosongkan Keranjang
              </Button>
            )}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Daftar item keranjang */}
              <Card className="lg:col-span-2 border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Item Pesanan</CardTitle>
                  <CardDescription>Ubah kuantitas atau hapus produk dari keranjang.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/50 px-0">
                  {items.map((item) => {
                    const itemKey = cartItemKey(item.productId, item.unitId)
                    const unitLabel = item.unitName || "pcs"
                    const isMulti = item.unitId !== null && item.multiplier > 1
                    return (
                      <div
                        key={itemKey}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-16 w-16 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <IconPhoto className="size-6 text-muted-foreground/50" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold h-4">
                                <IconTag className="size-2.5 mr-1" />{unitLabel}
                              </Badge>
                              {isMulti && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({item.multiplier} pcs / {unitLabel})
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatRupiah(item.price)} / {unitLabel}
                            </p>
                            <p className="text-sm font-bold text-primary mt-1 sm:hidden">
                              {formatRupiah(item.price * item.quantity)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                          <div className="flex items-center border border-border rounded-md">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-none"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1, item.unitId)}
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
                              onClick={() => updateQuantity(item.productId, item.quantity + 1, item.unitId)}
                            >
                              <IconPlus className="size-3.5" />
                            </Button>
                          </div>
                          <p className="hidden sm:block w-24 text-right text-sm font-bold text-primary">
                            {formatRupiah(item.price * item.quantity)}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => removeItem(item.productId, item.unitId)}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
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
              <Card className="border-border/50 shadow-md lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconReceipt2 className="size-5 text-primary" /> Ringkasan Pesanan
                  </CardTitle>
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

                  <div className="space-y-2">
                    <Label>Metode Pembayaran</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={paymentMethod === "tunai" ? "default" : "outline"}
                        className="w-full text-[10px] sm:text-xs font-semibold px-1"
                        onClick={() => {
                          setPaymentMethod("tunai")
                          setProofFile(null)
                          setProofUrl(null)
                        }}
                        disabled={submitting}
                      >
                        Tunai / Cash
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "transfer" ? "default" : "outline"}
                        className="w-full text-[10px] sm:text-xs font-semibold px-1"
                        onClick={() => {
                          setPaymentMethod("transfer")
                          setProofFile(null)
                          setProofUrl(null)
                        }}
                        disabled={submitting}
                      >
                        Transfer Bank
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "qris" ? "default" : "outline"}
                        className="w-full text-[10px] sm:text-xs font-semibold px-1"
                        onClick={() => {
                          setPaymentMethod("qris")
                          setProofFile(null)
                          setProofUrl(null)
                        }}
                        disabled={submitting}
                      >
                        QRIS Digital
                      </Button>
                    </div>
                  </div>

                  {paymentMethod === "tunai" && (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-600 dark:text-yellow-400 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <IconReceipt2 className="size-4 shrink-0" />
                        <span>Bayar di Kasir (Tunai)</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        Pesanan Anda akan dikemas terlebih dahulu. Silakan lakukan pembayaran tunai di kasir saat mengambil pesanan.
                      </p>
                      <div className="flex items-start gap-1.5 border-t border-yellow-500/10 pt-2 text-[11px] text-yellow-700 dark:text-yellow-300 font-medium">
                        <IconAlertCircle className="size-3.5 mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        <span>Harap simpan Nomor Pesanan Anda untuk ditunjukkan ke kasir saat pengambilan.</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "transfer" && (
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs space-y-3.5 text-foreground">
                      <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                        <IconCreditCard className="size-4 shrink-0" />
                        <span>Transfer Bank Manual</span>
                      </div>

                      <div className="bg-background/80 rounded-lg border border-border p-3 space-y-2 font-mono text-[11px] shadow-sm">
                        <div className="flex justify-between border-b border-border/50 pb-1.5">
                          <span className="text-muted-foreground">Bank:</span>
                          <span className="font-bold text-foreground">BSI (Bank Syariah Indonesia)</span>
                        </div>
                        <div className="flex justify-between border-b border-border/50 pb-1.5 items-center">
                          <span className="text-muted-foreground">No. Rekening:</span>
                          <span className="font-bold text-foreground">7337763094</span>
                        </div>
                        <div className="flex justify-between border-b border-border/50 pb-1.5">
                          <span className="text-muted-foreground">Atas Nama:</span>
                          <span className="font-bold text-foreground">GROSIR JASA</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-semibold bg-rose-500/5 rounded px-1.5 py-1 mt-1">
                          <span className="text-muted-foreground text-[10px]">Nominal Transfer:</span>
                          <span className="font-bold">{formatRupiah(totalPrice)} <span className="text-[9px] font-normal">(harus sama persis)</span></span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="font-bold flex items-center gap-1 text-muted-foreground">
                          <span>📋 Cara Pembayaran:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground pl-1">
                          <li>Transfer sesuai nominal ke rekening di atas</li>
                          <li>Upload bukti transfer di bawah ini</li>
                          <li>Pesanan akan dikemas dan diverifikasi kasir</li>
                          <li>Tunjukkan nomor pesanan saat pengambilan barang</li>
                        </ol>
                      </div>

                      <div className="space-y-2 border-t border-border/50 pt-3">
                        <div className="font-bold text-muted-foreground flex items-center gap-1.5">
                          <span>📎 Upload Bukti Transfer (wajib):</span>
                        </div>

                        <div className="relative">
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-background/50 hover:bg-muted/10 cursor-pointer transition-colors group">
                            {proofUploading ? (
                              <div className="flex flex-col items-center space-y-1.5">
                                <IconLoader2 className="size-6 text-primary animate-spin" />
                                <span className="text-[11px] font-semibold text-muted-foreground">Mengunggah...</span>
                              </div>
                            ) : proofUrl ? (
                              <div className="flex flex-col items-center space-y-1.5 text-center">
                                <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                  <IconCheck className="size-4" />
                                </div>
                                <span className="text-[11px] font-bold text-emerald-600 truncate max-w-[200px]">
                                  {proofFile?.name || "Bukti Transfer"}
                                </span>
                                <span className="text-[9px] text-muted-foreground">Klik untuk ganti file</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center space-y-1.5 text-center">
                                <IconUpload className="size-6 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                <span className="text-[11px] font-semibold text-foreground">
                                  Pilih File Bukti Transfer
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  JPG, PNG, PDF (Maks. 2MB)
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleProofChange}
                              className="hidden"
                              disabled={proofUploading || submitting}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 border-t border-blue-500/10 pt-2.5 text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                        <IconAlertCircle className="size-3.5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>Status pembayaran akan diverifikasi oleh kasir setelah bukti transfer diterima.</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "qris" && (
                    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3.5 text-xs space-y-3.5 text-foreground">
                      <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                        <IconQrcode className="size-4 shrink-0" />
                        <span>QRIS Digital</span>
                      </div>

                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-purple-200 shadow-sm space-y-2">
                        <img
                          src="/qris_real.jpg"
                          alt="QRIS Merchant QR"
                          className="w-48 object-contain rounded"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-[10px] h-7 px-3 font-semibold mt-1 w-full"
                          asChild
                        >
                          <a href="/qris_real.jpg" download="QRIS_Grosir_Jasa.jpg">
                            <IconDownload className="size-3 mr-1" /> Unduh Kode QR
                          </a>
                        </Button>
                      </div>

                      <div className="bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg p-2.5 flex justify-between items-center font-semibold">
                        <span className="text-[10px]">Nominal:</span>
                        <span className="font-bold">{formatRupiah(totalPrice)} <span className="text-[9px] font-normal">(Wajib input manual di aplikasi)</span></span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="font-bold flex items-center gap-1 text-muted-foreground">
                          <span>📋 Cara Pembayaran:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground pl-1">
                          <li>Pindai kode QRIS dengan aplikasi e-wallet Anda (GoPay, OVO, DANA, ShopeePay, Mobile Banking)</li>
                          <li>Masukkan nominal {formatRupiah(totalPrice)} secara manual</li>
                          <li>Upload bukti pembayaran (screenshot) di bawah ini</li>
                          <li>Tunjukkan nomor pesanan saat pengambilan barang</li>
                        </ol>
                      </div>

                      <div className="space-y-2 border-t border-border/50 pt-3">
                        <div className="font-bold text-muted-foreground flex items-center gap-1.5">
                          <span>📎 Upload Bukti Pembayaran (wajib):</span>
                        </div>

                        <div className="relative">
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-background/50 hover:bg-muted/10 cursor-pointer transition-colors group">
                            {proofUploading ? (
                              <div className="flex flex-col items-center space-y-1.5">
                                <IconLoader2 className="size-6 text-primary animate-spin" />
                                <span className="text-[11px] font-semibold text-muted-foreground">Mengunggah...</span>
                              </div>
                            ) : proofUrl ? (
                              <div className="flex flex-col items-center space-y-1.5 text-center">
                                <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                  <IconCheck className="size-4" />
                                </div>
                                <span className="text-[11px] font-bold text-emerald-600 truncate max-w-[200px]">
                                  {proofFile?.name || "Bukti Pembayaran"}
                                </span>
                                <span className="text-[9px] text-muted-foreground">Klik untuk ganti file</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center space-y-1.5 text-center">
                                <IconUpload className="size-6 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                <span className="text-[11px] font-semibold text-foreground">
                                  Pilih File Bukti Pembayaran
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  JPG, PNG (Maks. 2MB)
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProofChange}
                              className="hidden"
                              disabled={proofUploading || submitting}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 border-t border-purple-500/10 pt-2.5 text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                        <IconAlertCircle className="size-3.5 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
                        <span>Status pembayaran akan diverifikasi oleh kasir setelah bukti pembayaran diterima.</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 text-sm border-t pt-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Jumlah Produk</span>
                      <span className="font-semibold text-foreground">{items.length} produk</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Item</span>
                      <span className="font-semibold text-foreground">{totalItems} unit</span>
                    </div>
                    <div className="flex justify-between text-base border-t pt-2 mt-2">
                      <span className="font-semibold">Total Pembayaran</span>
                      <span className="font-bold text-lg text-primary">{formatRupiah(totalPrice)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <IconHourglassHigh className="size-4" /> Estimasi Waktu Selesai
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatDuration(estimatedCompletionSeconds)}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
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
                  <p className="text-[11px] text-muted-foreground text-center">
                    Pesanan akan langsung masuk ke antrian gudang setelah dikonfirmasi.
                  </p>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
