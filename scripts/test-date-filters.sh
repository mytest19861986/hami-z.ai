#!/bin/bash
# تست E2E فیلترهای جدید: بازه تاریخ شمسی + وضعیت (خریدهای مستقیم و فروش و کارت)
set -e
BASE="http://localhost:3000"
MOBILE="09120000000"

login() {
  local SEND=$(curl -s -X POST "$BASE/api/v1/auth/send-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOBILE\"}")
  local CODE=$(echo "$SEND" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('devCode',''))")
  curl -s -c /tmp/filter-cookies.txt -X POST "$BASE/api/v1/auth/verify-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOBILE\",\"code\":\"$CODE\"}" >/dev/null
  echo "ورود ادمین انجام شد"
}

login

echo "════ ۱) خریدهای مستقیم: بدون فیلتر (مبنا) ════"
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/purchases?page=1" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('total:', d['total'])"

echo "════ ۲) خریدها: بازه ۱۰ ساله (باید همه را شامل شود) ════"
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/purchases?from=2016-01-01&to=2026-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('total:', d['total'])"

echo "════ ۳) خریدها: بازه نامعتبر (فقط from بدون to) → باید 422 ════"
curl -s -b /tmp/filter-cookies.txt -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/admin/purchases?from=2026-01-01"

echo "════ ۴) خریدها: از > تا → باید 422 ════"
curl -s -b /tmp/filter-cookies.txt -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/admin/purchases?from=2026-11-10&to=2026-01-01"

echo "════ ۵) خریدها: بازه امروز + وضعیت PENDING (ترکیب فیلترها) ════"
TODAY=$(date +%F)
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/purchases?from=$TODAY&to=$TODAY&status=PENDING" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('total:', d['total']); [print(' ', p['status'], p['createdAt'][:10], p['trackingCode']) for p in d['purchases'][:3]]"

echo "════ ۶) فروش و کارت: بدون فیلتر (مبنا) ════"
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/sales?page=1" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('total:', d['total'])"

echo "════ ۷) فروش: بازه ۱۰ ساله (باید همه را شامل شود) ════"
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/sales?from=2016-01-01&to=2026-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('total:', d['total'])"

echo "════ ۸) فروش: از > تا → باید 422 ════"
curl -s -b /tmp/filter-cookies.txt -o /dev/null -w "%{http_code}\n" "$BASE/api/v1/admin/sales?from=2026-11-10&to=2026-01-01"

echo "════ ۹) فروش: بازه امروز + وضعیت PENDING_REVIEW ════"
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/sales?from=$TODAY&to=$TODAY&status=PENDING_REVIEW" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('total:', d['total']); [print(' ', s['status'], s['createdAt'][:10], s['holder']) for s in d['sales'][:3]]"

echo "════ ۱۰) صحت‌سنجی مرز بازه: همه رکوردهای خروجی داخل بازه باشند ════"
curl -s -b /tmp/filter-cookies.txt "$BASE/api/v1/admin/purchases?from=2026-01-01&to=2026-12-31&pageSize=100" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
bad=[p['trackingCode'] for p in d['purchases'] if not ('2026-01-01' <= p['createdAt'][:10] <= '2026-12-31')]
print('رکورد خارج از بازه:', len(bad), bad[:3] if bad else '(همه داخل بازه ✅)')
"
