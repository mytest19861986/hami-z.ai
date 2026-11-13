"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Menu, LogOut, Bell, UserRound, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, errMessage } from "@/lib/client"
import { ROLE_NAMES, type RoleName } from "@/constants/permissions"
import { useNotifications } from "./notifications-bell"
import { BrandMark } from "@/components/shared/brand"

export interface PanelUser {
  id: string
  mobile: string
  roles: string[]
  permissions: string[]
  home: string
  profile: { firstName: string | null; lastName: string | null } | null
  doctor?: { id: string; status: string; avatarUrl: string | null } | null
  agent?: { id: string; status: string } | null
}

export interface PanelNavItem {
  href: string
  label: string
  icon: React.ReactNode
  permission?: string
}

export function PanelShell({
  panelKey,
  title,
  nav,
  children,
}: {
  panelKey: string
  title: string
  nav: PanelNavItem[]
  children: (user: PanelUser) => React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<PanelUser | null>(null)
  const [error, setError] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const { bell } = useNotifications()

  useEffect(() => {
    let mounted = true
    api
      .get<PanelUser | null>("/api/v1/auth/me")
      .then((me) => {
        if (!mounted) return
        if (!me) {
          router.replace("/auth/login")
          return
        }
        if (me.home !== "/" + panelKey) {
          router.replace(me.home)
          return
        }
        setUser(me as PanelUser)
      })
      .catch((e) => {
        if (mounted) setError(errMessage(e))
      })
    return () => {
      mounted = false
    }
  }, [panelKey, router])

  async function logout() {
    try {
      await api.post("/api/v1/auth/logout")
    } finally {
      router.replace("/auth/login")
    }
  }

  const visibleNav = user ? nav.filter((n) => !n.permission || user.permissions.includes(n.permission) || user.roles.includes("SUPER_ADMIN")) : []

  const navContent = (
    <nav className="flex flex-col gap-0.5">
      {visibleNav.map((item) => {
        const active = pathname === item.href || (item.href !== `/${panelKey}` && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent font-semibold text-sidebar-foreground"
            )}
          >
            {active ? <span className="absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold" /> : null}
            <span className={cn("text-sidebar-foreground/60 transition-colors group-hover:text-sidebar-foreground", active && "text-gold")}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">بازگشت به صفحه اصلی</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-girih flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  const displayName =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || user.mobile
  const roleTitles = user.roles.map((r) => ROLE_NAMES[r as RoleName] ?? r).join("، ")

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* سایدبار دسکتاپ */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-sidebar-border bg-sidebar lg:flex">
        <div className="bg-girih-light flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <BrandMark size={32} />
          <div className="leading-tight">
            <div className="font-display text-sm font-bold text-sidebar-foreground">حامی‌کارت</div>
            <div className="text-[10px] text-sidebar-foreground/60">{title}</div>
          </div>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-3">{navContent}</div>
        <div className="border-t border-sidebar-border p-3">
          <Link href="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <Home className="h-4 w-4" />
            بازگشت به سایت
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-rose-300/90 transition-colors hover:bg-rose-400/10 hover:text-rose-200">
            <LogOut className="h-4 w-4" />
            خروج از حساب
          </button>
        </div>
      </aside>

      {/* بدنه */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/92 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="outline" size="icon" aria-label="منو">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 border-sidebar-border bg-sidebar p-0">
                <SheetTitle className="bg-girih-light flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4 text-right text-sidebar-foreground">
                  <BrandMark size={28} />
                  حامی‌کارت — {title}
                </SheetTitle>
                <div className="p-3">{navContent}</div>
                <div className="absolute bottom-3 right-0 w-full px-3">
                  <button onClick={logout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-rose-300/90 hover:bg-rose-400/10">
                    <LogOut className="h-4 w-4" />
                    خروج از حساب
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-display text-sm font-bold text-foreground/80 lg:hidden">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {bell}
            <div className="hidden items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5 sm:flex">
              {user.doctor?.avatarUrl ? (
                <img src={user.doctor.avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover ring-1 ring-border" />
              ) : (
                <UserRound className="h-4 w-4 text-primary" />
              )}
              <div className="text-right leading-tight">
                <div className="text-xs font-bold">{displayName}</div>
                <div className="text-[10px] text-muted-foreground">{roleTitles}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">{children(user)}</div>
        </main>
      </div>
    </div>
  )
}
