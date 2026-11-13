#!/bin/bash
# ساخت GitHub Release برای v0.2.1
set -e
TOKEN=$(sed 's|https://mytest19861986:||; s|@github.com||' /home/z/my-project/.git/credentials-local)
REPO="mytest19861986/hami-z.ai"

cat > /tmp/release-body.json <<'EOF'
{
  "tag_name": "v0.2.1",
  "target_commitish": "main",
  "name": "v0.2.1 — کارت برند به‌عنوان بنر پیش‌فرض اسلایدر صفحه اصلی",
  "body": "## کارت برند = اسلاید اول همیشگی 🎴\n\nبازخورد مالک روی v0.2.0 اعمال شد: بنر پیش‌فرض اسلایدر همان **ماکاپ زیبای کارت برند** است (شمسهٔ طلایی، بافت گره‌چینی، نشان «عضویت»، تخفیف ویزیت ۳۰٪ و نوار طرح پیشنهادی) و همیشه به‌عنوان اسلاید اول نمایش داده می‌شود. بنرهایی که ادمین اضافه می‌کند پس از آن هر ۵ ثانیه چرخش می‌کنند.\n\n### تغییرات\n- **صفحهٔ اصلی:** کارت برند داخل خود اسلایدر رندر می‌شود (SSR کامل)؛ نشانگر اول «کارت برند» نام دارد؛ نوار «طرح پیشنهادی» با قیمت و اعتبار طرح دوم فعال برگشت.\n- **پنل ادمین ← تنظیمات ← تنظیمات صفحه اصلی:** کارت اطلاع‌رسانی «اسلاید اول: کارت برند پیش‌فرض» (ثابت و غیرقابل حذف) با پیش‌نمایش مینیاتوری؛ راهنمای سایز به‌روز شد؛ شماره‌گذاری بنرها از #۲.\n- **رفع باگ:** خطای ۵۰۰ صفحهٔ اصلی (Prisma `P2021`) پس از بازیابی دیتابیس — جدول `HomepageBanner` در اسنپ‌شات tracked نبود؛ با `prisma db push` + تازه‌سازی اسنپ‌شات حل شد.\n\n### راستی‌آزمایی\n- E2E کامل (`scripts/test-agent-filters-banners.sh`) سبز: آپلود/لیست/فعال‌سازی/حذف بنر، سرو عمومی، محافظ path-traversal.\n- مرورگر headless: چرخش اسلاید، کلیک نشانگر، رندر بخش جدید پنل ادمین.\n\n**دو نقطهٔ بازگشت امن جدید:** تگ `v0.2.1` (کامیت `09593e7`) + اسنپ‌شات دیتابیس به‌روز در همین کامیت.",
  "draft": false,
  "prerelease": false
}
EOF

curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
  -d @/tmp/release-body.json "https://api.github.com/repos/$REPO/releases" -o /tmp/release-res.json -w "HTTP %{http_code}\n"
python3 -c "
import json
d = json.load(open('/tmp/release-res.json'))
print('tag:', d.get('tag_name'), '| url:', d.get('html_url') or d.get('message'))
"
