#!/bin/bash
# تست E2E بخش عملیات کاربران ادمین: ورود، لیست، آمار، ویرایش پروفایل، تعلیق/فعال‌سازی
set -e
BASE="http://localhost:3000"
JAR="/tmp/admin-cookies.txt"
rm -f "$JAR"

echo "=== 1) ورود ادمین ==="
LOGIN=$(curl -s -c "$JAR" -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"mobile":"09120000000","password":"Hami@Admin123"}')
echo "$LOGIN" | head -c 300; echo

echo ""
echo "=== 2) GET لیست کاربران (فیلدهای جدید پروفایل) ==="
USERS=$(curl -s -b "$JAR" "$BASE/api/v1/admin/users?page=1")
echo "$USERS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
users=d.get('data',d).get('users',[])
print('تعداد:',len(users))
for u in users[:3]:
    print('-',u['mobile'],'| name:',u.get('firstName'),u.get('lastName'),'| nc:',u.get('nationalCode'),'| bank:',u.get('cardNumber'),u.get('sheba'),'| city:',u.get('province'),u.get('city'))
" 

echo ""
echo "=== 3) انتخاب کاربر تست (09120000001) ==="
USER_ID=$(echo "$USERS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
users=d.get('data',d).get('users',[])
for u in users:
    if u['mobile']=='09120000001':
        print(u['id']); break
else:
    print(users[0]['id'] if users else '')
")
echo "userId=$USER_ID"

echo ""
echo "=== 4) GET آمار کاربر (stats) ==="
STATS=$(curl -s -b "$JAR" "$BASE/api/v1/admin/users/stats?userId=$USER_ID&from=2026-01-01&to=2026-11-12")
echo "$STATS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'data' in d: d=d['data']
print('user:',d['user']['name'],d['user']['mobile'])
print('totals:',json.dumps(d['totals'],ensure_ascii=False))
print('purchases:',len(d['purchases']),'| commissions:',len(d['commissions']))
" || echo "$STATS" | head -c 400

echo ""
echo "=== 5) POST ویرایش پروفایل (update_profile) ==="
EDIT=$(curl -s -b "$JAR" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{
  \"action\":\"update_profile\",
  \"userId\":\"$USER_ID\",
  \"firstName\":\"کاربر\",
  \"lastName\":\"تست Hami\",
  \"nationalCode\":\"3333333333\",
  \"province\":\"تهران\",
  \"city\":\"تهران\",
  \"address\":\"خیابان тест، پلاک ۱۲\",
  \"postalCode\":\"1234567890\",
  \"cardNumber\":\"6104330012345678\",
  \"sheba\":\"IR123456789012345678901234\",
  \"bankAccountName\":\"کاربر تست\"
}")
echo "$EDIT" | head -c 300; echo

echo ""
echo "=== 6) GET لیست — راستی‌آزمایی ذخیره‌سازی ==="
curl -s -b "$JAR" "$BASE/api/v1/admin/users?page=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
users=d.get('data',d).get('users',[])
for u in users:
    if u['id']=='$USER_ID':
        print('name:',u['firstName'],u['lastName'])
        print('nc:',u['nationalCode'],'| postal:',u['postalCode'])
        print('card:',u['cardNumber'],'| sheba:',u['sheba'],'| owner:',u['bankAccountName'])
        print('address:',u['address'],'| city:',u['province'],u['city'])
        break
"

echo ""
echo "=== 7) اعتبارسنجی: کد ملی خراب باید 422 بدهد ==="
curl -s -b "$JAR" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{
  \"action\":\"update_profile\",
  \"userId\":\"$USER_ID\",
  \"firstName\":\"کاربر\",
  \"lastName\":\"تست\",
  \"nationalCode\":\"123\",
  \"province\":\"\",
  \"city\":\"\"
}" | head -c 300; echo

echo ""
echo "=== 8) تعلیق و سپس فعال‌سازی مجدد ==="
SUSPEND=$(curl -s -b "$JAR" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{\"action\":\"set_status\",\"userId\":\"$USER_ID\",\"status\":\"SUSPENDED\",\"reason\":\"تست تعلیق از منوی عملیات\"}")
echo "تعلیق: $(echo "$SUSPEND" | head -c 200)"
REACT=$(curl -s -b "$JAR" -X POST "$BASE/api/v1/admin/users" -H "Content-Type: application/json" -d "{\"action\":\"set_status\",\"userId\":\"$USER_ID\",\"status\":\"ACTIVE\",\"reason\":\"فعال‌سازی مجدد پس از تست\"}")
echo "فعال‌سازی: $(echo "$REACT" | head -c 200)"
