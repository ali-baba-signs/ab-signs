import { Header } from '@/components/shared/header'
import { Footer } from '@/components/shared/footer'
import { CartProvider } from '@/lib/cart-context'

export default function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  )
}
