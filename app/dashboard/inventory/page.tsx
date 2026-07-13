"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function InventoryRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/products")
  }, [router])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground font-medium">Mengalihkan ke Kelola Produk dan Stok...</p>
      </div>
    </div>
  )
}
