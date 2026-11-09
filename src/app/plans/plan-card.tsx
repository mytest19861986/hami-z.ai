import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BadgePercent, ShieldCheck, Clock } from "lucide-react"
import { formatToman } from "@/lib/format"

export interface PlanCardData {
  id: string
  title: string
  description: string | null
  price: number
  durationDays: number
  discountPercent: number
  usageLimit: number | null
  features: string[]
}

export function PlanCard({ plan }: { plan: PlanCardData }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-6">
        <h3 className="text-lg font-bold">{plan.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        <div className="mt-4 text-2xl font-extrabold text-primary">{formatToman(plan.price)}</div>
        <ul className="mt-4 flex-1 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 shrink-0 text-primary" />
            {plan.discountPercent}٪ تخفیف ویزیت
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-emerald-600" />
            اعتبار {plan.durationDays} روز
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            {plan.usageLimit === null ? "استفاده نامحدود" : `${plan.usageLimit} مرتبه استفاده`}
          </li>
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              {f}
            </li>
          ))}
        </ul>
        <Button asChild className="mt-5 w-full">
          <Link href={`/plans/${plan.id}`}>جزئیات و خرید</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
