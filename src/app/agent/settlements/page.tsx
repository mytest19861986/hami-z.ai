"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { BankInfoForm, type BankInfo } from "@/components/shared/bank-info-form"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { maskCard, maskSheba } from "@/lib/validators"
import { Landmark, Info } from "lucide-react"

interface Settlement {
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

interface WalletSummary {
  withdrawableBalance: number
  heldBalance: number
  pendingCommission: number
}

export default function AgentSettlementsPage() {
  const [items, setItems] = useState<Settlement[] | null>(null)
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [amount, setAmount] = useState("")
  const [minAmount, setMinAmount] = useState(100000)
  const [bankInfo, setBankInfo] = useState<{ cardNumber: string | null; sheba: string | null; bankAccountName: string | null } | null>(null)
  const [loading, setLoading] = useState(false)

  function load() {
    api.get<Settlement[]>("/api/v1/agent/settlements").then(setItems).catch(() => setItems([]))
    api.get<WalletSummary>("/api/v1/agent/wallet").then(setWallet).catch(() => {})
    api.get<{ profile: BankInfo | null }>("/api/v1/user/profile")
      .then((d) => setBankInfo(d.profile))
      .catch(() => {})
  }

  useEffect(load, [])

  async function submit() {
    setLoading(true)
    try {
      const res = await api.post<{ trackingCode: string; message: string; minAmount: number }>("/api/v1/agent/settlements", {
        amount: parseInt(amount.replace(/\D/g, ""), 10),
      })
      setMinAmount(res.minAmount)
      toast({ title: "درخواست تسویه ثبت شد", description: `کد پیگیری: ${res.trackingCode}` })
      setAmount("")
      load()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function cancel(id: string) {
    try {
      await api.delete("/api/v1/agent/settlements", { id })
      toast({ title: "درخواست لغو شد", description: "مبلغ به مانده قابل برداشت بازگشت." })
      load()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  const hasOpen = (items ?? []).some((s) => ["PENDING", "APPROVED"].includes(s.status))
  const bankComplete = !!(bankInfo?.cardNumber && bankInfo?.sheba && bankInfo?.bankAccountName)

  return (
    <div>
      <PageHeader
        title="تسویه پورسانت"
        description="ثبت درخواست تسویه — پرداخت خارج از سامانه انجام و توسط مسئول مجاز ثبت می‌شود (SETTLE-016 · BR-20)."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Landmark className="h-5 w-5 text-primary" />
              درخواست جدید
            </h2>

            {!bankComplete ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    برای درخواست تسویه، تکمیل شماره کارت ۱۶ رقمی، شبا ۲۴ رقمی و نام صاحب حساب الزامی است
                    (SETTLE-002) — همین‌جا وارد کنید:
                  </span>
                </div>
                <BankInfoForm initial={bankInfo} showSavedBanner={false} onSaved={(info) => setBankInfo(info)} />
              </div>
            ) : (
              <div className="mt-4 space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <div>کارت: <span dir="ltr" className="font-mono">{maskCard(bankInfo!.cardNumber)}</span></div>
                <div>شبا: <span dir="ltr" className="font-mono">{maskSheba(bankInfo!.sheba)}</span></div>
                <div>صاحب حساب: {bankInfo!.bankAccountName}</div>
                <Link href="/agent/profile" className="font-semibold text-primary underline">ویرایش اطلاعات بانکی</Link>
              </div>
            )}

            <div className="mt-4 space-y-1.5">
              <label className="text-sm font-medium">مبلغ درخواست (تومان)</label>
              <Input dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-left" placeholder={String(minAmount)} />
              {amount ? <p className="text-xs text-muted-foreground">{formatToman(parseInt(amount.replace(/\D/g, ""), 10) || 0)}</p> : null}
            </div>

            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>مانده قابل برداشت: <span className="font-bold text-foreground">{formatToman(wallet?.withdrawableBalance ?? 0)}</span></div>
              <div>حداقل مبلغ مجاز: {formatToman(minAmount)}</div>
            </div>

            <Button
              className="mt-4 w-full"
              disabled={loading || hasOpen || !bankComplete || !amount || (wallet ? parseInt(amount.replace(/\D/g, "") || "0", 10) > wallet.withdrawableBalance : true)}
              onClick={submit}
            >
              {loading ? "در حال ثبت…" : hasOpen ? "درخواست باز دارید" : "ثبت درخواست تسویه"}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {!items ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : items.length === 0 ? (
            <EmptyState title="درخواستی ثبت نشده است" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map((s) => (
                    <div key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{formatToman(s.amount)}</span>
                          <StatusBadge status={s.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          کد پیگیری: <span className="font-mono" dir="ltr">{s.trackingCode}</span> · {faDateTime(s.createdAt)}
                        </div>
                        {s.paymentTrackingCode ? <div className="mt-1 text-xs text-emerald-700">کد پیگیری پرداخت: <span dir="ltr" className="font-mono">{s.paymentTrackingCode}</span>{s.paidAt ? ` · پرداخت: ${faDateTime(s.paidAt)}` : ""}</div> : null}
                        {s.reviewNote ? <div className="mt-1 text-xs text-muted-foreground">توضیح: {s.reviewNote}</div> : null}
                        {s.cancelReason ? <div className="mt-1 text-xs text-muted-foreground">علت لغو: {s.cancelReason}</div> : null}
                      </div>
                      {s.status === "PENDING" ? (
                        <Button variant="outline" size="sm" onClick={() => cancel(s.id)}>
                          لغو درخواست
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
