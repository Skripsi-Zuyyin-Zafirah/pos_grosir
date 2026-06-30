"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { IconLoader2, IconSearch, IconLogin, IconDashboard, IconLogout, IconPackage, IconPhoto } from "@tabler/icons-react"

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

export default function CatalogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

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

  const fetchCatalog = async () => {
    try {
      setLoading(true)
      // Fetch categories
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("id, name")
        .order("name")
      if (catErr) throw catErr
      setCategories(catData || [])

      // Fetch products with categories and inventory details
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

  useEffect(() => {
    fetchAuth()
    fetchCatalog()
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Anda berhasil keluar.")
      setUser(null)
      setUserRole(null)
      setProfileName("")
      router.refresh()
    } catch (err: any) {
      toast.error("Gagal keluar: " + err.message)
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

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {userRole === "admin" ? "Admin" : userRole === "cashier" ? "Kasir" : "Pelanggan"}
                  </p>
                  <p className="text-sm font-medium">{profileName}</p>
                </div>
                {userRole === "admin" || userRole === "cashier" ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard">
                      <IconDashboard className="size-4 mr-1.5" /> Dashboard
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

                  <CardFooter className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
                    <div>
                      <p className="text-xs text-muted-foreground">Harga Satuan ({product.unit || "pcs"})</p>
                      <p className="text-lg font-bold text-primary">{formatRupiah(product.price)}</p>
                    </div>
                    {product.weight && (
                      <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-border">
                        {product.weight} kg
                      </Badge>
                    )}
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
