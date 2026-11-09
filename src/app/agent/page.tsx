"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { Briefcase, Hourglass, XCircle, UserPlus, Coins, Wallet, Landmark } from "lucide-react"

interface AgentStatus {
  id: string
  businessName: string | null
  status: string
  rejectReason: string | null
  customersCount: number
  documents: { id: string; docType: string; status: string }[]
}

interface WalletData {
  withdrawableBalance: number
  heldBalance: number
  pendingCommission: number
}

interface CommissionsData {
  byStatus: { status: string; total: number; count: number }[]
}

export default function AgentDashboard() {
  const [status, setStatus] = useState<AgentStatus | null | "none" | "loading">("loading")
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [commissions, setCommissions] = useState<CommissionsData | null>(null)

  useEffect(() => {
    let mounted = true
    api
      .get<AgentStatus | null>("/api/v1/agent/status")
      .then((d) => {
        if (mounted) setStatus(d ?? "none")
      })
      .catch(() => {
        if (mounted) setStatus("none")
      })
    api.get<WalletData>("/api/v1/agent/wallet").then((d) => mounted && setWallet(d)).catch(() => {})
    api.get<CommissionsData>("/api/v1/agent/commissions").then((d) => mounted && setCommissions(d)).catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (status === "none") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-lg font-bold">درخواست همکاری فروش ثبت نشده است</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              برای ثبت مشتری و دریافت پورسانت، ابتدا درخواست همکاری و مدارک لازم را ثبت کنید.
            </p>
            <Button asChild className="mt-5">
              <Link href="/agent/register">ثبت درخواست همکاری</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = status

  // نماینده در انتظار بررسی (AGENT-DASH-002 · BR-02)
  if (s.status !== "APPROVED") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            {s.status === "PENDING" || s.status === "UNDER_REVIEW" ? (
              <Hourglass className="mx-auto h-12 w-12 text-amber-500" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            )}
            <h1 className="mt-4 text-lg font-bold">
              {s.status === "PENDING" ? "درخواست شما در انتظار بررسی است" : s.status === "UNDER_REVIEW" ? "درخواست شما در حال بررسی است" : s.status === "REJECTED" ? "درخواست همکاری رد شده است" : "همکاری شما تعلیق شده است"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {["PENDING", "UNDER_REVIEW"].includes(s.status)
                ? "تا تأیید مدیر، امکان ثبت مشتری و فروش فعال نیست. وضعیت مدارک خود را از صفحه «مدارک همکاری» تکمیل کنید."
                : s.rejectReason ?? "برای پیگیری با پشتیبانی تماس بگیرید."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/agent/documents">مدارک همکاری</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/agent/register">مشاهده درخواست</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const approvedDocs = s.documents.filter((d) => d.status === "APPROVED").length

  return (
    <div>
      <PageHeader
        title={`داشبورد نماینده${s.businessName ? ` — ${s.businessName}` : ""}`}
        description="خلاصه فعالیت فروش، پورسانت و وضعیت مالی شما"
        action={
          <Button asChild>
            <Link href="/agent/customers">
              <UserPlus className="ml-1 h-4 w-4" />
              ثبت مشتری جدید
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="مشتریان ثبت‌شده" value={s.customersCount} icon={<Users2Icon />} />
        <StatCard title="مانده قابل برداشت" value={formatToman(wallet?.withdrawableBalance ?? 0)} tone="emerald" icon={<Wallet className="h-4 w-4" />} />
        <StatCard title="در انتظار تأیید پورسانت" value={formatToman(wallet?.pendingCommission ?? 0)} tone="amber" icon={<Coins className="h-4 w-4" />} />
        <StatCard title="نگه‌داشته (تسویه باز)" value={formatToman(wallet?.heldBalance ?? 0)} tone="sky" icon={<Landmark className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold">وضعیت پورسانت‌ها (REF-010)</h2>
            <div className="mt-3 space-y-2">
              {(commissions?.byStatus ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">هنوز پورسانتی ثبت نشده است.</p>
              ) : (
                (commissions?.byStatus ?? []).map((row) => (
                  <div key={row.status} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      <span className="text-xs text-muted-foreground">{row.count} مورد</span>
                    </span>
                    <span className="font-bold">{formatToman(row.total)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold">مدارک و وضعیت</h2>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <StatusBadge status={s.status} />
              <span className="text-muted-foreground">{approvedDocs} مدرک تأییدشده از {s.documents.length} مدرک</span>
            </div>
            <div className="mt-4 flex gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/agent/wallet">مشاهده کیف پول</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/agent/settlements">درخواست تسویه</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Users2Icon() {
  return <UserPlus className="h-4 w-4" />
}
