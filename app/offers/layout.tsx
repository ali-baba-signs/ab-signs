import { Header } from '@/components/shared/header'
import { Footer } from '@/components/shared/footer'
import { CartProvider } from '@/lib/cart-context'

export default function OffersLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider><div className="flex min-h-screen flex-col bg-background"><Header /><div className="flex-1">{children}</div><Footer /></div></CartProvider>
}
