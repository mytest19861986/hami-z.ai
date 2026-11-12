#!/bin/bash
# تست E2E ورود ادمین: ارسال OTP → تأیید → سشن → /api/v1/auth/me
set -e
BASE="http://localhost:3000"
MOBILE="09120000000"

echo "── ۱) ارسال OTP ──"
SEND=$(curl -s -X POST "$BASE/api/v1/auth/send-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOBILE\"}")
echo "$SEND"
CODE=$(echo "$SEND" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('devCode',''))" 2>/dev/null || true)
if [ -z "$CODE" ]; then echo "❌ devCode دریافت نشد"; exit 1; fi
echo "کد توسعه: $CODE"

echo "── ۲) تأیید OTP ──"
VERIFY=$(curl -s -c /tmp/admin-cookies.txt -X POST "$BASE/api/v1/auth/verify-otp" -H "Content-Type: application/json" -d "{\"mobile\":\"$MOBILE\",\"code\":\"$CODE\"}")
echo "$VERIFY" | head -c 300; echo

echo "── ۳) شناسایی سشن (/auth/me) ──"
ME=$(curl -s -b /tmp/admin-cookies.txt "$BASE/api/v1/auth/me")
echo "$ME" | head -c 400; echo

echo "$VERIFY" | grep -q '"ok":true' && echo "✅ ورود موفق" || echo "❌ ورود ناموفق"
