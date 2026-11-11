import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log('=== E2E RESULT: purchase HK-BT1OXF3229 (زهرا / طرح طلایی) ===');
  const p = await db.purchase.findUnique({
    where: { trackingCode: 'HK-BT1OXF3229' },
    include: { plan: true, buyer: true, holder: true, membership: true },
  });
  if (!p) { console.log('NOT FOUND'); return; }
  console.log(`status=${p.status} amount=${p.amount} approvedAt=${p.approvedAt?.toISOString()}`);
  console.log(`buyer=${p.buyer.mobile} holder=${p.holder.firstName} ${p.holder.lastName} plan="${p.plan.title}"`);
  console.log(`membership=${p.membership ? `${p.membership.id} status=${p.membership.status} serial=${p.membership.cardSerial} end=${p.membership.endDate.toISOString().slice(0, 10)}` : 'NONE'}`);

  console.log('\n=== زهرا memberships ===');
  const u = await db.user.findUnique({ where: { mobile: '09121234567' } });
  const ms = await db.membership.findMany({
    where: { holder: { createdByUserId: u.id } },
    include: { plan: true, holder: true },
  });
  for (const m of ms) console.log(`plan="${m.plan.title}" holder="${m.holder.firstName}" status=${m.status} serial=${m.cardSerial} end=${m.endDate.toISOString().slice(0, 10)}`);

  console.log('\n=== زهرا notifications (3) ===');
  const ns = await db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 3 });
  for (const n of ns) console.log(`${n.createdAt.toISOString()} | ${n.type} | ${n.title}`);

  console.log('\n=== audit log (2 latest for this purchase) ===');
  const al = await db.auditLog.findMany({ where: { entityId: p.id }, orderBy: { createdAt: 'asc' } });
  for (const a of al) console.log(`${a.createdAt.toISOString()} | ${a.action} | actor=${a.actorName ?? '-'}`);

  console.log('\n=== watcher alive? ===');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
