"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconDeviceFloppy, IconClock, IconEdit, IconListDetails } from "@tabler/icons-react"

type Product = {
  id: string
  sku: string | null
  name: string
  waktu_pengambilan: number | null
  category_id: string | null
  categories?: {
    name: string
  } | null
}

type Category = {
  id: string
  name: string
}

export default function WaktuPengambilanPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local state for modified values
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({})

  // Bulk Edit state
  const [bulkCategory, setBulkCategory] = useState("all")
  const [bulkValue, setBulkValue] = useState("")

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
        .select("id, sku, name, waktu_pengambilan, category_id, categories:category_id ( name )")
        .order("name")
      if (prodErr) throw prodErr

      setProducts((prodData as any) || [])
      
      // Initialize local state
      const initialTimes: Record<string, string> = {}
      prodData?.forEach((p) => {
        initialTimes[p.id] = (p.waktu_pengambilan ?? 60).toString()
      })
      setLocalTimes(initialTimes)
    } catch (err: any) {
      toast.error("Gagal memuat data: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Handle single input change
  const handleTimeChange = (productId: string, value: string) => {
    setLocalTimes((prev) => ({
      ...prev,
      [productId]: value,
    }))
  }

  // Handle Apply Bulk Edit
  const handleApplyBulk = () => {
    const val = parseInt(bulkValue)
    if (isNaN(val) || val < 0) {
      toast.error("Waktu massal harus berupa angka detik yang valid.")
      return
    }

    const updated = { ...localTimes }
    products.forEach((p) => {
      if (bulkCategory === "all" || p.category_id === bulkCategory) {
        updated[p.id] = val.toString()
      }
    })

    setLocalTimes(updated)
    toast.success("Waktu pengambilan massal berhasil diterapkan ke form di bawah!")
  }

  // Save changes to database
  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const updates = products.map((p) => {
        const val = parseInt(localTimes[p.id]) || 0
        return supabase
          .from("products")
          .update({ waktu_pengambilan: val })
          .eq("id", p.id)
      })

      const results = await Promise.all(updates)
      const failed = results.find((r) => r.error)
      if (failed) throw failed.error

      toast.success("Semua perubahan waktu pengambilan berhasil disimpan!")
      fetchData()
    } catch (err: any) {
      toast.error("Gagal menyimpan perubahan: " + err.message)
    } finally {
      setSaving(false)
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kelola Waktu Pengambilan</h1>
              <p className="text-muted-foreground mt-1">
                Atur estimasi waktu pengambilan barang per produk (detik). Berfungsi sebagai bobot waktu kalkulasi ECT.
              </p>
            </div>
            <Button onClick={handleSaveAll} disabled={saving || loading} className="w-full md:w-auto font-bold shadow-md">
              {saving ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <IconDeviceFloppy className="size-4 mr-2" /> Simpan Semua Perubahan
                </>
              )}
            </Button>
          </div>

          {/* Bulk edit widget */}
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="size-5 text-primary" /> Pengaturan Massal (Bulk Edit)
              </CardTitle>
              <CardDescription>
                Terapkan nilai waktu pengambilan yang sama untuk beberapa produk sekaligus.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-end gap-4">
                <div className="w-full md:w-64 space-y-1.5">
                  <Label>Kategori Target</Label>
                  <Select value={bulkCategory} onValueChange={setBulkCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kategori" />
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
                <div className="w-full md:w-64 space-y-1.5">
                  <Label htmlFor="bulkValue">Waktu Pengambilan Baru (detik)</Label>
                  <Input
                    id="bulkValue"
                    type="number"
                    placeholder="60"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={handleApplyBulk} className="w-full md:w-auto">
                  <IconEdit className="size-4 mr-2" /> Terapkan Massal
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table list */}
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconListDetails className="size-5 text-primary" /> Daftar Waktu Pengambilan Produk
              </CardTitle>
              <CardDescription>
                Ubah nilai detik pengambilan di bawah ini dan tekan Simpan Semua Perubahan di atas untuk memperbarui data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Memuat data produk...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Tidak ada produk ditemukan.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="w-[180px]">Waktu Pengambilan (detik)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold">
                            {p.sku || "-"}
                          </TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.categories?.name || "-"}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={localTimes[p.id] || "0"}
                              onChange={(e) => handleTimeChange(p.id, e.target.value)}
                              className="w-28 text-right font-semibold bg-background"
                            />
                          </TableCell>
                        </TableRow>
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
