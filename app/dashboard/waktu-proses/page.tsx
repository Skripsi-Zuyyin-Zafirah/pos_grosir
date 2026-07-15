"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  IconLoader2,
  IconSearch,
  IconClockHour4,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react"

type ProductUnitRow = {
  id: string
  unit_name: string
  multiplier: number
  time_weight: number | null
}

type Product = {
  id: string
  sku: string | null
  name: string
  unit: string | null
  category_id: string | null
  is_multi_unit: boolean | null
  time_weight: number
  categories: { name: string } | null
  product_units: ProductUnitRow[]
}

export default function WaktuProsesPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [{ data: catData, error: catErr }, { data: prodData, error: prodErr }] = await Promise.all([
        supabase.from("categories").select("id, name").order("name"),
        supabase
          .from("products")
          .select(`
            id, sku, name, unit, category_id, is_multi_unit, time_weight,
            categories:category_id ( name ),
            product_units ( id, unit_name, multiplier, time_weight )
          `)
          .order("name"),
      ])
      if (catErr) throw catErr
      if (prodErr) throw prodErr

      setCategories(catData || [])
      setProducts((prodData as any) || [])
    } catch (err: any) {
      toast.error("Gagal memuat data produk: " + err.message)
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

  const handleUpdateProductWeight = async (product: Product, value: string) => {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Bobot waktu harus berupa angka >= 0.")
      return
    }
    if (parsed === product.time_weight) return

    const key = `product-${product.id}`
    try {
      setSavingKey(key)
      const { error } = await supabase.from("products").update({ time_weight: parsed }).eq("id", product.id)
      if (error) throw error
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, time_weight: parsed } : p))
      )
      toast.success(`Waktu proses "${product.name}" disimpan.`)
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message)
    } finally {
      setSavingKey(null)
    }
  }

  const handleUpdateUnitWeight = async (product: Product, unit: ProductUnitRow, value: string) => {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Bobot waktu harus berupa angka >= 0.")
      return
    }
    if (parsed === unit.time_weight) return

    const key = `unit-${unit.id}`
    try {
      setSavingKey(key)
      const { error } = await supabase.from("product_units").update({ time_weight: parsed }).eq("id", unit.id)
      if (error) throw error
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                product_units: p.product_units.map((u) => (u.id === unit.id ? { ...u, time_weight: parsed } : u)),
              }
            : p
        )
      )
      toast.success(`Waktu proses "${unit.unit_name}" (${product.name}) disimpan.`)
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message)
    } finally {
      setSavingKey(null)
    }
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
            <h1 className="text-3xl font-bold tracking-tight">Waktu Proses Produk</h1>
            <p className="text-muted-foreground mt-1">
              Master data bobot waktu (Wi) per produk/satuan, dipakai untuk kalkulasi prioritas antrian
              EWP = Σ (Qi × Wi).
            </p>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 py-4">
              <IconInfoCircle className="size-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Semakin besar bobot waktu suatu satuan, semakin lama produk itu dianggap butuh waktu untuk
                dikemas/diproses — pesanan yang berisi produk berbobot besar akan mendapat EWP lebih tinggi
                (prioritas lebih rendah) di antrian Min-Heap. Nilai default adalah <b>1</b> untuk semua produk.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Daftar Produk</CardTitle>
              <CardDescription>
                Atur bobot waktu satuan dasar tiap produk, dan tiap varian kemasan untuk produk multi-satuan.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
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
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Memuat data produk...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Tidak ada produk yang cocok.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead className="w-40 text-center">Bobot Waktu (Wi)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <Fragment key={product.id}>
                          <TableRow className="hover:bg-muted/30">
                            <TableCell>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{product.sku || "-"}</p>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {product.categories?.name || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{product.unit || "pcs"}</span>
                                {product.is_multi_unit && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                    Satuan Dasar
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1.5">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  defaultValue={product.time_weight}
                                  className="h-8 w-20 text-center text-xs"
                                  onBlur={(e) => handleUpdateProductWeight(product, e.target.value)}
                                />
                                {savingKey === `product-${product.id}` ? (
                                  <IconLoader2 className="size-3.5 animate-spin text-muted-foreground" />
                                ) : (
                                  <IconCheck className="size-3.5 text-transparent" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {product.is_multi_unit &&
                            product.product_units.map((unit) => (
                              <TableRow key={unit.id} className="bg-muted/10 hover:bg-muted/30">
                                <TableCell colSpan={2} className="pl-10 text-xs text-muted-foreground">
                                  ↳ Varian kemasan
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <IconClockHour4 className="size-3.5 text-muted-foreground" />
                                    <span className="text-xs font-semibold">
                                      {unit.unit_name} (1 = {unit.multiplier} {product.unit || "pcs"})
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min={0}
                                      defaultValue={unit.time_weight ?? 1}
                                      className="h-8 w-20 text-center text-xs"
                                      onBlur={(e) => handleUpdateUnitWeight(product, unit, e.target.value)}
                                    />
                                    {savingKey === `unit-${unit.id}` ? (
                                      <IconLoader2 className="size-3.5 animate-spin text-muted-foreground" />
                                    ) : (
                                      <IconCheck className="size-3.5 text-transparent" />
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
