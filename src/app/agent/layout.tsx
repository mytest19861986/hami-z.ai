"use client"

import { PanelShell } from "@/components/panels/panel-shell"
import { LayoutDashboard, Users, Coins, Wallet, UserRound, FileText, UserPlus, ArrowLeftRight } from "lucide-react"

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelShell
      panelKey="agent"
      title="پنل نماینده فروش"
      nav={[
        { href: "/agent", label: "داشبورد", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/agent/customers", label: "مشتریان و فروش", icon: <Users className="h-4 w-4" /> },
        { href: "/agent/commissions", label: "پورسانت‌ها", icon: <Coins className="h-4 w-4" /> },
        { href: "/agent/wallet", label: "کیف پول", icon: <Wallet className="h-4 w-4" /> },
        { href: "/agent/profile", label: "پروفایل", icon: <UserRound className="h-4 w-4" /> },
        { href: "/agent/settlements", label: "تسویه", icon: <ArrowLeftRight className="h-4 w-4" /> },
        { href: "/agent/documents", label: "مدارک همکاری", icon: <FileText className="h-4 w-4" /> },
        { href: "/agent/register", label: "درخواست همکاری", icon: <UserPlus className="h-4 w-4" /> },
      ]}
    >
      {() => children}
    </PanelShell>
  )
}
