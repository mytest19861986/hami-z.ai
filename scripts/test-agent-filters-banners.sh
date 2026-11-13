#!/bin/bash
# تست E2E بخش‌های جدید:
# ۱) فیلتر بازه شمسی نماینده (مشتریان/پورسانت/کیف پول)
# ۲) صدور کارت: خودکار یکتا + دستی با چک یکتایی
# ۳) بنرهای صفحه اصلی: آپلود/لیست/فعال‌سازی/حذف + سرو عمومی + نمایش در صفحه اصلی
set -e
BASE="http://localhost:3000"
ADMIN="09120000000"

login() { # $1=mobile $2=cookie-file
  local MOB="$1" COOKIE="$2"
  for i in 1 2 3 4 5; do
    local SEND=$(curl -s -X POST "$BASE/api/v1/auth/send-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOB\"}")
    local CODE=$(echo "$SEND" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('devCode',''))" 2>/dev/null)
    if [ -n "$CODE" ]; then
      curl -s -c "$COOKIE" -X POST "$BASE/api/v1/auth/verify-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOB\",\"code\":\"$CODE\"}" | python3 -c "import json,sys; sys.exit(0 if json.load(sys.stdin).get('ok') else 1)" && return 0
    fi
    echo "  (rate limit — تلاش $i؛ ۶۵ ثانیه صبر)"
    sleep 65
  done
  return 1
}

login "$ADMIN" /tmp/e2e-adm.txt
echo "✓ ورود ادمین"

AGENT=$(python3 -c "
import sqlite3
db = sqlite3.connect('db/custom.db')
row = db.execute(\"SELECT u.mobile FROM Agent a JOIN User u ON a.userId=u.id WHERE a.status='APPROVED' LIMIT 1\").fetchone()
print(row[0] if row else '')
")
echo "  نماینده تست: ${AGENT:-نداریم!}"
if [ -n "$AGENT" ]; then
  login "$AGENT" /tmp/e2e-ag.txt
  echo "✓ ورود نماینده"

  echo "════ ۱-الف) مشتریان و فروش نماینده: بازه ════"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/customers" | python3 -c "import json,sys; print('  بدون بازه →', json.load(sys.stdin)['data']['total'], 'پرونده')"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/customers?from=2016-01-01&to=2016-12-31" | python3 -c "import json,sys; print('  بازه خالی ۲۰۱۶ →', json.load(sys.stdin)['data']['total'], '(باید 0)')"
  curl -s -b /tmp/e2e-ag.txt -o /dev/null -w "  از > تا → %{http_code} (باید 422)\n" "$BASE/api/v1/agent/customers?from=2026-11-10&to=2026-01-01"

  echo "════ ۱-ب) پورسانت‌های نماینده: فیلترها ════"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/commissions" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
print('  بدون فیلتر →', len(d['items']), 'قلم | کارت‌های وضعیت:', {x['status']: x['count'] for x in d['byStatus']})
"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/commissions?status=APPROVED" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
print('  وضعیت=تأییدشده →', len(d['items']), 'قلم | کارت‌ها:', {x['status']: x['count'] for x in d['byStatus']}, '(کارت‌ها هم باید فیلتر شده باشند)')
"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/commissions?from=2016-01-01&to=2016-12-31" | python3 -c "import json,sys; print('  بازه خالی ۲۰۱۶ →', len(json.load(sys.stdin)['data']['items']), '(باید 0)')"
  curl -s -b /tmp/e2e-ag.txt -o /dev/null -w "  از > تا → %{http_code} (باید 422)\n" "$BASE/api/v1/agent/commissions?from=2026-11-10&to=2026-01-01"

  echo "════ ۱-پ) کیف پول نماینده: بازه ════"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/wallet" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بدون بازه →', len(d['transactions']), 'تراکنش | filtered:', d['filtered'])"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/wallet?from=2016-01-01&to=2016-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بازه خالی ۲۰۱۶ →', len(d['transactions']), 'تراکنش (باید 0) | filtered:', d['filtered'])"
  curl -s -b /tmp/e2e-ag.txt "$BASE/api/v1/agent/wallet?from=2016-01-01&to=2026-12-31" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print('  بازه کامل →', len(d['transactions']), 'تراکنش')"
  curl -s -b /tmp/e2e-ag.txt -o /dev/null -w "  از > تا → %{http_code} (باید 422)\n" "$BASE/api/v1/agent/wallet?from=2026-11-10&to=2026-01-01"
fi

echo "════ ۲) صدور کارت: خودکار یکتا + دستی چک‌شده ════"
# پرونده فروش در وضعیت APPROVED برای صدور کارت
SALE=$(python3 -c "
import sqlite3
db = sqlite3.connect('db/custom.db')
row = db.execute(\"SELECT id FROM SaleCustomer WHERE status='APPROVED' LIMIT 1\").fetchone()
print(row[0] if row else '')
")
if [ -z "$SALE" ]; then
  # اگر نیست، یک پرونده PENDING را تأیید کنیم
  PENDING=$(python3 -c "
import sqlite3
db = sqlite3.connect('db/custom.db')
row = db.execute(\"SELECT id FROM SaleCustomer WHERE status='PENDING_REVIEW' LIMIT 1\").fetchone()
print(row[0] if row else '')
")
  if [ -n "$PENDING" ]; then
    curl -s -b /tmp/e2e-adm.txt -X POST "$BASE/api/v1/admin/sales" -H "Content-Type: application/json" -d "{\"action\":\"transition\",\"saleId\":\"$PENDING\",\"to\":\"APPROVED\"}" >/dev/null
    SALE=$PENDING
  fi
fi
if [ -n "$SALE" ]; then
  echo "  پرونده: $SALE"
  # چک یکتایی endpoint
  curl -s -b /tmp/e2e-adm.txt "$BASE/api/v1/admin/sales?checkCard=HK-TEST-CHECK" | python3 -c "import json,sys; print('  چک شماره آزاد → taken:', json.load(sys.stdin)['data']['taken'], '(باید False)')"
  # صدور خودکار (بدون cardNumber)
  RES=$(curl -s -b /tmp/e2e-adm.txt -X POST "$BASE/api/v1/admin/sales" -H "Content-Type: application/json" -d "{\"action\":\"transition\",\"saleId\":\"$SALE\",\"to\":\"CARD_ISSUED\"}")
  echo "  صدور خودکار: $(echo "$RES" | head -c 60)"
  GENERATED=$(python3 -c "
import sqlite3
db = sqlite3.connect('db/custom.db')
row = db.execute('SELECT cardNumber FROM SaleCustomer WHERE id=?', ('$SALE',)).fetchone()
print(row[0] if row and row[0] else '')
")
  echo "  شماره تولیدشده: $GENERATED"
  # حالا همان شماره را برای پرونده دیگری بزنیم → باید CARD_NUMBER_TAKEN (409)
  SALE2=$(python3 -c "
import sqlite3
db = sqlite3.connect('db/custom.db')
row = db.execute(\"SELECT id FROM SaleCustomer WHERE status='APPROVED' LIMIT 1\").fetchone()
print(row[0] if row else '')
")
  if [ -n "$SALE2" ] && [ -n "$GENERATED" ]; then
    curl -s -b /tmp/e2e-adm.txt -X POST "$BASE/api/v1/admin/sales" -H "Content-Type: application/json" -d "{\"action\":\"transition\",\"saleId\":\"$SALE2\",\"to\":\"CARD_ISSUED\",\"cardNumber\":\"$GENERATED\"}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  شماره تکراری → ok:', d.get('ok'), '| خطا:', d.get('error','')[:40], '(باید خطای استفاده‌شده)')
"
    # چک endpoint همان شماره → taken: true
    curl -s -b /tmp/e2e-adm.txt "$BASE/api/v1/admin/sales?checkCard=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$GENERATED'))")" | python3 -c "import json,sys; print('  چک همان شماره → taken:', json.load(sys.stdin)['data']['taken'], '(باید True)')"
  else
    echo "  (پرونده APPROVED دیگری برای تست تکراری نیست)"
  fi
else
  echo "  ⚠ پرونده‌ای در وضعیت مناسب برای صدور کارت نیست"
fi

echo "════ ۳) بنرهای صفحه اصلی ════"
# ساخت عکس PNG تست ۱×۱ (اما برای اسلایدر بهتر: ۴:۳ ساده با PIL)
python3 -c "
from PIL import Image
img = Image.new('RGB', (960, 720), (30, 160, 140))
img.save('/tmp/e2e-banner.png')
img2 = Image.new('RGB', (960, 720), (160, 60, 30))
img2.save('/tmp/e2e-banner2.png')
"
B64=$(base64 -w0 /tmp/e2e-banner.png)
B64_2=$(base64 -w0 /tmp/e2e-banner2.png)
RES=$(curl -s -b /tmp/e2e-adm.txt -X POST "$BASE/api/v1/admin/homepage-banners" -H "Content-Type: application/json" -d "{\"mode\":\"upload\",\"fileBase64\":\"$B64\",\"fileName\":\"تست بنر ۱\",\"title\":\"بنر تست E2E\",\"linkUrl\":\"/plans\"}")
echo "  آپلود بنر ۱: $(echo "$RES" | head -c 100)"
BID=$(echo "$RES" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['id'])")
RES2=$(curl -s -b /tmp/e2e-adm.txt -X POST "$BASE/api/v1/admin/homepage-banners" -H "Content-Type: application/json" -d "{\"mode\":\"upload\",\"fileBase64\":\"$B64_2\",\"fileName\":\"تست بنر ۲\",\"title\":\"بنر دوم\"}")
BID2=$(echo "$RES2" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['id'])")
echo "  آپلود بنر ۲: $BID2"

# فایل غیرتصویری → 422
curl -s -b /tmp/e2e-adm.txt -o /dev/null -w "  فایل غیرتصویری → %{http_code} (باید 422)\n" -X POST "$BASE/api/v1/admin/homepage-banners" -H "Content-Type: application/json" -d '{"mode":"upload","fileBase64":"aGVsbG8gd29ybGQgdGVzdA==","fileName":"bad"}'

# لیست ادمین
curl -s -b /tmp/e2e-adm.txt "$BASE/api/v1/admin/homepage-banners" | python3 -c "import json,sys; print('  لیست ادمین →', len(json.load(sys.stdin)['data']['banners']), 'بنر')"

# غیرفعال کردن بنر ۲
curl -s -b /tmp/e2e-adm.txt -X PUT "$BASE/api/v1/admin/homepage-banners" -H "Content-Type: application/json" -d "{\"bannerId\":\"$BID2\",\"isActive\":false}" | python3 -c "import json,sys; print('  غیرفعال‌سازی بنر ۲ → ok:', json.load(sys.stdin)['ok'])"

# لیست عمومی — فقط بنر فعال
curl -s "$BASE/api/v1/public/homepage-banners" | python3 -c "import json,sys; print('  لیست عمومی →', len(json.load(sys.stdin)['data']['banners']), 'بنر فعال (باید ۱)')"

# سرو عکس بنر
IMG_URL=$(curl -s "$BASE/api/v1/public/homepage-banners" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['banners'][0]['imageUrl'])")
curl -s -o /dev/null -w "  سرو عکس ($IMG_URL) → %{http_code} | نوع: %{content_type}\n" "$BASE$IMG_URL"

# path traversal → 422
curl -s -o /dev/null -w "  path traversal → %{http_code} (باید 422)\n" "$BASE/api/v1/public/banners/..%2F..%2Fcustom.db"

# صفحه اصلی: بنر رندر شده؟
curl -s "$BASE/" | grep -q "$IMG_URL" && echo "  ✓ بنر در HTML صفحه اصلی رندر شد" || echo "  ✗ بنر در صفحه اصلی پیدا نشد!"

# حذف بنر ۲ (غیرفعال) و تست حذف کامل
curl -s -b /tmp/e2e-adm.txt -X DELETE "$BASE/api/v1/admin/homepage-banners" -H "Content-Type: application/json" -d "{\"bannerId\":\"$BID2\"}" | python3 -c "import json,sys; print('  حذف بنر ۲ → ok:', json.load(sys.stdin)['ok'])"
curl -s -b /tmp/e2e-adm.txt "$BASE/api/v1/admin/homepage-banners" | python3 -c "import json,sys; print('  لیست نهایی →', len(json.load(sys.stdin)['data']['banners']), 'بنر (باید ۱ بماند)')"

echo "✓ تست‌های API تمام شد"
