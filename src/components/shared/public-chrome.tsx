"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { HeartPulse, Menu, LogIn, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/client"

const NAV = [
  { href: "/", label: "خانه" },
  { href: "/plans", label: "طرح‌های عضویت" },
  { href: "/doctors", label: "پزشکان طرف قرارداد" },
  { href: "/p/about", label: "درباره ما" },
  { href: "/p/faq", label: "پرسش‌های متداول" },
  { href: "/p/contact", label: "تماس با ما" },
]

export function PublicHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<{ home: string } | null | "loading">("loading")

  useEffect(() => {
    let mounted = true
    api
      .get<{ home: string } | null>("/api/v1/auth/me")
      .then((d) => {
        if (mounted) setMe(d && typeof d === "object" && "home" in d ? (d as { home: string }) : null)
      })
      .catch(() => {
        if (mounted) setMe(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="text-lg">حامی‌کارت</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname === item.href && "bg-muted text-foreground font-medium"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {me && me !== "loading" ? (
            <Button asChild>
              <Link href={me.home}>
                <LayoutDashboard className="ml-1 h-4 w-4" />
                پنل من
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/auth/login">
                <LogIn className="ml-1 h-4 w-4" />
                ورود / ثبت‌نام
              </Link>
            </Button>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="outline" size="icon" aria-label="منو">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="text-right">حامی‌کارت</SheetTitle>
            <nav className="mt-4 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm hover:bg-muted",
                    pathname === item.href && "bg-muted font-medium"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 border-t pt-3">
                {me && me !== "loading" ? (
                  <Button asChild className="w-full">
                    <Link href={me.home} onClick={() => setOpen(false)}>پنل من</Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/auth/login" onClick={() => setOpen(false)}>ورود / ثبت‌نام</Link>
                  </Button>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="h-4 w-4" />
            </span>
            حامی‌کارت
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            سامانه عضویت، تخفیف خدمات درمانی، شبکه پزشکان و نمایندگان فروش در سراسر ایران.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">دسترسی سریع</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/plans" className="hover:text-foreground">طرح‌های عضویت</Link></li>
            <li><Link href="/doctors" className="hover:text-foreground">پزشکان طرف قرارداد</Link></li>
            <li><Link href="/auth/login" className="hover:text-foreground">ورود / ثبت‌نام</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">راهنما</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/p/faq" className="hover:text-foreground">پرسش‌های متداول</Link></li>
            <li><Link href="/p/terms" className="hover:text-foreground">قوانین و شرایط</Link></li>
            <li><Link href="/p/privacy" className="hover:text-foreground">حریم خصوصی</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">تماس</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>۰۲۱-۹۱۰۰۰۰۰۰</li>
            <li>info@hamikart.ir</li>
            <li>شنبه تا پنجشنبه، ۹ تا ۱۸</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © تمام حقوق برای سامانه حامی‌کارت محفوظ است.
      </div>
    </footer>
  )
}
