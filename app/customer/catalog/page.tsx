"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCart } from "@/lib/cart/cart-context"
import { CustomerSidebar } from "@/components/customer-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  IconLoader2,
  IconSearch,
  IconPhoto,
  IconMinus,
  IconPlus,
  IconShoppingCartPlus,
  IconPackageOff,
} from "@tabler/icons-react"

type Product = {
  id: string
  sku: string | null
  name: string
  description: string | null
  price: number
  unit: string | null
  weight: number | null
  image_url: string | null
  category_id: string | null
  categories: { name: string } | null
  inventory: { stock_qty: number } | null
}

type Category = {
  id: string
  name: string
}

export default function CustomerCatalogPage() {
  const supabase = createClient()
  const { addItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const fetchData = async () => {
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
        .select("*, categories:category_id ( name ), inventory ( stock_qty )")
        .order("name")
      if (prodErr) throw prodErr
      setProducts((prodData as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat katalog: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
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

  const getQty = (id: string) => quantities[id] ?? 1

  const setQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(1, Math.min(qty, Math.max(max, 1)))
    setQuantities((prev) => ({ ...prev, [id]: clamped }))
  }

  const handleAddToCart = (product: Product) => {
    const stock = product.inventory?.stock_qty ?? 0
    if (stock <= 0) return
    const qty = getQty(product.id)
    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        weight: product.weight || 0,
        imageUrl: product.image_url,
        stockQty: stock,
      },
      qty
    )
    toast.success(`${qty} ${product.unit || "pcs"} ${product.name} ditambahkan ke keranjang!`)
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }))
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Katalog Produk</h1>
              <p className="text-muted-foreground mt-1">
                Pilih produk grosir yang ingin Anda pesan dan tambahkan ke keranjang.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
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
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Memuat katalog produk...</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const stock = product.inventory?.stock_qty ?? 0
                const outOfStock = stock <= 0
                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="aspect-square w-full bg-muted flex items-center justify-center relative overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <IconPhoto className="size-10 text-muted-foreground/50" />
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] flex items-center justify-center">
                          <Badge variant="destructive" className="font-semibold">Stok Habis</Badge>
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2 space-y-1.5">
                      {product.categories?.name && (
                        <Badge variant="outline" className="w-fit text-[10px] font-semibold px-2 py-0">
                          {product.categories.name}
                        </Badge>
                      )}
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      <p className="text-base font-bold text-primary">
                        {formatRupiah(product.price)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {product.unit || "pcs"}
                        </span>
                      </p>
                    </CardHeader>
                    <CardContent className="pb-2 mt-auto">
                      <p className="text-xs text-muted-foreground">
                        Stok: <span className="font-semibold">{outOfStock ? "Habis" : `${stock} ${product.unit || "pcs"}`}</span>
                      </p>
                    </CardContent>
                    <CardFooter className="pt-2 border-t border-border/50 flex items-center gap-2">
                      <div className="flex items-center border border-border rounded-md">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-none"
                          disabled={outOfStock}
                          onClick={() => setQty(product.id, getQty(product.id) - 1, stock)}
                        >
                          <IconMinus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">
                          {outOfStock ? 0 : getQty(product.id)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-none"
                          disabled={outOfStock}
                          onClick={() => setQty(product.id, getQty(product.id) + 1, stock)}
                        >
                          <IconPlus className="size-3.5" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        className="flex-1 font-semibold"
                        disabled={outOfStock}
                        onClick={() => handleAddToCart(product)}
                      >
                        <IconShoppingCartPlus className="size-4 mr-1.5" /> Tambah
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
