"use client"

import { PanelShell } from "@/components/panels/panel-shell"
import { LayoutDashboard, ClipboardPlus, History, Stethoscope, UserPlus } from "lucide-react"

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelShell
      panelKey="doctor"
      title="پنل پزشک"
      nav={[
        { href: "/doctor", label: "داشبورد", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/doctor/visits/new", label: "احراز شرایط و ثبت ویزیت", icon: <ClipboardPlus className="h-4 w-4" /> },
        { href: "/doctor/visits", label: "تاریخچه ویزیت‌ها", icon: <History className="h-4 w-4" /> },
        { href: "/doctor/register", label: "درخواست همکاری / مشخصات", icon: <UserPlus className="h-4 w-4" /> },
      ]}
    >
      {() => children}
    </PanelShell>
  )
}
