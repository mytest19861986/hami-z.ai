# راهنمای استقرار (Deployment Guide)

این سند راهنمای کامل راه‌اندازی پروژه **حامی‌کارت** روی یک سرور جدید توسط عامل استقرار است.
هر نسخه قابل تحویل با یک **Tag** (مثلاً `v0.1.0`) مشخص می‌شود؛ با دریافت همان Tag، دقیقاً همان نسخه راه‌اندازی می‌شود.

---

## ۱. پیش‌نیازهای سرور

| مورد | نسخه حداقل | توضیح |
|---|---|---|
| Node.js | ۲۰ یا بالاتر (توصیه: ۲۲ LTS) | برای `npm` و ابزارهای ساخت |
| Bun | ۱.۱ یا بالاتر | اجرای اسکریپت seed و سرور production (اسکریپت `start`) |
| Git | هر نسخه جدید | دریافت نسخه موردنظر از GitHub |
| RAM | حداقل ۲ گیگابایت | بیلد Next.js |
| دیسک | حداقل ۲ گیگابایت آزاد | کد، node_modules و بیلد |

> نکته: فایل `bun.lock` در مخزن موجود است؛ اگر با `npm install` نصب می‌کنید، وابستگی‌ها از `package.json` حل می‌شوند. برای تکرارپذیری کامل، `bun install` توصیه می‌شود.

## ۲. دریافت نسخه مشخص

```bash
# کلون مخزن
git clone https://github.com/mytest19861986/hami-z.ai.git
cd hami-z.ai

# انتخاب نسخه دلخواه (مثال: نسخه پایه ۶۰٪)
git checkout v0.1.0
# یا آخرین شاخه پایدار:
# git checkout main
```

## ۳. متغیرهای محیطی (بدون راز واقعی)

فایل `.env.example` را کپی کنید و مقادیر را وارد کنید:

```bash
cp .env.example .env
```

| متغیر | ضروری | توضیح |
|---|---|---|
| `DATABASE_URL` | ✅ | رشته اتصال دیتابیس. SQLite پیش‌فرض توسعه: `file:./db/custom.db` — PostgreSQL 16 برای تولید توصیه می‌شود |
| `JWT_SECRET` / `SESSION_SECRET` | ✅ | کلیدهای امضا/رمزنگاری سشن — **حتماً در تولید مقدار تصادفی حداقل ۳۲ نویسه** |
| `OTP_EXPIRY_SECONDS` | ✅ | مدت اعتبار کد یک‌بارمصرف (پیش‌فرض ۱۲۰) |
| `OTP_DEV_MOCK` | ✅ | `true` = OTP بدون پیامک واقعی (فقط توسعه!) |
| `NEXT_PUBLIC_APP_URL` | ✅ | آدرس عمومی برنامه |
| `NEXT_PUBLIC_PWA_ENABLED` | ✅ | فعال‌بودن PWA |
| `REDIS_URL` | ⛔ اختیاری | اگر سرویس Redis دارید |

**روش امن تأمین رازها:**
- رازها را هرگز کامیت نکنید؛ `.env` در `.gitignore` است و باید بماند.
- برای تولید، رازها را از طریق مدیر رمز سرور (systemd `EnvironmentFile=`, Docker secrets, Vault و مانند آن) تزریق کنید.
- تولید کلید تصادفی: `openssl rand -base64 48`
- رمزهای پیش‌فرض seed (`Hami@Admin123`) را پیش از بهره‌برداری تغییر دهید (بخش ۷).

## ۴. نصب و ساخت

```bash
# ۱. نصب وابستگی‌ها
bun install          # یا npm install

# ۲. تولید کلاینت Prisma
bunx prisma generate

# ۳. اعمال شِما روی دیتابیس (بدون مهاجرت رسمی — پروژه از db push استفاده می‌کند)
bunx prisma db push

# ۴. اعمال اینوارینت‌های سطح دیتابیس (الزامی پس از هر db push)
bunx prisma db execute --file prisma/invariants.sql --schema prisma/schema.prisma

# ۵. بارگذاری داده اولیه (نقش‌ها، مجوزها، طرح‌ها، مدیر ارشد، پزشکان نمونه)
bun run prisma/seed.ts     # یا: bunx tsx prisma/seed.ts

# ۶. بیلد production
npm run build
```

> خروجی بیلد `output: "standalone"` است؛ اسکریپت `build` فایل‌های static و public را داخل `.next/standalone` کپی می‌کند.

## ۵. اجرا و تست سلامت

```bash
# اجرای سرور production (اسکریپت آماده پروژه)
npm run start
# این دستور معادل است با:
# NODE_ENV=production bun .next/standalone/server.js
```

تست سلامت:

```bash
# اندپوینت سلامت سرور
curl -s http://localhost:3000/api | head -1
# باید پاسخ JSON بدهد: {"message":"Hello, world!"}

# صفحه اصلی
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# باید 200 برگرداند
```

**ورود ادمین (پیش‌فرض seed):** موبایل `09120000000` / رمز `Hami@Admin123` + مرحله OTP.
در حالت `OTP_DEV_MOCK=true` کد OTP بدون پیامک در لاگ سرور/کنسول ظاهر می‌شود؛ در تولید این متغیر را `false` کنید و درگاه پیامک واقعی را متصل نمایید.

**تست‌های E2E پس از استقرار (اختیاری اما توصیه‌شده):**

```bash
node scripts/verify-db-invariants.mjs   # SETTLE-005 و WALLET-006
node scripts/surfaces-e2e.mjs           # سطوح کاربری
node scripts/financial-e2e.mjs          # دفترکل مالی
node scripts/settlement-e2e.mjs         # تسویه‌حساب
node scripts/concurrency-e2e.mjs        # همزمانی
```

## ۶. لاگ‌ها و بازگشت به نسخه قبلی

**لاگ‌ها:** اسکریپت‌های `dev` و `start` خروجی را در `dev.log` و `server.log` ذخیره می‌کنند:

```bash
tail -f server.log        # لاگ زنده سرور production
tail -f dev.log           # لاگ محیط توسعه
```

**بازگشت به نسخه قبلی (Rollback):**

```bash
# ۱. توقف سرور (Ctrl+C یا systemctl stop hamicard)

# ۲. بازگشت به تگ قبلی
git fetch --tags
git checkout v0.1.0        # نسخه‌ای که پایدار بود

# ۳. بازسازی از همان دیتابیس موجود
bun install
bunx prisma generate
bunx prisma db push
bunx prisma db execute --file prisma/invariants.sql --schema prisma/schema.prisma
npm run build
npm run start
```

> ⚠️ **مهم:** بازگرداندن Commit به معنی بازگرداندن داده‌های دیتابیس نیست. اگر شِما بین نسخه‌ها تغییر کرده باشد، `prisma db push` تغییرات را روی داده‌های موجود اعمال می‌کند و بازگشت کد، رکوردهای ایجادشده را حذف نمی‌کند. راهنمای پشتیبان/بازیابی دیتابیس در `docs/DATABASE.md` مستقل ارائه شده است.

## ۷. چک‌لیست امنیتی پیش از بهره‌برداری (الزامی)

1. **رمز ادمین seed را تغییر دهید** (`Hami@Admin123` فقط برای توسعه است). پس از اولین ورود از پنل ادمین، یا مستقیم در دیتابیس با bcrypt hash جدید.
2. **رمزهای داخل اسکریپت‌های تست را تغییر/حذف کنید**: `scripts/test-users-operations.sh` حاوی رمز ادمین تست است و نباید با همین مقادیر روی سرور عملیاتی اجرا شود.
3. `OTP_DEV_MOCK=false` کنید و درگاه پیامک واقعی را متصل کنید.
4. `JWT_SECRET` و `SESSION_SECRET` را با مقادیر تصادفی جدید جایگزین کنید.
5. اگر برنامه از iframe استفاده نمی‌کند، `frame-ancestors` را در `next.config.ts` محدودتر کنید.
6. HTTPS را فعال کنید (Caddy با TLS خودکار در پروژه موجود است: فایل `Caddyfile`).
7. پشتیبان‌گیری دوره‌ای دیتابیس را طبق `docs/DATABASE.md` فعال کنید.
