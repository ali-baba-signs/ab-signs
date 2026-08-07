import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="py-12 sm:py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                Create Custom <span className="text-primary">Signage</span> with Ease
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Design professional banners and vinyl signs with our interactive design editor. High-quality printing delivered to your door.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/design">
                  <Button size="lg" className="bg-primary hover:bg-opacity-90 text-white w-full sm:w-auto">
                    Start Designing
                  </Button>
                </Link>
                <Link href="/products">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Browse Products
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative h-80 md:h-96 rounded-lg overflow-hidden bg-secondary">
              <Image
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80"
                alt="Professional signage showcase"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-card border-t border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Why Choose Ali Baba Signs?</h2>
            <p className="text-lg text-muted-foreground">Everything you need to create stunning custom signage</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Interactive Design Editor',
                description: 'Drag, drop, and design with our powerful web-based editor. No design skills needed.',
                icon: '🎨',
              },
              {
                title: 'Premium Materials',
                description: 'Choose from vinyl, mesh, and custom banner options. Durable and weather-resistant.',
                icon: '✨',
              },
              {
                title: 'Fast Printing & Shipping',
                description: 'Quick turnaround times with professional printing and reliable delivery.',
                icon: '🚀',
              },
              {
                title: 'Templates Library',
                description: 'Start with professionally designed templates for your industry or style.',
                icon: '📚',
              },
              {
                title: 'Unlimited Revisions',
                description: 'Make as many changes as you want before finalizing your order.',
                icon: '🔄',
              },
              {
                title: 'Expert Support',
                description: 'Our team is here to help with design questions and technical support.',
                icon: '💬',
              },
            ].map((feature, index) => (
              <div key={index} className="p-6 border border-border rounded-lg hover:border-primary transition-colors">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Showcase */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Popular Products</h2>
            <p className="text-lg text-muted-foreground">Browse our collection of custom signage solutions</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {[
              {
                name: 'Feather Flags',
                description: 'Create feather flag in any size and design',
                image: '/feather flag.png',
              },
              {
                name: 'Vinyl Banners',
                description: 'Durable vinyl banners for outdoor use',
                image: '/vnyl banner.png',
              },
              {
                name: 'Mesh Banners',
                description: 'Wind-resistant mesh banners for high winds',
                image: '/mesh banner.png',
              },
            ].map((product, index) => (
              <div key={index} className="group cursor-pointer">
                <div className="relative h-64 rounded-lg overflow-hidden mb-4 bg-secondary">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{product.name}</h3>
                <p className="text-muted-foreground">{product.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/products">
              <Button size="lg" variant="outline">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-primary/10 to-primary/5 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Ready to Create?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start designing your custom signage today with Ali Baba Signs. Sign up or start designing with our free design editor.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/design-editor">
              <Button size="lg" className="bg-primary hover:bg-opacity-90 text-white">
                Open Design Editor
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="lg" variant="outline">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
