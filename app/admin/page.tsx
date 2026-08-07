'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSession } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { getUserRole } from '@/lib/auth/roles'
import Link from 'next/link'
import {
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  LogOut,
  FileCheck,
  Factory,
  LayoutTemplate,
  GalleryHorizontalEnd,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminActivityPanel } from '@/components/admin/activity-panel'

interface DashboardAnalytics {
  currency: string
  summary: Record<string, number>
  topProducts: Array<{ name: string; quantity: number }>
  productionWorkload: Array<{ status: string; count: number }>
}

export default function AdminDashboard() {
  const router = useRouter()
  const { data: session, isPending } = useAdminSession()
  const role = getUserRole(session?.user)
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)

  // Check if user is admin
  useEffect(() => {
    if (!isPending && (!session?.user || role !== 'admin')) {
      router.push(adminPath('/login'))
    }
  }, [session, isPending, role, router])

  useEffect(() => {
    if (role !== 'admin') return

    fetch('/api/admin/analytics')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setAnalytics(payload?.data ?? null))
      .catch(() => setAnalytics(null))
  }, [role])

  const statCards = [
    {
      label: 'Orders (30 days)',
      value: analytics?.summary.total_orders?.toLocaleString() ?? '0',
      icon: ShoppingCart,
    },
    {
      label: 'Revenue',
      value: `${analytics?.currency ?? 'AUD'} ${(analytics?.summary.paid_revenue ?? 0).toFixed(2)}`,
      icon: BarChart3,
    },
    {
      label: 'Popular Products',
      value: analytics?.topProducts[0]?.name ?? 'No sales yet',
      icon: Package,
    },
    {
      label: 'Customers',
      value: analytics?.summary.total_customers?.toLocaleString() ?? '0',
      icon: Users,
    },
    {
      label: 'Completed Orders',
      value: analytics?.summary.completed_orders?.toLocaleString() ?? '0',
      icon: Package,
    },
    {
      label: 'Average Order Value',
      value: `${analytics?.currency ?? 'AUD'} ${(analytics?.summary.average_order_value ?? 0).toFixed(2)}`,
      icon: BarChart3,
    },
    {
      label: 'Awaiting Design',
      value: analytics?.summary.awaiting_design?.toLocaleString() ?? '0',
      icon: FileCheck,
    },
    {
      label: 'Production Queue',
      value: analytics?.productionWorkload.reduce((total, row) => total + Number(row.count), 0).toLocaleString() ?? '0',
      icon: Factory,
    },
  ]

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session?.user || role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <LogOut className="h-4 w-4" />
                Back to Site
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-2">Welcome back, {session.user.name}</h2>
          <p className="text-muted-foreground">Manage your products, orders, and settings</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statCards.map((stat) => {
            const Icon = stat.icon

            return (
              <div key={stat.label} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-foreground truncate">{stat.value}</p>
                  </div>
                  <Icon className="h-8 w-8 text-primary opacity-20 shrink-0" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href={adminPath('/homepage')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full"><div className="flex items-start justify-between mb-4"><h3 className="text-xl font-bold text-foreground">Homepage heroes</h3><GalleryHorizontalEnd className="h-6 w-6 text-primary" /></div><p className="text-muted-foreground text-sm mb-4">Create, feature, order, align, and publish carousel slides</p><Button variant="outline" className="w-full">Manage Homepage</Button></div>
          </Link>
          <Link href={adminPath('/templates')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4"><h3 className="text-xl font-bold text-foreground">Template designs</h3><LayoutTemplate className="h-6 w-6 text-primary" /></div>
              <p className="text-muted-foreground text-sm mb-4">Create editable templates from a preview image, SVG source, and fixed product size</p>
              <Button variant="outline" className="w-full">Manage Templates</Button>
            </div>
          </Link>
          {/* Products */}
          <Link href={adminPath('/products')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">Products</h3>
                <Package className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Add, edit, and manage your product listings
              </p>
              <Button variant="outline" className="w-full">
                Manage Products
              </Button>
            </div>
          </Link>

          {/* Orders */}
          <Link href={adminPath('/orders')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">Orders</h3>
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                View and manage customer orders
              </p>
              <Button variant="outline" className="w-full">
                View Orders
              </Button>
            </div>
          </Link>

          {/* Analytics */}
          <Link href={adminPath('/reviews')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full"><div className="flex items-start justify-between mb-4"><h3 className="text-xl font-bold text-foreground">Reviews</h3><Star className="h-6 w-6 text-primary" /></div><p className="text-muted-foreground text-sm mb-4">Moderate verified post-delivery customer reviews</p><Button variant="outline" className="w-full">Moderate Reviews</Button></div>
          </Link>

          {/* Analytics */}
          <Link href={adminPath('/analytics')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">Analytics</h3>
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                View sales trends and business insights
              </p>
              <Button variant="outline" className="w-full">
                View Analytics
              </Button>
            </div>
          </Link>

          {/* Settings */}
          <Link href={adminPath('/settings')} className="block">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">Settings</h3>
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Configure store settings and preferences
              </p>
              <Button variant="outline" className="w-full">
                Go to Settings
              </Button>
            </div>
          </Link>
        </div>
        <div className="mt-8"><AdminActivityPanel /></div>
      </main>
    </div>
  )
}
