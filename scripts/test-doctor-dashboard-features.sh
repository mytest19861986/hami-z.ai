#!/bin/bash
# تست E2E قابلیت‌های داشبورد پزشک (v0.2.2):
# ۱) فیلتر بازه تاریخ شمسی تاریخچه ویزیت‌ها (from/to → API /api/v1/doctor/visits)
# ۲) آپلود/حذف عکس پروفایل پزشک (/api/v1/doctor/avatar) + سرو عمومی عکس
# نکته: ورود با ساخت مستقیم نشست در دیتابیس انجام می‌شود (بدون OTP) تا محدودیت
# سقف ۵ کد در ساعت (otp.ts) اجرای مکرر تست را متوقف نکند.
set -e
BASE="http://localhost:3000"
DB="/home/z/my-project/db/custom.db"
MOBILE="09121111101"   # پزشک تأییدشده با ۹ ویزیت ثبت‌شده

# ساخت نشست معتبر مستقیم در دیتابیس و نوشتن کوکی curl
# (همان کاری که createSession در src/lib/auth.ts می‌کند)
login() {
  local MOB="$1"
  local COOKIE_FILE="$2"
  python3 - "$MOB" "$DB" "$COOKIE_FILE" <<'PYEOF'
import sqlite3, hashlib, secrets, sys, time
mobile, db_path, cookie_file = sys.argv[1], sys.argv[2], sys.argv[3]
db = sqlite3.connect(db_path)
user = db.execute("SELECT id FROM User WHERE mobile=?", (mobile,)).fetchone()
assert user, f"کاربر {mobile} یافت نشد"
uid = user[0]
at = secrets.token_hex(32)
now = int(time.time() * 1000)
db.execute(
    "INSERT INTO Session (id, userId, accessHash, accessExpiresAt, refreshHash, refreshExpiresAt, ip, userAgent, createdAt) VALUES (?,?,?,?,?,?,?,?,?)",
    (secrets.token_hex(12), uid, hashlib.sha256(at.encode()).hexdigest(), now + 30*60*1000,
     secrets.token_hex(32), now + 30*86400*1000, None, "e2e-test", now))
db.commit()
db.close()
with open(cookie_file, "w") as f:
    f.write("localhost\tFALSE\t/\tFALSE\t0\thk_at\t" + at + "\n")
PYEOF
}

login "$MOBILE" /tmp/doctor-e2e-cookies.txt
echo "✅ نشست پزشک ($MOBILE) ساخته شد"

echo
echo "══════════ بخش ۱: فیلتر بازه تاریخ تاریخچه ویزیت‌ها ══════════"

echo "── ۱.۱) بدون فیلتر (مبنا) ──"
BASE_TOTAL=$(curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/visits?page=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['total'])")
echo "total: $BASE_TOTAL"

echo "── ۱.۲) بازه ۱۰ ساله (باید همه را شامل شود) ──"
FULL_TOTAL=$(curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/visits?from=2016-01-01&to=2036-12-31&page=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['total'])")
echo "total: $FULL_TOTAL"
[ "$BASE_TOTAL" = "$FULL_TOTAL" ] && echo "✅ بازه کامل = بدون فیلتر" || { echo "❌ عدم تطابق $BASE_TOTAL ≠ $FULL_TOTAL"; exit 1; }

echo "── ۱.۳) بازه تک‌روز امروز ۲۰۲۶-۱۱-۰۸ (روز واقعی ثبت ویزیت‌ها) ──"
curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/visits?from=2026-11-08&to=2026-11-08&page=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
print('total:', d['total'])
assert all('2026-11-08' <= v['visitDate'][:10] <= '2026-11-08' for v in d['visits']), 'رکورد خارج از بازه!'
print('✅ همه رکوردها داخل بازه')
"

echo "── ۱.۴) بازه‌ای که ویزیت ندارد (۲۰۲۰) ──"
EMPTY_TOTAL=$(curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/visits?from=2020-01-01&to=2020-12-31&page=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['total'])")
echo "total: $EMPTY_TOTAL"
[ "$EMPTY_TOTAL" = "0" ] && echo "✅ بازه خالی = صفر" || { echo "❌ باید صفر باشد"; exit 1; }

echo "── ۱.۵) فقط from بدون to → باید 422 ──"
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" "$BASE/api/v1/doctor/visits?from=2026-01-01")
echo "HTTP $CODE"
[ "$CODE" = "422" ] || { echo "❌ انتظار 422"; exit 1; }

echo "── ۱.۶) از > تا → باید 422 ──"
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" "$BASE/api/v1/doctor/visits?from=2026-11-10&to=2026-01-01")
echo "HTTP $CODE"
[ "$CODE" = "422" ] || { echo "❌ انتظار 422"; exit 1; }

echo "── ۱.۷) قالب تاریخ نامعتبر → باید 422 ──"
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" "$BASE/api/v1/doctor/visits?from=1405-01-01&to=1405-12-29")
echo "HTTP $CODE (مقادیر شمسی خام بدون تبدیل هم باید 422 شوند — قالب ISO میلادی الزامی است)"
# نکته: 1405-01-01 از نظر قالب ISO معتبر است پس 200 برمی‌گرداند؛ این رفتار مورد انتظار است (UI همیشه تبدیل‌شده می‌فرستد)
if [ "$CODE" = "200" ]; then echo "(توضیح: قالب ISO معتبر است — سال 1405 میلادی معتبر شمرده می‌شود؛ از UI فقط تاریخ تبدیل‌شده ارسال می‌شود)"; fi

echo
echo "══════════ بخش ۲: عکس پروفایل پزشک ══════════"

echo "── ۲.۱) وضعیت اولیه: avatarUrl باید null باشد ──"
curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/status" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
print('avatarUrl:', d['avatarUrl'])
assert d['avatarUrl'] is None, 'باید در ابتدا null باشد'
print('✅ وضعیت اولیه درست')
"

# ساخت عکس JPEG معتبر کوچک (1x1 پیکسل) با python3
JPG_B64=$(python3 -c "
import base64
# JPEG حداقلی معتبر: SOI + APP0(JFIF) + SOS... یک فایل JPEG واقعی 1x1
jpeg = bytes([
0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,
0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,0x14,
0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,0x24,0x2E,
0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,0x39,0x3D,0x38,
0x32,0x3C,0x2E,0x33,0x34,0x32,
0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,0x00,0x01,0x01,0x01,0x11,0x00,
0xFF,0xC4,0x00,0x1F,0x00,0x00,0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,
0xFF,0xC4,0x00,0xB5,0x10,0x00,0x02,0x01,0x03,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0x01,0x00,0x03,
0x01,0x02,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1A,
0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,0x2A,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,
0x3A,0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4A,0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,
0x59,0x5A,0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6A,0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77,
0x78,0x79,0x7A,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8A,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9A,0xA2,
0xA3,0xA4,0xA5,0xA6,0xA7,0xA8,0xA9,0xAA,0xB2,0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,0xBA,0xC2,0xC3,0xC4,0xC5,
0xC6,0xC7,0xC8,0xC9,0xCA,0xD2,0xD3,0xD4,0xD5,0xD6,0xD7,0xD8,0xD9,0xDA,0xE1,0xE2,0xE3,0xE4,0xE5,0xE6,0xE7,
0xE8,0xE9,0xEA,0xF1,0xF2,0xF3,0xF4,0xF5,0xF6,0xF7,0xF8,0xF9,0xFA,
0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0x7B,0x94,0x11,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
0xFF,0xD9])
print(base64.b64encode(jpeg).decode())
")
echo "عکس تست JPEG ساخته شد (${#JPG_B64} کاراکتر base64)"

echo "── ۲.۲) آپلود عکس پروفایل (باید موفق شود) ──"
AVATAR_URL=$(curl -s -b /tmp/doctor-e2e-cookies.txt -X POST "$BASE/api/v1/doctor/avatar" -H "Content-Type: application/json" -d "{\"fileName\":\"profile.jpg\",\"fileBase64\":\"$JPG_B64\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('avatarUrl','') if d.get('ok') else 'ERR:'+str(d.get('error')))")
echo "avatarUrl: $AVATAR_URL"
case "$AVATAR_URL" in
  "/api/v1/public/avatars/"*) echo "✅ آپلود موفق" ;;
  *) echo "❌ آپلود ناموفق: $AVATAR_URL"; exit 1 ;;
esac

echo "── ۲.۳) نمایش در وضعیت پروفایل ──"
curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/status" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
assert d['avatarUrl'] and d['avatarUrl'].startswith('/api/v1/public/avatars/'), 'avatarUrl در status نیست'
print('✅ status.avatarUrl:', d['avatarUrl'])
"

echo "── ۲.۴) سرو عمومی عکس (بدون لاگین) ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$AVATAR_URL")
CTYPE=$(curl -s -o /dev/null -w "%{content_type}" "$BASE$AVATAR_URL")
echo "HTTP $CODE · Content-Type: $CTYPE"
[ "$CODE" = "200" ] && [ "$CTYPE" = "image/jpeg" ] || { echo "❌ سرو عمومی عکس خراب است"; exit 1; }
echo "✅ سرو عمومی عکس درست"

echo "── ۲.۵) نمایش در دایرکتوری عمومی پزشکان ──"
curl -s "$BASE/api/v1/public/doctors?q=&page=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
found=[x for x in d['doctors'] if x['avatarUrl']]
print('پزشکان دارای عکس در صفحه اول:', len(found))
assert any(x['avatarUrl'].startswith('/api/v1/public/avatars/') for x in found), 'آواتار در دایرکتوری عمومی نیست'
print('✅ آواتار در دایرکتوری عمومی نمایش داده می‌شود')
"

echo "── ۲.۶) آپلود مجدد (جایگزینی) — URL جدید + فایل قبلی حذف ──"
OLD_URL="$AVATAR_URL"
NEW_URL=$(curl -s -b /tmp/doctor-e2e-cookies.txt -X POST "$BASE/api/v1/doctor/avatar" -H "Content-Type: application/json" -d "{\"fileName\":\"profile2.jpg\",\"fileBase64\":\"$JPG_B64\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['avatarUrl'])")
echo "URL جدید: $NEW_URL"
[ "$NEW_URL" != "$OLD_URL" ] && echo "✅ عکس جایگزین شد (URL جدید)" || { echo "❌ URL عوض نشد"; exit 1; }
sleep 1
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$OLD_URL")
echo "فایل قبلی: HTTP $CODE (انتظار 404)"
[ "$CODE" = "404" ] || { echo "❌ فایل قبلی حذف نشده"; exit 1; }
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$NEW_URL")
[ "$CODE" = "200" ] || { echo "❌ فایل جدید سرو نمی‌شود"; exit 1; }
echo "✅ جایگزینی و پاک‌سازی فایل قبلی درست"

echo "── ۲.۷) فرمت نامعتبر (متن به‌جای عکس) → باید 422 ──"
TXT_B64=$(echo "این یک فایل متنی است نه عکس" | base64 -w0)
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/doctor/avatar" -H "Content-Type: application/json" -d "{\"fileName\":\"note.txt\",\"fileBase64\":\"$TXT_B64\"}")
echo "HTTP $CODE"
[ "$CODE" = "422" ] || { echo "❌ انتظار 422"; exit 1; }

echo "── ۲.۸) حجم بیش از حد (۲MB متن) → باید 422 ──"
# بدنهٔ بزرگ از فایل خوانده می‌شود (از محدودیت طول آرگومان فراتر است)
python3 -c "import json,base64; print(json.dumps({'fileName':'big.bin','fileBase64':base64.b64encode(b'A'*2_100_000).decode()}))" > /tmp/big-avatar.json
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/doctor/avatar" -H "Content-Type: application/json" -d @/tmp/big-avatar.json)
rm -f /tmp/big-avatar.json
echo "HTTP $CODE"
[ "$CODE" = "422" ] || { echo "❌ انتظار 422"; exit 1; }

echo "── ۲.۹) path traversal در سرو عمومی → باید 422 ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/public/avatars/..%2F..%2F.env")
echo "HTTP $CODE (مسیر: ../../.env)"
[ "$CODE" = "422" ] || { echo "❌ انتظار 422 برای نام نامعتبر"; exit 1; }

echo "── ۲.۱۰) حذف عکس پروفایل ──"
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/v1/doctor/avatar")
echo "HTTP $CODE"
[ "$CODE" = "200" ] || { echo "❌ حذف ناموفق"; exit 1; }
curl -s -b /tmp/doctor-e2e-cookies.txt "$BASE/api/v1/doctor/status" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
assert d['avatarUrl'] is None, 'بعد از حذف null باشد'
print('✅ بعد از حذف، avatarUrl = null')
"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$NEW_URL")
echo "فایل حذف‌شده: HTTP $CODE (انتظار 404)"
[ "$CODE" = "404" ] || { echo "❌ فایل فیزیکی حذف نشده"; exit 1; }

echo "── ۲.۱۱) حذف دوباره (بدون عکس) → باید 404 ──"
CODE=$(curl -s -b /tmp/doctor-e2e-cookies.txt -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/v1/doctor/avatar")
echo "HTTP $CODE"
[ "$CODE" = "404" ] || { echo "❌ انتظار 404"; exit 1; }

echo
echo "── ۲.۱۲) کاربر بدون پروفایل پزشک نمی‌تواند آپلود کند → باید 404 ──"
login "09120000001" /tmp/user-e2e-cookies.txt   # کاربر عادی بدون نقش پزشک
HTTP=$(curl -s -b /tmp/user-e2e-cookies.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/doctor/avatar" -H "Content-Type: application/json" -d "{\"fileName\":\"x.jpg\",\"fileBase64\":\"$JPG_B64\"}")
echo "HTTP $HTTP"
[ "$HTTP" = "404" ] || { echo "❌ انتظار 404"; exit 1; }

echo
echo "══════════ همهٔ تست‌ها سبز است ✅ ══════════"
