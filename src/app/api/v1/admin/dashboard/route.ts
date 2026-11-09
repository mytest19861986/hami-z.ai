import { ok, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// داشبورد مدیریتی (REPORT-001 · ADMIN-027)
export async function GET() {
  const auth = await requirePermission("reports.view")
  if ("response" in auth) return auth.response

  const now = new Date()
  const [
    usersTotal, usersActive, doctorsApproved, doctorsPending,
    agentsApproved, agentsPending, activeMemberships, expiredMemberships,
    purchasesPending, purchasesSuccess, salesOpen, salesFinalized,
    commissionsPendingAgg, commissionsApprovedAgg, commissionsPaidAgg,
    settlementsPending, settlementsApproved, visitsTotal,
    monthStart,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.doctor.count({ where: { status: "APPROVED" } }),
    db.doctor.count({ where: { status: "PENDING" } }),
    db.agent.count({ where: { status: "APPROVED" } }),
    db.agent.count({ where: { status: "PENDING" } }),
    db.membership.count({ where: { status: "ACTIVE", endDate: { gte: now } } }),
    db.membership.count({ where: { OR: [{ status: "EXPIRED" }, { status: "CANCELLED" }, { endDate: { lt: now } }] } }),
    db.purchase.count({ where: { status: "PENDING" } }),
    db.purchase.count({ where: { status: "SUCCESS" } }),
    db.saleCustomer.count({ where: { status: { in: ["PENDING_REVIEW", "APPROVED", "CARD_ISSUED", "SENT", "DELIVERED", "PAYMENT_REGISTERED"] } } }),
    db.saleCustomer.count({ where: { status: "FINALIZED" } }),
    db.commission.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    db.commission.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    db.commission.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.settlementRequest.count({ where: { status: "PENDING" } }),
    db.settlementRequest.count({ where: { status: "APPROVED" } }),
    db.visit.count(),
    (async () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })(),
  ])

  const [newUsersThisMonth, salesThisMonthAgg] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: monthStart } } }),
    db.saleCustomer.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { paymentAmount: true } }),
  ])

  return ok({
    users: { total: usersTotal, active: usersActive, newThisMonth: newUsersThisMonth },
    doctors: { approved: doctorsApproved, pending: doctorsPending },
    agents: { approved: agentsApproved, pending: agentsPending },
    memberships: { active: activeMemberships, ended: expiredMemberships },
    purchases: { pending: purchasesPending, success: purchasesSuccess },
    sales: { open: salesOpen, finalized: salesFinalized },
    commissions: {
      pendingTotal: commissionsPendingAgg._sum.amount ?? 0,
      approvedTotal: commissionsApprovedAgg._sum.amount ?? 0,
      paidTotal: commissionsPaidAgg._sum.amount ?? 0,
    },
    settlements: { pending: settlementsPending, approved: settlementsApproved },
    visitsTotal,
    salesAmountThisMonth: salesThisMonthAgg._sum.paymentAmount ?? 0,
  })
}
