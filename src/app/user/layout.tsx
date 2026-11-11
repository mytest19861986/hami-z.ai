"use client"

import { PanelShell } from "@/components/panels/panel-shell"
import { LayoutDashboard, UserRound, IdCard, CreditCard, CalendarCheck, ShoppingBag, Stethoscope, Bell, Wallet } from "lucide-react"

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelShell
      panelKey="user"
      title="پنل کاربر"
      nav={[
        { href: "/user", label: "داشبورد", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/user/card", label: "کارت مجازی", icon: <CreditCard className="h-4 w-4" /> },
        { href: "/user/memberships", label: "طرح‌ها و عضویت‌ها", icon: <IdCard className="h-4 w-4" /> },
        { href: "/user/purchases", label: "سوابق خرید", icon: <ShoppingBag className="h-4 w-4" /> },
        { href: "/user/wallet", label: "کیف پول و پورسانت", icon: <Wallet className="h-4 w-4" /> },
        { href: "/user/visits", label: "سوابق ویزیت", icon: <Stethoscope className="h-4 w-4" /> },
        { href: "/user/profile", label: "پروفایل", icon: <UserRound className="h-4 w-4" /> },
        { href: "/user/notifications", label: "اعلان‌ها", icon: <Bell className="h-4 w-4" /> },
        { href: "/doctors", label: "پزشکان طرف قرارداد", icon: <CalendarCheck className="h-4 w-4" /> },
      ]}
    >
      {() => children}
    </PanelShell>
  )
}
