"use client"

import { PanelShell } from "@/components/panels/panel-shell"
import { LayoutDashboard, Users, Stethoscope, Briefcase, IdCard, ShoppingBag, Truck, Coins, Landmark, ClipboardList, Star, BarChart3, FileText, ScrollText, Settings } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelShell
      panelKey="admin"
      title="پنل مدیریت"
      nav={[
        { href: "/admin", label: "داشبورد", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/admin/users", label: "کاربران و نقش‌ها", icon: <Users className="h-4 w-4" />, permission: "users.view" },
        { href: "/admin/doctors", label: "پزشکان", icon: <Stethoscope className="h-4 w-4" />, permission: "doctors.view_all" },
        { href: "/admin/agents", label: "نمایندگان", icon: <Briefcase className="h-4 w-4" />, permission: "agents.view_all" },
        { href: "/admin/plans", label: "طرح‌ها", icon: <IdCard className="h-4 w-4" />, permission: "plans.manage" },
        { href: "/admin/purchases", label: "خریدهای مستقیم", icon: <ShoppingBag className="h-4 w-4" />, permission: "purchases.view_all" },
        { href: "/admin/sales", label: "فروش و کارت", icon: <Truck className="h-4 w-4" />, permission: "sales.view_all" },
        { href: "/admin/commissions", label: "پورسانت‌ها", icon: <Coins className="h-4 w-4" />, permission: "commissions.view_all" },
        { href: "/admin/settlements", label: "تسویه‌ها", icon: <Landmark className="h-4 w-4" />, permission: "settlements.view_all" },
        { href: "/admin/visits", label: "ویزیت‌ها", icon: <ClipboardList className="h-4 w-4" />, permission: "visits.view_all" },
        { href: "/admin/reviews", label: "نظرات پزشکان", icon: <Star className="h-4 w-4" />, permission: "reviews.moderate" },
        { href: "/admin/reports", label: "گزارش‌ها", icon: <BarChart3 className="h-4 w-4" />, permission: "reports.view" },
        { href: "/admin/content", label: "محتوا و اعلان", icon: <FileText className="h-4 w-4" />, permission: "content.manage" },
        { href: "/admin/audit", label: "رخدادهای سیستم", icon: <ScrollText className="h-4 w-4" />, permission: "audit.view" },
        { href: "/admin/settings", label: "تنظیمات", icon: <Settings className="h-4 w-4" />, permission: "settings.view" },
      ]}
    >
      {() => children}
    </PanelShell>
  )
}
