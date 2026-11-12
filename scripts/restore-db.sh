#!/bin/bash
# ============================================================================
# restore-db.sh — بازیابی/به‌روزرسانی دیتابیس پس از بازنشانی سندباکس
# ============================================================================
# مشکل: سندباکس هنگام بازیابی، db/custom.db (untracked) را حذف و یک دیتابیس
# خالی فقط-شِما می‌سازد → خطای 500 در ورود (Prisma P2025) و پیام
# «خطا در ارتباط با سرور» در مرورگر.
#
# راه‌حل: اسنپ‌شات سالم در db/snapshots/custom-snapshot.db به‌صورت tracked
# در گیت نگهداری می‌شود و این اسکریپت آن را بازیابی می‌کند.
#
# استفاده:
#   bash scripts/restore-db.sh                    # بازیابی از اسنپ‌شات
#   bash scripts/restore-db.sh --no-serve         # فقط دیتابیس (بدون بالا آوردن سرور)
#   bash scripts/restore-db.sh --update-snapshot  # تازه‌سازی اسنپ‌شات از دیتابیس فعلی
#   bash scripts/restore-db.sh --check            # فقط بررسی سلامت دیتابیس فعلی
# ============================================================================
set -euo pipefail

NO_SERVE=0
for arg in "$@"; do
  [ "$arg" = "--no-serve" ] && NO_SERVE=1
done

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$PROJECT_DIR/db/custom.db"
SNAPSHOT_DIR="$PROJECT_DIR/db/snapshots"
SNAPSHOT_PATH="$SNAPSHOT_DIR/custom-snapshot.db"
INVARIANTS="$PROJECT_DIR/prisma/invariants.sql"
ADMIN_MOBILE="09120000000"

# اجرای پرس‌وجوی SQLite با پایتون (sqlite3 CLI ممکن است نصب نباشد)
sql() { python3 -c "
import sqlite3, sys
db = sqlite3.connect('$DB_PATH')
try:
    for row in db.execute(sys.argv[1]):
        print(*row, sep='|')
except Exception as e:
    print('SQLERR', e, file=sys.stderr); sys.exit(1)
" "$1"; }

db_users()        { sql "SELECT COUNT(*) FROM User" 2>/dev/null || echo 0; }
db_admin_ok()     { [ "$(sql "SELECT COUNT(*) FROM User WHERE mobile='$ADMIN_MOBILE' AND status='ACTIVE'" 2>/dev/null || echo 0)" = "1" ]; }

ensure_dev_server() {
  [ "$NO_SERVE" = "1" ] && return 0
  if curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
    echo "✅ سرور dev از قبل روشن است"
    return 0
  fi
  echo "🚀 روشن کردن سرور dev..."
  (cd "$PROJECT_DIR" && nohup bash -c 'npm run dev' >/dev/null 2>&1 &)
  for i in $(seq 1 30); do
    sleep 2
    if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then
      echo "✅ سرور dev بالا آمد"
      return 0
    fi
  done
  echo "⚠️  سرور dev در ۶۰ ثانیه بالا نیامد؛ دستی اجرا کنید: npm run dev"
  return 1
}

# ---------------------------------------------------------------------------
# حالت‌ها
# ---------------------------------------------------------------------------
case "${1:-}" in
  --check)
    echo "── بررسی سلامت دیتابیس فعلی ──"
    [ -f "$DB_PATH" ] || { echo "❌ db/custom.db وجود ندارد"; exit 1; }
    echo "کاربران: $(db_users) | ادمین: $(db_admin_ok && echo سالم || echo ناموجود!) | تریگرها: $(sql "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'" 2>/dev/null || echo '?')"
    ;;

  --update-snapshot)
    echo "── تازه‌سازی اسنپ‌شات از دیتابیس فعلی ──"
    [ -f "$DB_PATH" ] || { echo "❌ db/custom.db وجود ندارد"; exit 1; }
    if [ "$(db_users)" = "0" ]; then
      echo "❌ دیتابیس فعلی خالی است؛ اسنپ‌شات با دیتای خالی بازنویسی نشد. اول restore کنید."
      exit 1
    fi
    mkdir -p "$SNAPSHOT_DIR"
    # VACUUM INTO: کپی فشرده و سالم (بدون قفل‌گذاری روی فایل اصلی)
    python3 -c "
import sqlite3
db = sqlite3.connect('$DB_PATH')
db.execute(\"VACUUM INTO '$SNAPSHOT_PATH'\")
db.close()
print('اسنپ‌شات ساخته شد')
"
    chmod 644 "$SNAPSHOT_PATH"
    echo "✅ اسنپ‌شات تازه شد: $SNAPSHOT_PATH ($(du -h "$SNAPSHOT_PATH" | cut -f1))"
    echo "   برای ماندگاری، کامیت کنید: git add db/snapshots && git commit -m 'chore: refresh db snapshot'"
    ;;

  ""|--restore|--no-serve)
    echo "── بازیابی دیتابیس از اسنپ‌شات ──"
    if [ ! -f "$SNAPSHOT_PATH" ]; then
      echo "❌ اسنپ‌شات یافت نشد: $SNAPSHOT_PATH"
      echo "   جستجو در تاریخچه گیت..."
      LATEST=$(git -C "$PROJECT_DIR" log --format=%H --all -- db/custom.db | head -1)
      [ -n "$LATEST" ] || { echo "❌ در تاریخچه گیت هم نیست"; exit 1; }
      mkdir -p "$SNAPSHOT_DIR"
      git -C "$PROJECT_DIR" cat-file blob "$(git -C "$PROJECT_DIR" rev-parse "$LATEST:db/custom.db")" > "$SNAPSHOT_PATH"
      echo "   از کامیت $LATEST استخراج شد"
    fi
    # اگر دیتابیس فعلی سالم است، کاری نکن
    if [ -f "$DB_PATH" ] && db_admin_ok && [ "$(db_users)" -gt 0 ]; then
      echo "✅ دیتابیس فعلی سالم است ($(db_users) کاربر)؛ نیازی به بازیابی نیست."
      ensure_dev_server
      exit 0
    fi
    mkdir -p "$PROJECT_DIR/db"
    [ -f "$DB_PATH" ] && cp "$DB_PATH" "$DB_PATH.pre-restore.bak"
    cp "$SNAPSHOT_PATH" "$DB_PATH"
    chmod 644 "$DB_PATH"
    # اینوارینت‌های امنیتی (ایندکس یکتای تسویه + تریگرهای Append-Only کیف پول)
    if [ -f "$INVARIANTS" ]; then
      (cd "$PROJECT_DIR" && bunx prisma db execute --file "$INVARIANTS" --schema prisma/schema.prisma >/dev/null 2>&1) \
        && echo "✅ اینوارینت‌های امنیتی اعمال شد" || echo "⚠️  اعمال اینوارینت‌ها ناموفق بود (ادامه می‌دهیم)"
    fi
    echo "کاربران: $(db_users) | ادمین: $(db_admin_ok && echo سالم || echo ناموجود!)"
    db_admin_ok || { echo "❌ ادمین در اسنپ‌شات نیست!"; exit 1; }
    echo "✅ دیتابیس بازیابی شد."
    ensure_dev_server
    ;;
  *)
    echo "استفاده: $0 [--restore | --no-serve | --update-snapshot | --check]"
    exit 1
    ;;
esac
