"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminSession } from "@/lib/admin-auth-client";
import { adminPath } from "@/lib/auth/admin-path";
import { getUserRole } from "@/lib/auth/roles";
import {
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  FileCheck,
  Factory,
  LayoutTemplate,
  GalleryHorizontalEnd,
  Star,
  Mail,
  MessageCircle,
  Ticket,
  ArrowRight,
  RefreshCw,
  Store,
  LayoutDashboard,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminActivityPanel } from "@/components/admin/activity-panel";

interface DashboardAnalytics {
  currency: string;
  summary: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number }>;
  productionWorkload: Array<{ status: string; count: number }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useAdminSession();
  const role = getUserRole(session?.user);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    if (!isPending && (!session?.user || role !== "admin")) {
      router.push(adminPath("/login"));
    }
  }, [session, isPending, role, router]);

  const fetchAnalytics = () => {
    startRefresh(async () => {
      try {
        const response = await fetch("/api/admin/analytics");
        if (!response.ok) return;
        const payload = await response.json();
        setAnalytics(payload?.data ?? null);
      } catch {
        setAnalytics(null);
      }
    });
  };

  useEffect(() => {
    if (role === "admin") {
      fetchAnalytics();
    }
  }, [role]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-primary border-t-transparent" />
          <p className="text-base text-muted-foreground font-medium">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!session?.user || role !== "admin") return null;

  const awaitingDesign = analytics?.summary.awaiting_design ?? 0;
  const productionQueue =
    analytics?.productionWorkload.reduce(
      (sum, row) => sum + Number(row.count),
      0,
    ) ?? 0;

  const navGroups = [
    {
      group: "Operations & Sales",
      links: [
        { label: "Dashboard", href: adminPath(), icon: LayoutDashboard },
        {
          label: "View Analytics",
          href: adminPath("/analytics"),
          icon: BarChart3,
        },
        { label: "Orders", href: adminPath("/orders"), icon: ShoppingCart },
        { label: "Products", href: adminPath("/products"), icon: Package },
        {
          label: "Coupons & Offers",
          href: adminPath("/coupons"),
          icon: Ticket,
        },
      ],
    },
    {
      group: "Communications",
      links: [
        {
          label: "Live Support Chat",
          href: adminPath("/live-chat"),
          icon: MessageCircle,
        },
        { label: "Web Enquiries", href: adminPath("/enquiries"), icon: Mail },
        { label: "Customer Reviews", href: adminPath("/reviews"), icon: Star },
      ],
    },
    {
      group: "Storefront & Setup",
      links: [
        {
          label: "Homepage Heroes",
          href: adminPath("/homepage"),
          icon: GalleryHorizontalEnd,
        },
        {
          label: "Design Templates",
          href: adminPath("/templates"),
          icon: LayoutTemplate,
        },
        { label: "Settings", href: adminPath("/settings"), icon: Settings },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/70 dark:bg-background">
      {/* 1. Sidebar with Larger Typography */}
      <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0">
        <div className="h-20 flex items-center gap-3.5 px-6 border-b border-border">
          <span className="h-11 w-11 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm">
            AS
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-foreground">
              Alibaba Signs
            </h1>
            <p className="text-xs text-muted-foreground">Admin Workspace</p>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1.5">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </p>
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3.5 px-2 py-1.5 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold uppercase">
              {session.user.name?.slice(0, 2) || "AD"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Action Header */}
        <header className="h-20 border-b border-border bg-card px-8 lg:px-12 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">
              Dashboard Overview
            </h2>
            <p className="text-sm text-muted-foreground">
              Key metrics, operations workload, and live logs
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="default"
              onClick={fetchAnalytics}
              disabled={isRefreshing}
              className="h-10 gap-2 text-sm px-4"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Link
              href={adminPath("/analytics")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
            >
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Link>

            <Link
              href="/"
              target="_blank"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-semibold text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground"
            >
              <Store className="h-4 w-4" />
              Storefront
            </Link>
          </div>
        </header>

        {/* Scrollable Work Area */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-8">
          {/* Action-Oriented Queue Banners */}
          {(awaitingDesign > 0 || productionQueue > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {awaitingDesign > 0 && (
                <div className="flex items-center justify-between rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      <FileCheck className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Attention Required
                      </p>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        <span className="text-amber-700 dark:text-amber-400 font-extrabold">
                          {awaitingDesign} orders
                        </span>{" "}
                        waiting for design approval
                      </p>
                    </div>
                  </div>
                  <Link
                    href={adminPath("/orders?status=awaiting_design")}
                    className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-800 dark:text-amber-300 hover:underline shrink-0"
                  >
                    Open Queue <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {productionQueue > 0 && (
                <div className="flex items-center justify-between rounded-2xl border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/20 p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      <Factory className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                        In Production
                      </p>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        <span className="text-blue-700 dark:text-blue-400 font-extrabold">
                          {productionQueue} orders
                        </span>{" "}
                        on the print floor
                      </p>
                    </div>
                  </div>
                  <Link
                    href={adminPath("/orders?status=in_production")}
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800 dark:text-blue-300 hover:underline shrink-0"
                  >
                    View Print Jobs <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Generously Sized Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-base font-semibold">30-Day Revenue</span>
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <p className="my-4 text-3xl xl:text-4xl font-black tracking-tight text-foreground">
                {analytics?.currency ?? "AUD"}{" "}
                {(analytics?.summary.paid_revenue ?? 0).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 font-medium">
                Avg:{" "}
                <span className="font-bold text-foreground">
                  {analytics?.currency ?? "AUD"}{" "}
                  {(analytics?.summary.average_order_value ?? 0).toFixed(2)}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-base font-semibold">Total Orders</span>
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <p className="my-4 text-3xl xl:text-4xl font-black tracking-tight text-foreground">
                {analytics?.summary.total_orders ?? 0}
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                <span className="font-bold text-foreground">
                  {analytics?.summary.completed_orders ?? 0}
                </span>{" "}
                orders completed
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-base font-semibold">
                  Active Customers
                </span>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <p className="my-4 text-3xl xl:text-4xl font-black tracking-tight text-foreground">
                {analytics?.summary.total_customers ?? 0}
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Registered accounts
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-base font-semibold">
                  Top Selling Product
                </span>
                <Package className="h-5 w-5 text-primary" />
              </div>
              <p className="my-4 text-2xl xl:text-3xl font-extrabold tracking-tight text-foreground truncate">
                {analytics?.topProducts[0]?.name ?? "No sales yet"}
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                <span className="font-bold text-foreground">
                  {analytics?.topProducts[0]?.quantity ?? 0}
                </span>{" "}
                units sold
              </p>
            </div>
          </div>

          {/* Dual-column workspace: Activity + Navigation Hub */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Activity Timeline */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold uppercase tracking-wider text-muted-foreground">
                  Recent System Activity
                </h3>
              </div>
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden p-2">
                <AdminActivityPanel />
              </div>
            </div>

            {/* Right 1 Col: Quick Access Center */}
            <div className="space-y-4">
              <h3 className="text-base font-bold uppercase tracking-wider text-muted-foreground">
                Quick Shortcuts
              </h3>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
                {/* Direct Link to Analytics */}
                <Link
                  href={adminPath("/analytics")}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Detailed Analytics
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Explore charts and revenue breakdown
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href={adminPath("/live-chat")}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Support Chat
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reply to incoming customer questions
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href={adminPath("/orders")}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Manage Orders
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fulfillment, tracking, and customer receipts
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href={adminPath("/enquiries")}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Website Enquiries
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Review custom signage quotes
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
