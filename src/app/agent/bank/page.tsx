"use client"

// داشبورد همکار فروش — ورود شماره کارت و شبا برای دریافت پورسانت (REF-SYS · SETTLE-002)
import { BankInfoForm } from "@/components/shared/bank-info-form"
import { PageHeader } from "@/components/shared/page-header"

export default function AgentBankPage() {
  return (
    <div>
      <PageHeader
        title="اطلاعات بانکی"
        description="شماره کارت ۱۶ رقمی و شبا ۲۴ رقمی شما — بدون تکمیل این اطلاعات، پورسانت‌های فروش شما تأیید نمی‌شود و امکان درخواست تسویه ندارید."
      />
      <div className="max-w-2xl">
        <BankInfoForm />
      </div>
    </div>
  )
}
