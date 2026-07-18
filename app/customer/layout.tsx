import { CartProvider } from "@/lib/cart/cart-context"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <CartProvider>
      <div className="pb-24 md:pb-0 min-h-screen flex flex-col">
        {children}
      </div>
      <MobileBottomNav />
    </CartProvider>
  )
}
