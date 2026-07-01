"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconClock, IconDeviceFloppy, IconSearch } from "@tabler/icons-react"

type ProductUnit = {
  id: string
  unit: string
  time_weight: number | null
  products: {
    id: string
    name: string
    sku: string | null
  } | null
}

export default function PickingTimePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([])
  const [search, setSearch] = useState("")
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("product_units")
        .select("id, unit, time_weight, products ( id, name, sku )")
        .order("id", { ascending: true })

      if (error) throw error
      setProductUnits((data as any) || [])

      // Initialize edit values from current data
      const initValues: Record<string, string> = {}
      if (data) {
        data.forEach((pu: any) => {
          initValues[pu.id] = pu.time_weight != null ? String(pu.time_weight) : ""
        })
      }
      setEditValues(initValues)
    } catch (err: any) {
      toast.error("Gagal memuat data waktu pengambilan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async (unitId: string) => {
    const rawValue = editValues[unitId]
    const parsed = parseFloat(rawValue)
    if (rawValue !== "" && (isNaN(parsed) || parsed < 0)) {
      toast.error("Masukkan angka positif yang valid")
      return
    }

    try {
      setSaving(unitId)
      const { error } = await supabase
        .from("product_units")
        .update({ time_weight: rawValue === "" ? null : parsed })
        .eq("id", unitId)

      if (error) throw error
      toast.success("Waktu pengambilan berhasil disimpan")
      // Update local state
      setProductUnits((prev) =>
        prev.map((pu) =>
          pu.id === unitId ? { ...pu, time_weight: rawValue === "" ? null : parsed } : pu
        )
      )
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message)
    } finally {
      setSaving(null)
    }
  }

  const filteredUnits = productUnits.filter((pu) => {
    const q = search.toLowerCase()
    return (
      pu.products?.name?.toLowerCase().includes(q) ||
      pu.products?.sku?.toLowerCase().includes(q) ||
      pu.unit?.toLowerCase().includes(q)
    )
  })

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
            <h1 className="text-3xl font-bold tracking-tight">Waktu Pengambilan Barang</h1>
            <p className="text-muted-foreground mt-1">
              Kelola estimasi waktu pengambilan (dalam menit) per unit produk di gudang. Digunakan untuk kalkulasi prioritas antrian.
            </p>
          </div>

          {/* Info card */}
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
            <CardContent className="flex gap-3 items-start pt-5">
              <IconClock className="size-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-semibold">Cara Penggunaan</p>
                <p>
                  Isikan estimasi waktu (menit) yang dibutuhkan untuk mengambil setiap unit produk dari gudang.
                  Misalnya: Produk dijual dalam <strong>Pcs</strong> (1 mnt) dan <strong>Dus</strong> (3 mnt) karena
                  memiliki berat dan kerumitan pengambilan yang berbeda.
                  Nilai ini digunakan oleh sistem antrian untuk memprioritaskan pesanan terkecil terlebih dahulu (Shortest Job First).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
              <div>
                <CardTitle>Daftar Unit Produk</CardTitle>
                <CardDescription>
                  {filteredUnits.length} unit produk ditemukan
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama produk, SKU, atau satuan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-2">
                  <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Memuat data unit produk...</span>
                </div>
              ) : filteredUnits.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground">
                  {search ? "Tidak ada unit produk yang cocok dengan pencarian" : "Belum ada unit produk yang terdaftar"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-center">Satuan</TableHead>
                        <TableHead className="text-center w-[180px]">Waktu Pengambilan (mnt)</TableHead>
                        <TableHead className="text-center w-[120px]">Status</TableHead>
                        <TableHead className="text-center w-[100px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnits.map((pu) => {
                        const isDirty = editValues[pu.id] !== (pu.time_weight != null ? String(pu.time_weight) : "")
                        return (
                          <TableRow key={pu.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium">
                              {pu.products?.name || <span className="text-muted-foreground italic">Produk tidak ditemukan</span>}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {pu.products?.sku || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-semibold uppercase tracking-wide">
                                {pu.unit}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={editValues[pu.id] ?? ""}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({ ...prev, [pu.id]: e.target.value }))
                                  }
                                  placeholder="e.g. 1.5"
                                  className="w-24 text-center bg-background"
                                />
                                <span className="text-xs text-muted-foreground">mnt</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {pu.time_weight != null ? (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-white">
                                  Diatur
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Belum diatur
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                disabled={!isDirty || saving === pu.id}
                                onClick={() => handleSave(pu.id)}
                                className="h-8 text-xs font-semibold"
                              >
                                {saving === pu.id ? (
                                  <IconLoader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <IconDeviceFloppy className="size-3.5" />
                                )}
                                <span className="ml-1">Simpan</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
