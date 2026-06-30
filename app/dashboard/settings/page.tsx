"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { IconLoader2, IconSettings, IconClock, IconHelp, IconScale } from "@tabler/icons-react"

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // System Settings state
  const [tBase, setTBase] = useState("2.0")
  const [tPick, setTPick] = useState("1.5")
  const [tPack, setTPack] = useState("0.2")
  const [agingRate, setAgingRate] = useState("1.0")
  const [queueMode, setQueueMode] = useState("fifo")

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")

      if (error) throw error

      if (data) {
        data.forEach((item) => {
          if (item.key === "t_base") setTBase(String(item.value))
          if (item.key === "t_pick") setTPick(String(item.value))
          if (item.key === "t_pack") setTPack(String(item.value))
          if (item.key === "aging_rate") setAgingRate(String(item.value))
          if (item.key === "queue_mode") setQueueMode(String(item.value))
        })
      }
    } catch (err: any) {
      toast.error("Gagal memuat pengaturan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const settingsToSave = [
        { key: "t_base", value: parseFloat(tBase) },
        { key: "t_pick", value: parseFloat(tPick) },
        { key: "t_pack", value: parseFloat(tPack) },
        { key: "aging_rate", value: parseFloat(agingRate) },
        { key: "queue_mode", value: queueMode },
      ]

      for (const item of settingsToSave) {
        const { error } = await supabase
          .from("system_settings")
          .upsert({ key: item.key, value: item.value as any, updated_at: new Date().toISOString() })
        if (error) throw error
      }

      toast.success("Pengaturan sistem berhasil disimpan!")
      fetchSettings()
    } catch (err: any) {
      toast.error("Gagal menyimpan pengaturan: " + err.message)
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
        <div className="flex flex-1 flex-col p-6 space-y-6 max-w-4xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
            <p className="text-muted-foreground mt-1">
              Konfigurasi parameter waktu tunggu ECT (Estimated Completion Time) dan algoritma prioritas antrian.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Memuat pengaturan sistem...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ECT parameters card */}
                <Card className="border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClock className="size-5 text-primary" /> Estimasi Waktu (ECT)
                    </CardTitle>
                    <CardDescription>
                      Konfigurasi parameter bobot waktu dalam menit untuk rumus ECT.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tBase" className="flex items-center gap-1">
                        t_base (Waktu Dasar) <span className="text-xs text-muted-foreground">(menit)</span>
                      </Label>
                      <Input
                        id="tBase"
                        type="number"
                        step="0.1"
                        value={tBase}
                        onChange={(e) => setTBase(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Waktu persiapan dasar per order (pengemasan dokumen, antrean kasir awal).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tPick" className="flex items-center gap-1">
                        t_pick (Picking Time) <span className="text-xs text-muted-foreground">(menit/SKU)</span>
                      </Label>
                      <Input
                        id="tPick"
                        type="number"
                        step="0.1"
                        value={tPick}
                        onChange={(e) => setTPick(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Rata-rata waktu pencarian dan pengambilan barang per jenis SKU unik di gudang.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tPack" className="flex items-center gap-1">
                        t_pack (Packing Time) <span className="text-xs text-muted-foreground">(menit/item)</span>
                      </Label>
                      <Input
                        id="tPack"
                        type="number"
                        step="0.01"
                        value={tPack}
                        onChange={(e) => setTPack(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Rata-rata waktu pengepakan/wrapping per satu satuan barang kuantitas.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Queue strategy card */}
                <Card className="border-border/50 shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconScale className="size-5 text-primary" /> Strategi Antrian
                    </CardTitle>
                    <CardDescription>
                      Pilih model antrian pelayanan untuk pengemasan di gudang.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="queueMode">Mode Antrian Utama</Label>
                      <Select value={queueMode} onValueChange={setQueueMode} disabled={saving}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fifo">FIFO (First-In, First-Out)</SelectItem>
                          <SelectItem value="priority">Priority Queue (SJF Prioritas)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        FIFO memproses pesanan berurutan. SJF (Shortest Job First) memprioritaskan pesanan dengan ECT terkecil.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agingRate" className="flex items-center gap-1">
                        Anti-Starvation Aging Rate <span className="text-xs text-muted-foreground">(per menit)</span>
                      </Label>
                      <Input
                        id="agingRate"
                        type="number"
                        step="0.1"
                        value={agingRate}
                        onChange={(e) => setAgingRate(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Pengurangan prioritas waktu tunggu pesanan per menit untuk mencegah starvation pada pesanan besar.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="w-full md:w-auto">
                  {saving ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan Pengaturan...
                    </>
                  ) : (
                    "Simpan Pengaturan"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
