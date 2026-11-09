"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Menu, LogIn, LayoutDashboard, PhoneCall } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/client"
import { BrandLogo } from "@/components/shared/brand"

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
    <header className="sticky top-0 z-40">
      {/* نوار بالایی */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto hidden h-9 max-w-6xl items-center justify-between px-4 text-[11px] sm:flex">
          <span>پشتیبانی شنبه تا پنجشنبه، ۹ تا ۱۸</span>
          <span className="flex items-center gap-1.5" dir="ltr">
            <PhoneCall className="h-3 w-3" />
            ۰۲۱-۹۱۰۰۰۰۰۰
          </span>
        </div>
      </div>

      {/* نوار اصلی */}
      <div className="border-b border-border/80 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="حامی‌کارت — صفحه اصلی">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    active && "bg-accent text-foreground font-medium"
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-gold" />
                  ) : null}
                </Link>
              )
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {me && me !== "loading" ? (
              <Button asChild size="sm">
                <Link href={me.home}>
                  <LayoutDashboard className="ml-1 h-4 w-4" />
                  پنل من
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm">
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
              <SheetTitle className="text-right">
                <BrandLogo compact />
              </SheetTitle>
              <nav className="mt-4 flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm hover:bg-accent",
                      pathname === item.href && "bg-accent font-medium"
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
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="mt-auto bg-sidebar text-sidebar-foreground">
      <div className="bg-girih-light">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-sidebar">
                <svg viewBox="0 0 48 48" width="22" height="22" fill="none" aria-hidden="true">
                  <g stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.8">
                    <rect x="15.5" y="15.5" width="17" height="17" />
                    <rect x="15.5" y="15.5" width="17" height="17" transform="rotate(45 24 24)" />
                  </g>
                  <path
                    d="M12 24h6.2l2.6-6 4.4 12 3-6H36"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </span>
              <span className="font-display text-lg font-bold">حامی‌کارت</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-sidebar-foreground/80">
              سامانه عضویت، تخفیف خدمات درمانی، شبکه پزشکان و نمایندگان فروش در سراسر ایران. حامی‌کارت سرویس بیمه نیست؛
              بستری برای دریافت تخفیف شفاف در مراجعه به پزشکان طرف همکاری است.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">دسترسی سریع</h4>
            <ul className="space-y-2.5 text-sm text-sidebar-foreground/85">
              <li><Link href="/plans" className="transition-colors hover:text-gold">طرح‌های عضویت</Link></li>
              <li><Link href="/doctors" className="transition-colors hover:text-gold">پزشکان طرف قرارداد</Link></li>
              <li><Link href="/auth/login" className="transition-colors hover:text-gold">ورود / ثبت‌نام</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">راهنما</h4>
            <ul className="space-y-2.5 text-sm text-sidebar-foreground/85">
              <li><Link href="/p/faq" className="transition-colors hover:text-gold">پرسش‌های متداول</Link></li>
              <li><Link href="/p/terms" className="transition-colors hover:text-gold">قوانین و شرایط</Link></li>
              <li><Link href="/p/privacy" className="transition-colors hover:text-gold">حریم خصوصی</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gold">تماس</h4>
            <ul className="space-y-2.5 text-sm text-sidebar-foreground/85">
              <li dir="ltr" className="text-right">۰۲۱-۹۱۰۰۰۰۰۰</li>
              <li>info@hamikart.ir</li>
              <li>شنبه تا پنجشنبه، ۹ تا ۱۸</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] text-sidebar-foreground/60 sm:flex-row">
          <span>© تمام حقوق برای سامانه حامی‌کارت محفوظ است.</span>
          <span className="tabular-nums">نسخهٔ نمایشی — داده‌ها نمونه هستند</span>
        </div>
      </div>
    </footer>
  )
}
