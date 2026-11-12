# راهنمای دیتابیس حامی‌کارت (پشتیبان‌گیری، بازیابی و مهاجرت)

> **اصل طلایی:** صرفِ بازگرداندن Commit به معنی بازگرداندن داده‌های دیتابیس نیست.
> کد و داده دو چیز مستقل‌اند؛ این سند مستقل از روال Git، فقط به داده‌ها می‌پردازد.

---

## ۱. معماری فعلی

| بخش | وضعیت |
|---|---|
| ORM | Prisma 6 (`prisma/schema.prisma`) |
| دیتابیس پیش‌فرض | SQLite (`db/custom.db` — `DATABASE_URL="file:./db/custom.db"`) |
| دیتابیس تولید (پیشنهادی) | PostgreSQL 16 |
| اینوارینت‌های سطح DB | `prisma/invariants.sql` (ایندکس یکتای جزئی + ۲ تریگر) |
| داده اولیه | `prisma/seed.ts` (نقش‌ها، مجوزها، طرح‌ها، مدیر ارشد، پزشکان نمونه) |

**مدل‌های اصلی:** `User`, `Profile`, `Role`, `Permission`, `UserRole`, `Doctor`, `DiscountPlan`, `Purchase`, `Membership`, `Visit`, `Wallet`, `WalletTransaction`, `SettlementRequest`, `ReferralCode`, `SystemSetting`, `AuditLog` و …

## ۲. اینوارینت‌های سطح دیتابیس (الزامی)

`prisma/invariants.sql` باید **پس از هر `prisma db push`** مجدداً اجرا شود:

```bash
bunx prisma db execute --file prisma/invariants.sql --schema prisma/schema.prisma
```

- **SETTLE-005:** ایندکس یکتای جزئی `idx_settlement_one_open_per_user` — حداکثر یک درخواست تسویه باز (`PENDING`/`APPROVED`) به‌ازای هر کاربر.
- **WALLET-006:** تریگرهای `trg_wallet_ledger_no_update` و `trg_wallet_ledger_no_delete` — دفترکل کیف پول Append-Only است؛ هیچ ردیفی پس از ثبت قابل ویرایش یا حذف نیست.

راستی‌آزمایی: `node scripts/verify-db-invariants.mjs`

> ⚠️ این تریگرها مخصوص SQLite هستند. برای PostgreSQL باید معادل `CREATE FUNCTION ... RAISE EXCEPTION` نوشته شود (بخش ۶).

## ۳. پشتیبان‌گیری

### SQLite (محیط فعلی)

```bash
# روش امن با ابزار رسمی (دیتابیس قفل‌نشده):
sqlite3 db/custom.db ".backup 'db/backup-$(date +%F-%H%M).db'"

# یا کپی ساده پس از توقف سرور:
cp db/custom.db "db/backup-$(date +%F-%H%M).db"

# خروجی SQL کامل (منطقی):
sqlite3 db/custom.db .dump > "db/backup-$(date +%F).sql"
```

**زمان‌بندی پیشنهادی:** پشتیبان روزانه + نگهداری ۳۰ نسخه. نمونه کرون (هر روز ۳ بامداد):

```cron
0 3 * * * sqlite3 /path/to/hami-z.ai/db/custom.db ".backup '/path/backups/hami-$(date +\%F).db'"
```

### PostgreSQL (تولید)

```bash
# پشتیبان کامل فشرده:
pg_dump -U hamicard_app -Fc hamicard_dev > backup-$(date +%F).dump

# بازیابی:
pg_restore -U hamicard_app -d hamicard_dev --clean --if-exists backup-2026-11-12.dump
```

## ۴. بازیابی

```bash
# ۱. توقف سرور
#    (systemctl stop hamicard  یا  Ctrl+C روی npm run start)

# ۲. جایگزینی فایل دیتابیس (SQLite)
cp db/custom.db db/custom.db.broken        # نگه‌داشتن نسخه معیوب
cp db/backup-2026-11-12.db db/custom.db    # بازگرداندن پشتیبان

# ۳. اجرای مجدد سرور
npm run start
```

بازیابی از خروجی SQL:

```bash
sqlite3 db/custom.db < backup-2026-11-12.sql
```

## ۵. مهاجرت بین دو نسخه کد (Schema Drift)

سناریو: سرور روی `v0.1.0` کار می‌کند و می‌خواهید به نسخه جدیدتر بروید که شِما تغییر کرده.

```bash
# ۰. پشتیبان قبل از هر کاری (بخش ۳)
sqlite3 db/custom.db ".backup 'db/pre-migration.db'"

# ۱. دریافت نسخه جدید
git fetch --tags && git checkout v0.2.0

# ۲. اعمال شِمای جدید روی داده‌های موجود
bunx prisma db push

# ۳. اجرای مجدد اینوارینت‌ها (همیشه پس از db push)
bunx prisma db execute --file prisma/invariants.sql --schema prisma/schema.prisma

# ۴. بیلد و اجرا
npm run build && npm run start
```

**نکات مهم:**
- `prisma db push --accept-data-loss` (اسکریپت `npm run db:push`) می‌تواند ستون‌ها/جداول حذف‌شده را با داده‌ها پاک کند؛ روی دیتابیس عملیاتی فقط پس از پشتیبان اجرا کنید.
- بازگشت کد به نسخه قدیمی‌تر، رکوردهای ساخته‌شده توسط نسخه جدید را حذف نمی‌کند؛ اگر شِمای قدیمی آن ستون‌ها را نمی‌شناسد، تا بازگشت دوباره به نسخه جدید قابل مشاهده نخواهند بود (معمولاً بی‌خطر).
- seed (`bun run prisma/seed.ts`) idempotent است (upsert/findFirst) و اجرای مجدد آن روی داده واقعی، رکوردهای موجود را جایگزین نمی‌کند.

## ۶. مهاجرت SQLite → PostgreSQL 16

1. `DATABASE_URL` را به رشته PostgreSQL تغییر دهید.
2. `datasource.provider` در `prisma/schema.prisma` را از `sqlite` به `postgresql` تغییر دهید.
3. `bunx prisma db push` روی دیتابیس خالی جدید.
4. معادل PostgreSQL اینوارینت‌ها را اجرا کنید — تریگرهای SQLite مستقیماً قابل استفاده نیستند:

```sql
-- معادل WALLET-006 در PostgreSQL
CREATE OR REPLACE FUNCTION wallet_ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'WALLET_LEDGER_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_ledger_no_update
BEFORE UPDATE OR DELETE ON "WalletTransaction"
FOR EACH ROW EXECUTE FUNCTION wallet_ledger_append_only();
```

```sql
-- معادل SETTLE-005 در PostgreSQL
CREATE UNIQUE INDEX idx_settlement_one_open_per_user
  ON "SettlementRequest"("userId")
  WHERE status IN ('PENDING', 'APPROVED');
```

5. انتقال داده با ابزار ETL (مثلاً `pgloader` یا اسکریپت select/insert دوجانبه) و سپس `bun run prisma/seed.ts` برای داده‌های پایه.

## ۷. نکات امنیتی داده

- دیتابیس واقعی (`db/custom.db`) حاوی **PII واقعی** است (موبایل، هش رمز، کد ملی) و هرگز نباید کامیت یا منتشر شود؛ مسیر `/db/` در `.gitignore` است و باید بماند.
- `.env` حاوی رشته اتصال و کلیدهاست و نباید منتشر شود.
- برای انتقال بین سرورها فقط از کانال رمزنگاری‌شده (scp/rsync over SSH) استفاده کنید.
- نسخه‌های پشتیبان همان حساسیت دیتابیس اصلی را دارند؛ روی همان سرور امن و رمزگذاری‌شده نگه‌داری شوند.
