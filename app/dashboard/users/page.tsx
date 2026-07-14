"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  IconLoader2,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconUsers,
  IconShieldCheck,
  IconCash,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"

type UserRole = "admin" | "cashier" | "customer"

type ManagedUser = {
  id: string
  email: string | null
  full_name: string
  phone_number: string
  role: UserRole
  created_at: string
  last_sign_in_at: string | null
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  cashier: "Kasir",
  customer: "Pelanggan",
}

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  cashier: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  customer: "bg-muted text-muted-foreground border-border",
}

export default function UsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Dialog tambah/edit
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editUser, setEditUser] = useState<ManagedUser | null>(null)
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formRole, setFormRole] = useState<UserRole>("cashier")

  // Dialog hapus
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/users")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal memuat data")
      setUsers(json.users || [])
    } catch (err: any) {
      toast.error("Gagal memuat pengguna: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null)
    })
    fetchUsers()
  }, [])

  const openAdd = () => {
    setEditUser(null)
    setFormEmail("")
    setFormPassword("")
    setFormName("")
    setFormPhone("")
    setFormRole("cashier")
    setOpen(true)
  }

  const openEdit = (u: ManagedUser) => {
    setEditUser(u)
    setFormEmail(u.email || "")
    setFormPassword("")
    setFormName(u.full_name)
    setFormPhone(u.phone_number)
    setFormRole(u.role)
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Nama lengkap wajib diisi")
      return
    }
    if (!editUser && (!formEmail.trim() || !formPassword)) {
      toast.error("Email dan password wajib diisi untuk pengguna baru")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/users", {
        method: editUser ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editUser
            ? {
                id: editUser.id,
                full_name: formName.trim(),
                phone_number: formPhone.trim(),
                role: formRole,
                password: formPassword || undefined,
              }
            : {
                email: formEmail.trim(),
                password: formPassword,
                full_name: formName.trim(),
                phone_number: formPhone.trim(),
                role: formRole,
              }
        ),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan")

      toast.success(editUser ? "Pengguna berhasil diperbarui" : "Pengguna baru berhasil ditambahkan")
      setOpen(false)
      fetchUsers()
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal menghapus")

      toast.success(`Pengguna "${deleteTarget.full_name || deleteTarget.email}" berhasil dihapus`)
      setDeleteTarget(null)
      fetchUsers()
    } catch (err: any) {
      toast.error("Gagal menghapus: " + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false
    const q = search.toLowerCase()
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone_number || "").toLowerCase().includes(q)
    )
  })

  const countByRole = (role: UserRole) => users.filter((u) => u.role === role).length

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedUsers = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, itemsPerPage])

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kelola Pengguna</h1>
              <p className="text-muted-foreground mt-1">
                Tambah, ubah role, dan hapus akun admin, kasir, serta pelanggan.
              </p>
            </div>
            <Button onClick={openAdd}>
              <IconPlus className="size-4 mr-2" /> Tambah Pengguna
            </Button>
          </div>

          {/* Ringkasan per role */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconShieldCheck className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{countByRole("admin")}</p>
                  <p className="text-xs text-muted-foreground font-medium">Admin</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <IconCash className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{countByRole("cashier")}</p>
                  <p className="text-xs text-muted-foreground font-medium">Kasir</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <IconUser className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{countByRole("customer")}</p>
                  <p className="text-xs text-muted-foreground font-medium">Pelanggan</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconUsers className="size-5" /> Daftar Pengguna
                </CardTitle>
                <CardDescription>Menampilkan {filtered.length} dari {users.length} pengguna</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                  <SelectTrigger className="w-full sm:w-40 bg-background">
                    <SelectValue placeholder="Semua Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="cashier">Kasir</SelectItem>
                    <SelectItem value="customer">Pelanggan</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <IconSearch className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama, email, telepon..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Memuat pengguna...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Tidak ada pengguna ditemukan
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Lengkap</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>No. Telepon</TableHead>
                        <TableHead className="text-center">Role</TableHead>
                        <TableHead>Terdaftar</TableHead>
                        <TableHead>Login Terakhir</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((u) => (
                        <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">
                            {u.full_name || "-"}
                            {u.id === currentUserId && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Anda</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email || "-"}</TableCell>
                          <TableCell className="text-sm">{u.phone_number || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`font-bold px-2 ${ROLE_BADGE_CLASS[u.role]}`}>
                              {ROLE_LABELS[u.role]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("id-ID")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.last_sign_in_at
                              ? new Date(u.last_sign_in_at).toLocaleString("id-ID")
                              : "Belum pernah"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(u)}>
                                <IconEdit className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                disabled={u.id === currentUserId}
                                onClick={() => setDeleteTarget(u)}
                              >
                                <IconTrash className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50 pt-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Tampilkan</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(parseInt(val))}>
                      <SelectTrigger className="h-8 w-[72px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>per halaman</span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-3">
                      <p>
                        Halaman <span className="font-semibold text-foreground">{page}</span> dari{" "}
                        <span className="font-semibold text-foreground">{totalPages}</span>
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page === 1}
                          onClick={() => setPage((p) => Math.max(p - 1, 1))}
                          className="size-8"
                        >
                          <IconChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={page === totalPages}
                          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                          className="size-8"
                        >
                          <IconChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialog Tambah / Edit */}
        <Dialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}</DialogTitle>
              <DialogDescription>
                {editUser
                  ? "Perbarui data profil, role, atau reset password pengguna."
                  : "Buat akun baru untuk admin, kasir, atau pelanggan."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="uName">Nama Lengkap</Label>
                <Input
                  id="uName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="cth: Budi Santoso"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uEmail">Email</Label>
                <Input
                  id="uEmail"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="cth: kasir@posgrosir.com"
                  disabled={submitting || !!editUser}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uPassword">
                  Password {editUser && <span className="text-muted-foreground font-normal">(kosongkan jika tidak diubah)</span>}
                </Label>
                <Input
                  id="uPassword"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uPhone">No. Telepon</Label>
                <Input
                  id="uPhone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="cth: 08123456789"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={formRole}
                  onValueChange={(v) => setFormRole(v as UserRole)}
                  disabled={submitting || editUser?.id === currentUserId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="cashier">Kasir</SelectItem>
                    <SelectItem value="customer">Pelanggan</SelectItem>
                  </SelectContent>
                </Select>
                {editUser?.id === currentUserId && (
                  <p className="text-xs text-muted-foreground">Role akun sendiri tidak dapat diubah.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <IconLoader2 className="size-4 mr-2 animate-spin" />}
                {editUser ? "Simpan Perubahan" : "Tambah Pengguna"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Konfirmasi Hapus */}
        <Dialog open={!!deleteTarget} onOpenChange={(v) => !deleting && !v && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Hapus Pengguna?</DialogTitle>
              <DialogDescription>
                Akun <span className="font-semibold text-foreground">{deleteTarget?.full_name || deleteTarget?.email}</span> akan
                dihapus permanen dan tidak dapat login lagi. Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <IconLoader2 className="size-4 mr-2 animate-spin" />}
                Hapus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
