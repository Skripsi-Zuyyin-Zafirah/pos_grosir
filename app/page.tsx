"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  IconDashboard,
  IconLogout,
  IconSparkles,
  IconArrowRight,
  IconPackage,
  IconRocket,
  IconMapPin,
  IconCreditCard,
  IconShoppingCart,
  IconClipboardList,
  IconBuildingStore,
  IconUserPlus,
  IconLogin2,
} from "@tabler/icons-react"

export default function LandingPage() {
  const supabase = createClient()

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
      }
    } else {
      setUser(null)
      setUserRole(null)
      setProfileName("")
    }
  }

  useEffect(() => {
    fetchAuth()
  }, [])

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success("Berhasil keluar.")
      fetchAuth()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const steps = [
    {
      icon: IconShoppingCart,
      title: "Pilih Produk",
      desc: "Browse katalog produk kami dan lihat stok yang tersedia secara real-time. Tambahkan barang yang Anda butuhkan ke keranjang.",
    },
    {
      icon: IconClipboardList,
      title: "Buat Pesanan",
      desc: "Checkout pesanan Anda dan sistem akan menghitung total harga secara otomatis. Pesanan langsung masuk ke antrian pemrosesan.",
    },
    {
      icon: IconBuildingStore,
      title: "Ambil di Toko",
      desc: "Pantau status pesanan Anda secara real-time. Setelah status \"Siap Diambil\", datang ke toko dan tunjukkan nomor pesanan Anda!",
    },
  ]

  const features = [
    {
      icon: IconPackage,
      title: "Stok Real-Time",
      desc: "Lihat ketersediaan barang secara langsung sebelum memesan. Tidak perlu datang ke toko untuk cek stok!",
    },
    {
      icon: IconRocket,
      title: "Pesanan Cepat Diproses",
      desc: "Sistem antrian cerdas memastikan pesanan Anda diproses lebih cepat berdasarkan jumlah item yang dipesan.",
    },
    {
      icon: IconMapPin,
      title: "Tracking Pesanan",
      desc: "Pantau status pesanan Anda secara real-time: dari diproses, dikemas, hingga siap diambil.",
    },
    {
      icon: IconCreditCard,
      title: "Pembayaran Fleksibel",
      desc: "Bayar langsung di toko atau transfer online. Pilih metode yang paling mudah untuk Anda!",
    },
  ]

  return (
    <div className="min-h-svh bg-background relative flex flex-col overflow-x-hidden selection:bg-primary/20">
      {/* MagicUI dot grid overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:16px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Radial primary-color glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[450px] w-[700px] bg-gradient-to-tr from-primary/20 via-primary/10 to-chart-2/20 blur-[130px] rounded-full" />

      {/* Header (glassmorphism) */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-2 text-primary-foreground font-black shadow-md group-hover:scale-105 transition-transform">
              PG
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-primary to-chart-3 bg-clip-text text-transparent">
              POS Grosir Jasa
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {user ? (
              <>
                <div className="text-right hidden md:block mr-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {userRole === "admin" ? "Admin" : userRole === "cashier" ? "Kasir" : "Pelanggan"}
                  </p>
                  <p className="text-xs font-semibold">{profileName}</p>
                </div>
                {userRole === "customer" ? (
                  <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold">
                    <Link href="/customer/shop">
                      <IconDashboard className="size-3.5 mr-1" /> <span>Katalog Belanja</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold">
                    <Link href="/dashboard">
                      <IconDashboard className="size-3.5 mr-1" /> <span>Dashboard</span>
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 text-xs">
                  <IconLogout className="size-3.5 sm:mr-1" /> <span className="hidden sm:inline">Keluar</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-semibold">
                  <Link href="/login">Masuk</Link>
                </Button>
                <Button size="sm" asChild className="h-8 text-xs font-bold shadow-sm">
                  <Link href="/register">Daftar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden border-b border-border/30">
        <div className="container mx-auto px-4 flex flex-col items-center text-center space-y-6 max-w-4xl">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-bold px-3 py-1 text-xs gap-1.5 rounded-full shadow-sm">
            <IconSparkles className="size-3.5 animate-spin" /> 🛒 Grosir Jasa
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-foreground">
            Belanja Grosir Jadi <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-primary via-chart-2 to-chart-3 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-x">Lebih Mudah & Cepat!</span>
          </h1>

          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
            Pesan dari rumah, lihat stok real-time, dan ambil pesanan Anda tanpa menunggu lama.
            <strong> Sistem antrian cerdas</strong> memastikan pesanan Anda diproses lebih cepat!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center w-full max-w-md">
            {user ? (
              <Button size="lg" asChild className="font-bold shadow-md text-sm h-11">
                <Link href={userRole === "admin" || userRole === "cashier" ? "/dashboard" : "/customer/orders"}>
                  {userRole === "admin" || userRole === "cashier" ? "Buka Dashboard" : "Lihat Pesanan Saya"} <IconArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" asChild className="font-bold shadow-md text-sm h-11">
                <Link href="/register">
                  <IconUserPlus className="size-4 mr-1" /> Daftar Sekarang
                </Link>
              </Button>
            )}
          </div>

          {/* Bento-style Features widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full pt-16 text-left">
            {features.map((f, i) => (
              <Card
                key={f.title}
                className="p-5 border-border/50 bg-background/50 backdrop-blur-md rounded-2xl flex flex-col space-y-2 shadow-sm hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className="size-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `color-mix(in oklch, var(--chart-${(i % 5) + 1}) 12%, transparent)`,
                    color: `var(--chart-${(i % 5) + 1})`,
                  }}
                >
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-bold text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-bold px-3 py-1 text-xs rounded-full">
            Cara Belanja
          </Badge>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Cara Belanja di Grosir Jasa</h2>
          <p className="text-muted-foreground text-sm">
            Tiga langkah mudah dari rumah hingga barang siap diambil!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <Card className="p-6 h-full border-border/50 bg-background/50 backdrop-blur-md rounded-2xl space-y-3 shadow-sm hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shrink-0">
                    {i + 1}
                  </div>
                  <step.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="container mx-auto px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-chart-2/10 p-10 md:p-14 text-center space-y-5">
          <div className="absolute -top-20 -right-20 size-64 bg-primary/20 blur-[100px] rounded-full -z-10" />
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            🛒 Belanja Grosir Jadi Lebih Mudah!
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Pesan dari rumah, lihat stok real-time, ambil langsung di toko tanpa antri lama.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {!user && (
              <Button size="lg" asChild className="font-bold shadow-md text-sm h-11">
                <Link href="/register">Daftar Gratis <IconArrowRight className="size-4 ml-1" /></Link>
              </Button>
            )}
            <Button variant="outline" size="lg" asChild className="font-bold border-border/50 text-sm h-11">
              <Link href="/login">Masuk ke Akun</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/50 backdrop-blur-md py-10 mt-auto">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">© {new Date().getFullYear()} Grosir Jasa. Semua hak dilindungi.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs text-muted-foreground">
            <span>📍 Lokasi: Aceh Timur</span>
            <span>📞 <a href="tel:082275237151" className="hover:text-primary transition-colors">082275237151</a></span>
            <span>📧 <a href="mailto:zuyyinzafirah9@gmail.com" className="hover:text-primary transition-colors">zuyyinzafirah9@gmail.com</a></span>
          </div>
        </div>
      </footer>
    </div>
  )
}
