#!/bin/bash
# تست E2E سیاست تک‌نقشی (SINGLE-ROLE) + یکتایی کد ملی/موبایل (SINGLE-IDENTITY) — v0.2.3
# ۱) درخواست پزشک/نماینده برای حساب دارای نقش دیگر → 409
# ۲) درخواست پزشک با کد ملی تکراری (پروفایل دیگر / دارنده طرح) → 409
# ۳) فرم بدون کد ملی → 422
# ۴) assign_role ادمین → جایگزینی نقش قبلی (نه افزودن)
# ۵) revoke_role → بازگشت به USER
# ۶) هیچ کاربر چندنقشی در دیتابیس نمانده باشد
set -e
BASE="http://localhost:3000"
DB="/home/z/my-project/db/custom.db"

# ساخت نشست معتبر مستقیم در دیتابیس (بدون OTP — دور سقف ۵ کد/ساعت)
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

# کد ملی صحیح تستی (الگوریتم چک‌سام) — یکی برای پزشک جدید، یکی برای دارندهٔ طرح
# تولید کد ملی صحیح (چک‌سام) و مطمئناً یکتا نسبت به دیتابیس فعلی
python3 - "$DB" <<'PYEOF' > /tmp/e2e-nc.txt
import sqlite3, sys, random

def make_nc(base9):
    s = 0
    for i, d in enumerate(base9):
        s += int(d) * (10 - i)
    r = s % 11
    c = r if r < 2 else 11 - r
    return base9 + str(c)

db = sqlite3.connect(sys.argv[1])
def unique_nc():
    while True:
        nc = make_nc("".join(str(random.randint(1, 9)) for _ in range(9)))
        in_p = db.execute("SELECT 1 FROM UserProfile WHERE nationalCode=?", (nc,)).fetchone()
        in_h = db.execute("SELECT 1 FROM PlanHolder WHERE nationalCode=?", (nc,)).fetchone()
        if not in_p and not in_h:
            return nc

print(unique_nc())  # برای پزشک
print(unique_nc())  # برای دارندهٔ طرح
PYEOF
NC_DOCTOR=$(sed -n 1p /tmp/e2e-nc.txt)
NC_HOLDER=$(sed -n 2p /tmp/e2e-nc.txt)
echo "کدهای ملی تست: پزشک=$NC_DOCTOR · دارنده=$NC_HOLDER"

echo "════ ۰) مبنا: هیچ کاربر چندنقشی نیست ════"
python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
rows = db.execute('''SELECT u.mobile, COUNT(*) n FROM UserRole ur JOIN User u ON u.id=ur.userId
                     GROUP BY ur.userId HAVING n > 1''').fetchall()
assert not rows, f'کاربر چندنقش مانده: {rows}'
print('✅ صفر کاربر چندنقش')
"

echo
echo "════ ۱) پزشک فعلی (09121111102) نمی‌تواند نماینده شود → 409 ════"
login "09121111102" /tmp/dr-cookies.txt
CODE=$(curl -s -b /tmp/dr-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/v1/agent/register" -H "Content-Type: application/json" -d "{\"businessName\":\"تست تک‌نقش\",\"nationalCode\":\"$NC_DOCTOR\",\"province\":\"مازندران\",\"city\":\"ساری\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 160)"
[ "$CODE" = "409" ] || { echo "❌ انتظار 409"; exit 1; }

echo
echo "════ ۲) کاربر عادی (09120000001) نمی‌تواند پزشک شود با کد ملی متعلق به دارندهٔ طرح → 409 ════"
# دارندهٔ طرح با کد ملی تستی می‌سازیم (اگر نبود)
python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
uid = db.execute(\"SELECT id FROM User WHERE mobile='09120000000'\").fetchone()[0]
ex = db.execute('SELECT id FROM PlanHolder WHERE nationalCode=?', ('$NC_HOLDER',)).fetchone()
if not ex:
    db.execute('INSERT INTO PlanHolder (id, firstName, lastName, nationalCode, createdByUserId, createdAt, updatedAt) VALUES (?,?,?,?,?,datetime(\"now\"),datetime(\"now\"))',
               ('e2e-holder-single-role', 'دارنده', 'تستی', '$NC_HOLDER', uid))
db.commit()
print('دارندهٔ طرح آماده (کد ملی $NC_HOLDER)')
"
login "09120000001" /tmp/user-cookies.txt
CODE=$(curl -s -b /tmp/user-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/v1/doctor/register" -H "Content-Type: application/json" -d "{\"medicalCouncilCode\":\"99991\",\"nationalCode\":\"$NC_HOLDER\",\"specialty\":\"قلب و عروق\",\"clinicName\":\"مطب تست\",\"province\":\"مازندران\",\"city\":\"ساری\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 160)"
[ "$CODE" = "409" ] || { echo "❌ انتظار 409 (تکرار کد ملی دارندهٔ طرح)"; exit 1; }

echo
echo "════ ۳) درخواست پزشک بدون کد ملی → 422 ════"
CODE=$(curl -s -b /tmp/user-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/v1/doctor/register" -H "Content-Type: application/json" -d "{\"medicalCouncilCode\":\"99992\",\"specialty\":\"قلب و عروق\",\"clinicName\":\"مطب تست\",\"province\":\"مازندران\",\"city\":\"ساری\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 160)"
[ "$CODE" = "422" ] || { echo "❌ انتظار 422 (کد ملی الزامی)"; exit 1; }

echo
echo "════ ۴) درخواست پزشک موفق با کد ملی یکتا → نقش DOCTOR جایگزین USER (نه افزودن) ════"
# کاربر تازه با OTP؟ نه — کاربر عادی موجود 09120000005 می‌سازیم مستقیم در DB
python3 -c "
import sqlite3, secrets, time
db = sqlite3.connect('$DB')
ex = db.execute(\"SELECT id FROM User WHERE mobile='09129990001'\").fetchone()
if not ex:
    uid = secrets.token_hex(12)
    db.execute('INSERT INTO User (id, mobile, status, createdAt, updatedAt) VALUES (?,?,?,datetime(\"now\"),datetime(\"now\"))', (uid, '09129990001', 'ACTIVE'))
    db.execute('INSERT INTO UserProfile (id, userId, updatedAt) VALUES (?,?,datetime(\"now\"))', (secrets.token_hex(12), uid))
    rid = db.execute(\"SELECT id FROM Role WHERE name='USER'\").fetchone()[0]
    db.execute('INSERT INTO UserRole (id, userId, roleId, grantedAt) VALUES (?,?,?,datetime(\"now\"))', (secrets.token_hex(12), uid, rid))
    db.commit()
print('کاربر تست 09129990001 آماده')
"
login "09129990001" /tmp/newdr-cookies.txt
CODE=$(curl -s -b /tmp/newdr-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/v1/doctor/register" -H "Content-Type: application/json" -d "{\"medicalCouncilCode\":\"99993\",\"nationalCode\":\"$NC_DOCTOR\",\"specialty\":\"پوست و مو\",\"clinicName\":\"درمانگاه تست تک‌نقش\",\"province\":\"مازندران\",\"city\":\"ساری\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 160)"
[ "$CODE" = "200" ] || { echo "❌ انتظار 200"; exit 1; }
python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
roles = [r[0] for r in db.execute('''SELECT r.name FROM UserRole ur JOIN Role r ON r.id=ur.roleId
                                     JOIN User u ON u.id=ur.userId WHERE u.mobile='09129990001' ''').fetchall()]
print('نقش‌های کاربر جدید:', roles)
assert roles == ['DOCTOR'], f'انتظار فقط DOCTOR، شد: {roles}'
assert 'USER' not in roles, 'نقش USER نباید بماند (تک‌نقشی)'
print('✅ فقط DOCTOR — نقش قبلی USER حذف شد')
"

echo
echo "════ ۵) ادمین: تعیین نقش AGENT برای پزشک بالا → جایگزینی DOCTOR (نه افزودن) ════"
login "09120000000" /tmp/admin-cookies.txt
TARGET_ID=$(python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
print(db.execute(\"SELECT id FROM User WHERE mobile='09129990001'\").fetchone()[0])
")
CODE=$(curl -s -b /tmp/admin-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{\"action\":\"assign_role\",\"userId\":\"$TARGET_ID\",\"role\":\"AGENT\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 160)"
[ "$CODE" = "200" ] || { echo "❌ انتظار 200"; exit 1; }
python3 -c "
import sqlite3, json
d = json.load(open('/tmp/resp.json'))
assert d['data'].get('replacedPrevious') is True, 'replacedPrevious باید True باشد'
db = sqlite3.connect('$DB')
roles = [r[0] for r in db.execute('''SELECT r.name FROM UserRole ur JOIN Role r ON r.id=ur.roleId
                                     JOIN User u ON u.id=ur.userId WHERE u.mobile='09129990001' ''').fetchall()]
print('نقش‌ها پس از assign:', roles)
assert roles == ['AGENT'], f'انتظار فقط AGENT، شد: {roles}'
print('✅ DOCTOR جایگزین شد با AGENT (تک‌نقشی حفظ شد)')
"

echo
echo "════ ۶) ادمین: سلب نقش AGENT → بازگشت به USER ════"
CODE=$(curl -s -b /tmp/admin-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{\"action\":\"revoke_role\",\"userId\":\"$TARGET_ID\",\"role\":\"AGENT\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 120)"
[ "$CODE" = "200" ] || { echo "❌ انتظار 200"; exit 1; }
python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
roles = [r[0] for r in db.execute('''SELECT r.name FROM UserRole ur JOIN Role r ON r.id=ur.roleId
                                     JOIN User u ON u.id=ur.userId WHERE u.mobile='09129990001' ''').fetchall()]
print('نقش‌ها پس از revoke:', roles)
assert roles == ['USER'], f'انتظار فقط USER، شد: {roles}'
print('✅ بازگشت به USER')
"

echo
echo "════ ۷) سلب نقشی که ندارد → 404 ════"
CODE=$(curl -s -b /tmp/admin-cookies.txt -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{\"action\":\"revoke_role\",\"userId\":\"$TARGET_ID\",\"role\":\"AGENT\"}")
echo "HTTP $CODE"
[ "$CODE" = "404" ] || { echo "❌ انتظار 404"; exit 1; }

echo
echo "════ ۸) یکتایی کد ملی در پروفایل کاربر عادی هم چک دارندهٔ طرح شود → 409 ════"
CODE=$(curl -s -b /tmp/user-cookies.txt -o /tmp/resp.json -w "%{http_code}" -X PUT "$BASE/api/v1/user/profile" -H "Content-Type: application/json" -d "{\"nationalCode\":\"$NC_HOLDER\"}")
echo "HTTP $CODE · $(cat /tmp/resp.json | head -c 160)"
[ "$CODE" = "409" ] || { echo "❌ انتظار 409"; exit 1; }

echo
echo "════ ۹) جمع‌بندی: هیچ کاربر چندنقشی در کل دیتابیس نیست ════"
python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
rows = db.execute('''SELECT u.mobile, COUNT(*) n FROM UserRole ur JOIN User u ON u.id=ur.userId
                     GROUP BY ur.userId HAVING n > 1''').fetchall()
assert not rows, f'کاربر چندنقش مانده: {rows}'
total = db.execute('SELECT COUNT(*) FROM UserRole').fetchone()[0]
users = db.execute('SELECT COUNT(*) FROM User').fetchone()[0]
print(f'✅ {users} کاربر = {total} نقش (۱:۱)')
"

# پاک‌سازی دادهٔ تست (کاربر و پزشک تستی + دارندهٔ طرح تستی)
python3 -c "
import sqlite3
db = sqlite3.connect('$DB')
uid = db.execute(\"SELECT id FROM User WHERE mobile='09129990001'\").fetchone()
if uid:
    db.execute('DELETE FROM Doctor WHERE userId=?', (uid[0],))
    db.execute('DELETE FROM Session WHERE userId=?', (uid[0],))
    db.execute('DELETE FROM UserRole WHERE userId=?', (uid[0],))
    db.execute('DELETE FROM UserProfile WHERE userId=?', (uid[0],))
    db.execute('DELETE FROM User WHERE id=?', (uid[0],))
db.execute(\"DELETE FROM PlanHolder WHERE id='e2e-holder-single-role'\")
db.execute(\"DELETE FROM Session WHERE userAgent='e2e-test'\")
db.commit()
print('🧹 دادهٔ تست پاک شد')
"

echo
echo "════ همهٔ تست‌های تک‌نقشی و یکتایی هویت سبز است ✅ ════"
