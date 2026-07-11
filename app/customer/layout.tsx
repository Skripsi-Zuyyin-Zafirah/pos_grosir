import { CartProvider } from "@/lib/cart/cart-context"

export default function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <CartProvider>{children}</CartProvider>
}
