#!/bin/bash
# تست جریان خرید: کاربر طرح می‌خرد → ادمین باید در داشبورد ببیند
set -e
BASE="http://localhost:3000"
JAR_USER=/tmp/user-cookies.txt
JAR_ADMIN=/tmp/admin-cookies.txt
rm -f $JAR_USER $JAR_ADMIN

echo "=== 1) ورود کاربر 09120000001 ==="
OTP=$(curl -s -X POST $BASE/api/v1/auth/send-otp -H 'Content-Type: application/json' -d '{"mobile":"09120000001"}' -c $JAR_USER)
echo "$OTP"
CODE=$(echo "$OTP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.devCode)}catch(e){console.log('')}})")
echo "devCode: $CODE"
curl -s -X POST $BASE/api/v1/auth/verify-otp -H 'Content-Type: application/json' -d "{\"mobile\":\"09120000001\",\"code\":\"$CODE\"}" -b $JAR_USER -c $JAR_USER
echo ""

echo "=== 2) ثبت درخواست خرید (طرح برنزی، دارنده علی محمدی) ==="
curl -s -X POST $BASE/api/v1/user/purchases -H 'Content-Type: application/json' \
  -d '{"planId":"cmw9gkh3d003xndma3jxucos3","holderId":"cmw9hq3g6000hnd3vd8m7xggk"}' \
  -b $JAR_USER -c $JAR_USER
echo ""

echo "=== 3) ورود ادمین 09120000000 ==="
OTP2=$(curl -s -X POST $BASE/api/v1/auth/send-otp -H 'Content-Type: application/json' -d '{"mobile":"09120000000"}' -c $JAR_ADMIN)
CODE2=$(echo "$OTP2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data.devCode)}catch(e){console.log('')}})")
curl -s -X POST $BASE/api/v1/auth/verify-otp -H 'Content-Type: application/json' -d "{\"mobile\":\"09120000000\",\"code\":\"$CODE2\"}" -b $JAR_ADMIN -c $JAR_ADMIN > /dev/null
echo "admin logged in"

echo "=== 4) داشبورد ادمین ==="
curl -s $BASE/api/v1/admin/dashboard -b $JAR_ADMIN | head -c 1500
echo ""
echo "=== 5) لیست خریدهای ادمین ==="
curl -s "$BASE/api/v1/admin/purchases" -b $JAR_ADMIN | head -c 2000
echo ""
