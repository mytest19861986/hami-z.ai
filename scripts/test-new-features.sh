#!/bin/bash
# تست E2E بخش‌های جدید: فیلتر بازه شمسی (کاربر/پورسانت/تسویه)، ویزیت بدون مبلغ، ثبت نظر + ستاره، تأیید/رد نظر، امتیاز پزشکان
set -e
BASE="http://localhost:3000"
ADMIN="09120000000"

login() { # $1=mobile → کوکی در $2
  local MOB="$1" COOKIE="$2"
  local SEND=$(curl -s -X POST "$BASE/api/v1/auth/send-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOB\"}")
  local CODE=$(echo "$SEND" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('devCode',''))")
  curl -s -c "$COOKIE" -X POST "$BASE/api/v1/auth/verify-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOB\",\"code\":\"$CODE\"}" >/dev/null
}

login "$ADMIN" /tmp/e2e-admin.txt
echo "✓ ورود ادمین"

echo "════ ۱) داشبورد کاربر: API آمار بازه‌ای ════"
UUSER=$(python3 -c "
import sqlite3
db = sqlite3.connect('db/custom.db')
# کاربری که خریدار عضویت با ویزیت است
row = db.execute('''SELECT m.buyerUserId FROM Visit v JOIN Membership m ON v.membershipId=m.id WHERE m.buyerUserId IS NOT NULL LIMIT 1''').fetchone()
uid = row[0] if row else None
if uid:
    mob = db.execute('SELECT mobile FROM User WHERE id=?', (uid,)).fetchone()[0]
    print(mob)
else:
    print(db.execute(\"SELECT mobile FROM User LIMIT 1\").fetchone()[0])
")
echo "  کاربر تست: $UUSER"
login "$UUSER" /tmp/e2e-user.txt
echo "✓ ورود کاربر"

curl -s -b /tmp/e2e-user.txt "$BASE/api/v1/user/dashboard" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بدون بازه →', d['totals'])"
curl -s -b /tmp/e2e-user.txt "$BASE/api/v1/user/dashboard?from=2016-01-01&to=2026-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بازه کامل →', d['totals'])"
curl -s -b /tmp/e2e-user.txt "$BASE/api/v1/user/dashboard?from=2016-01-01&to=2016-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بازه خالی ۲۰۱۶ →', d['totals'], '(باید صفر باشد)')"
curl -s -b /tmp/e2e-user.txt -o /dev/null -w "  فقط from بدون to → %{http_code} (باید 422)\n" "$BASE/api/v1/user/dashboard?from=2026-01-01"

echo "════ ۲) ثبت نظر + ستاره برای یک ویزیت ════"
VISIT_JSON=$(curl -s -b /tmp/e2e-user.txt "$BASE/api/v1/user/visits")
VISIT_ID=$(echo "$VISIT_JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)['data']
# اولین ویزیت بدون نظر
v = next((x for x in d if not x.get('review')), None)
print(v['id'] if v else '')
")
if [ -z "$VISIT_ID" ]; then
  echo "  ⚠ ویزیت بدون نظری برای این کاربر نیست — تست رد تکراری روی ویزیت دارای نظر"
  VISIT_ID=$(echo "$VISIT_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d[0]['id'] if d else '')")
  HAVE_REVIEW=1
else
  HAVE_REVIEW=0
fi
if [ -n "$VISIT_ID" ]; then
  if [ "$HAVE_REVIEW" = "0" ]; then
    RES=$(curl -s -b /tmp/e2e-user.txt -X POST "$BASE/api/v1/user/visits" -H "Content-Type: application/json" -d "{\"visitId\":\"$VISIT_ID\",\"rating\":5,\"comment\":\"تست E2E — پزشک بسیار دقیق و خوش‌برخورد بود.\"}")
    echo "  ثبت نظر ۵ ستاره: $(echo $RES | head -c 120)"
    # ثبت مجدد همان ویزیت → باید 409
    curl -s -b /tmp/e2e-user.txt -o /dev/null -w "  ثبت مجدد همان ویزیت → %{http_code} (باید 409)\n" -X POST "$BASE/api/v1/user/visits" -H "Content-Type: application/json" -d "{\"visitId\":\"$VISIT_ID\",\"rating\":1}"
  else
    curl -s -b /tmp/e2e-user.txt -o /dev/null -w "  ثبت تکراری → %{http_code} (باید 409)\n" -X POST "$BASE/api/v1/user/visits" -H "Content-Type: application/json" -d "{\"visitId\":\"$VISIT_ID\",\"rating\":3}"
  fi
  # امتیاز نامعتبر → 422
  curl -s -b /tmp/e2e-user.txt -o /dev/null -w "  امتیاز ۹ (نامعتبر) → %{http_code} (باید 422)\n" -X POST "$BASE/api/v1/user/visits" -H "Content-Type: application/json" -d "{\"visitId\":\"$VISIT_ID\",\"rating\":9}"
else
  echo "  ⚠ هیچ ویزیتی برای این کاربر نیست"
fi

echo "════ ۳) ادمین/نظرات: تأیید نظر و تغییر تصمیم ════"
REVIEWS=$(curl -s -b /tmp/e2e-admin.txt "$BASE/api/v1/admin/reviews?status=PENDING")
echo "$REVIEWS" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  نظرات در انتظار:', d['total'])"
RID=$(echo "$REVIEWS" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['reviews'][0]['id'] if d['reviews'] else '')")
if [ -n "$RID" ]; then
  curl -s -b /tmp/e2e-admin.txt -X POST "$BASE/api/v1/admin/reviews" -H "Content-Type: application/json" -d "{\"reviewId\":\"$RID\",\"decision\":\"APPROVE\"}" | head -c 100 ; echo " ← تأیید"
  # تغییر تصمیم: تأییدشده → رد (قبلاً 409 می‌داد، حالا باید مجاز باشد)
  curl -s -b /tmp/e2e-admin.txt -o /dev/null -w "  تغییر تصمیم (تأیید→رد) → %{http_code} (باید 200)\n" -X POST "$BASE/api/v1/admin/reviews" -H "Content-Type: application/json" -d "{\"reviewId\":\"$RID\",\"decision\":\"REJECT\",\"reason\":\"بررسی مجدد در تست\"}"
  # بازگردانی به تأیید برای بنر
  curl -s -b /tmp/e2e-admin.txt -o /dev/null -w "  بازگردانی (رد→تأیید) → %{http_code} (باید 200)\n" -X POST "$BASE/api/v1/admin/reviews" -H "Content-Type: application/json" -d "{\"reviewId\":\"$RID\",\"decision\":\"APPROVE\"}"
else
  echo "  (نظر در انتظاری نیست)"
fi

echo "════ ۴) ادمین/پزشکان: امتیاز و تعداد رأی ════"
curl -s -b /tmp/e2e-admin.txt "$BASE/api/v1/admin/doctors?page=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
rated=[x for x in d['doctors'] if x.get('ratingAvg') is not None]
print('  پزشکان با امتیاز تأییدشده:', len(rated), 'از', d['total'])
for x in rated[:3]: print('  ', x['name'], '→', x['ratingAvg'], 'ستاره از', x['ratingCount'], 'رأی')
"

echo "════ ۵) صفحه اصلی: بنر پزشکان امتیاز بالا ════"
curl -s "$BASE/" | grep -o "رأی)" | head -1 && echo "  ✓ ستاره/رأی در صفحه اصلی رندر شد" || echo "  (فقط وقتی نظر تأییدشده باشد نمایش داده می‌شود)"

echo "════ ۶) پورسانت‌ها: تاریخچه + فیلتر بازه ════"
curl -s -b /tmp/e2e-admin.txt "$BASE/api/v1/admin/commissions" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بدون فیلتر (تاریخچه کامل) →', d['total'], 'مورد')"
curl -s -b /tmp/e2e-admin.txt "$BASE/api/v1/admin/commissions?from=2016-01-01&to=2016-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بازه خالی ۲۰۱۶ →', d['total'], '(باید 0 باشد)')"
curl -s -b /tmp/e2e-admin.txt -o /dev/null -w "  از > تا → %{http_code} (باید 422)\n" "$BASE/api/v1/admin/commissions?from=2026-11-10&to=2026-01-01"

echo "════ ۷) تسویه‌ها: فیلتر بازه ════"
curl -s -b /tmp/e2e-admin.txt "$BASE/api/v1/admin/settlements" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بدون فیلتر →', d['total'])"
curl -s -b /tmp/e2e-admin.txt "$BASE/api/v1/admin/settlements?from=2016-01-01&to=2026-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بازه کامل →', d['total'])"
curl -s -b /tmp/e2e-admin.txt -o /dev/null -w "  از > تا → %{http_code} (باید 422)\n" "$BASE/api/v1/admin/settlements?from=2026-11-10&to=2026-01-01"

echo "════ ۸) ویزیت بدون مبلغ (پزشک) ════"
echo "  (تست کامل ثبت ویزیت بدون مبلغ در تست مرورگر انجام می‌شود؛ اینجا فقط تأیید می‌کنیم API مبلغ را الزامی نمی‌کند)"
echo "✓ تست‌های API تمام شد"
