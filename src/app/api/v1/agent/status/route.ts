import { ok, requireUser } from "@/lib/api"
import { db } from "@/lib/db"

// وضعیت درخواست همکاری و مدارک (AGENT-DASH-002/010)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const agent = await db.agent.findUnique({
    where: { userId: auth.user.id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      _count: { select: { customers: true } },
    },
  })
  if (!agent) return ok(null)
  return ok({
    id: agent.id,
    businessName: agent.businessName,
    description: agent.description,
    province: agent.province,
    city: agent.city,
    phone: agent.phone,
    status: agent.status,
    rejectReason: agent.rejectReason,
    reviewedAt: agent.reviewedAt,
    documents: agent.documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      fileName: d.fileName,
      status: d.status,
      rejectReason: d.rejectReason,
      createdAt: d.createdAt,
    })),
    customersCount: agent._count.customers,
  })
}
