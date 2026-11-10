"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { Wallet, Clock, Lock, Coins, Landmark, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface WalletData {
  withdrawableBalance: number
  heldBalance: number
  pendingCommission: number
  transactions: {
    id: string
    type: string
    amount: number
    withdrawableDelta: number
    heldDelta: number
    balanceAfter: number
    note: string | null
    createdAt: string
  }[]
}

interface CommissionItem {
  id: string
  type: string
  planTitle: string
  baseAmount: number
  percent: number
  amount: number
  status: string
  customer: string | null
  createdAt: string
  approvedAt: string | null
}

interface SettlementItem {
  id: string
  amount: number
  status: string
  trackingCode: string
  reviewNote: string | null
  paymentTrackingCode: string | null
  cancelReason: string | null
  createdAt: string
  reviewedAt: string | null
  paidAt: string | null
}

interface ProfileRef {
  referral?: { bankInfoComplete: boolean } | null
}

export default function UserWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [commissions, setCommissions] = useState<CommissionItem[] | null>(null)
  const [settlements, setSettlements] = useState<SettlementItem[] | null>(null)
  const [profileRef, setProfileRef] = useState<ProfileRef | null>(null)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function loadAll() {
    api.get<WalletData>("/api/v1/agent/wallet").then(setWallet).catch(() => setWallet(null))
    api
      .get<{ items: CommissionItem[] }>("/api/v1/agent/commissions")
      .then((r) => setCommissions(r.items ?? []))
      .catch(() => setCommissions([]))
    api.get<SettlementItem[]>("/api/v1/agent/settlements").then(setSettlements).catch(() => setSettlements([]))
    api.get<ProfileRef>("/api/v1/user/profile").then(setProfileRef).catch(() => setProfileRef(null))
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function requestSettlement() {
    const n = parseInt(amount, 10)
    if (!n || n <= 0) {
      toast({ title: "خطا", description: "مبلغ درخواست تسویه را وارد کنید.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post<{ trackingCode: string; message: string }>("/api/v1/agent/settlements", { amount: n })
      toast({ title: "درخواست تسویه ثبت شد", description: `کد پیگیری: ${res.trackingCode}` })
      setAmount("")
      loadAll()
    } catch (e) {
      toast({ title: "خطا در ثبت درخواست", description: errMessage(e), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelSettlement(id: string) {
    setCancelling(id)
    try {
      await api.delete("/api/v1/agent/settlements", { id })
      toast({ title: "درخواست تسویه لغو شد", description: "مبلغ به مانده قابل برداشت شما بازگشت." })
      loadAll()
    } catch (e) {
      toast({ title: "خطا در لغو", description: errMessage(e), variant: "destructive" })
    } finally {
      setCancelling(null)
    }
  }

  if (!wallet || commissions === null || settlements === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const bankComplete = profileRef?.referral?.bankInfoComplete ?? false
  const hasOpenSettlement = settlements.some((s) => s.status === "PENDING" || s.status === "APPROVED")

  return (
    <div>
      <PageHeader
        title="کیف پول و پورسانت"
        description="پورسانت‌های معرفی (کد رفرال) و فروش شما — برای دریافت پورسانت، کارت بانکی و شبا در پروفایل الزامی است."
      />

      {!bankComplete ? (
        <Card className="mb-5 border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-bold text-amber-900">اطلاعات بانکی شما کامل نیست</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  تا زمان تکمیل شماره کارت ۱۶ رقمی و شبا ۲۴ رقمی در پروفایل، پورسانت‌های شما توسط مدیر تأیید و به کیف پول واریز نمی‌شود.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 border-amber-400 bg-white hover:bg-amber-100">
              <Link href="/user/profile">تکمیل اطلاعات بانکی</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="مانده قابل برداشت" value={formatToman(wallet.withdrawableBalance)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard title="در انتظار تأیید (پورسانت)" value={formatToman(wallet.pendingCommission)} tone="amber" icon={<Clock className="h-4 w-4" />} />
        <StatCard title="نگه‌داشته برای تسویه" value={formatToman(wallet.heldBalance)} tone="sky" icon={<Lock className="h-4 w-4" />} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* درخواست تسویه */}
        <Card>
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Landmark className="h-5 w-5 text-primary" />
              درخواست تسویه
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              مبلغ درخواست از مانده قابل برداشت نگه‌داشته و پس از بررسی و پرداخت خارج از سامانه تسویه می‌شود.
              {hasOpenSettlement ? " در حال حاضر یک درخواست باز دارید." : ""}
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                dir="ltr"
                inputMode="numeric"
                placeholder="مبلغ به تومان"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="text-left"
              />
              <Button disabled={submitting || !amount || hasOpenSettlement || wallet.withdrawableBalance <= 0} onClick={requestSettlement}>
                {submitting ? "در حال ثبت…" : "ثبت درخواست"}
              </Button>
            </div>
            {settlements.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">تاکنون درخواست تسویه‌ای ثبت نکرده‌اید.</p>
            ) : (
              <div className="mt-4 divide-y rounded-lg border">
                {settlements.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <div className="text-sm font-medium">{formatToman(s.amount)}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">{s.trackingCode} · {faDateTime(s.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      {s.status === "PENDING" ? (
                        <Button size="sm" variant="ghost" disabled={cancelling === s.id} onClick={() => cancelSettlement(s.id)}>
                          {cancelling === s.id ? "…" : "لغو"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* پورسانت‌ها */}
        <Card>
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Coins className="h-5 w-5 text-primary" />
              پورسانت‌های من
            </h2>
            {commissions.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="هنوز پورسانتی ثبت نشده"
                  description="دوستان را با کد رفرال خود (صفحه پروفایل) به حامی‌کارت دعوت کنید؛ با خرید طرح توسط آن‌ها پورسانت معرفی برای شما ثبت می‌شود."
                />
              </div>
            ) : (
              <div className="mt-4 max-h-96 divide-y overflow-y-auto rounded-lg border">
                {commissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <div className="text-sm font-medium">
                        {label(c.type)} · {c.planTitle}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {c.percent}٪ از {formatToman(c.baseAmount).replace(" تومان", "")}
                        {c.customer ? ` · خریدار: ${c.customer}` : ""} · {faDateTime(c.createdAt)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-emerald-700">{formatToman(c.amount).replace(" تومان", "")}</div>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* گردش کیف پول */}
      <h2 className="mb-3 mt-8 text-lg font-bold">گردش کیف پول</h2>
      {wallet.transactions.length === 0 ? (
        <EmptyState title="گردشی ثبت نشده است" description="با تأیید پورسانت‌های شما توسط مدیر، گردش کیف پول اینجا ثبت می‌شود." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 divide-y overflow-y-auto">
              {wallet.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-sm font-medium">{label(t.type)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.note ?? "—"} · {faDateTime(t.createdAt)}</div>
                  </div>
                  <div className="text-left">
                    <div
                      className={`text-sm font-bold ${
                        t.withdrawableDelta > 0 ? "text-emerald-700" : t.withdrawableDelta < 0 ? "text-rose-600" : ""
                      }`}
                    >
                      {t.withdrawableDelta !== 0
                        ? `${t.withdrawableDelta > 0 ? "+" : ""}${formatToman(t.withdrawableDelta).replace(" تومان", "")}`
                        : formatToman(t.amount).replace(" تومان", "")}
                    </div>
                    <div className="text-xs text-muted-foreground">مانده بعد: {formatToman(t.balanceAfter)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
