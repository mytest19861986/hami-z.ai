#!/usr/bin/env bash
# ============================================================================
# deploy-ubuntu.sh — نصب خودکار «حامی‌کارت» روی سرور اوبونتو (۴CPU/۸GB)
# ============================================================================
# روش استفاده (روی سرور، با کاربر دارای sudo):
#   1) زیپ بکاپ را روی سرور کپی کنید (مثلاً /tmp/hami.zip)
#   2) bash deploy-ubuntu.sh /tmp/hami.zip
#
# این اسکریپت:
#   • Node.js 22 و Bun و ابزارهای پایه را نصب می‌کند
#   • پروژه را در ~/hami-card باز می‌کند
#   • دیتابیس و تنظیمات را آماده می‌کند (.env با مسیر سرور)
#   • بیلد production می‌گیرد و سرویس systemd می‌سازد (اجرای خودکار + ری‌استارت)
#   • فایروال را برای پورت ۳۰۰۰ باز می‌کند
#   • در پایان health-check می‌گیرد
#
# نکته: اگر دامنه/SSL ندارید، سایت روی http://IP-سرور:3000 در دسترس است.
# برای دامنه + HTTPS، بخش «Caddy (اختیاری)» در راهنما را ببینید.
# ============================================================================
set -euo pipefail

ZIP_PATH="${1:?استفاده: bash deploy-ubuntu.sh /مسیر/به/hami-card-backup-*.zip}"
APP_DIR="$HOME/hami-card"
PORT=3000

say() { echo -e "\n==> $*" >&2; }

[[ -f "$ZIP_PATH" ]] || { echo "✗ فایل زیپ پیدا نشد: $ZIP_PATH" >&2; exit 1; }

say "۱/۷ بررسی پیش‌نیازها"
if ! command -v unzip >/dev/null; then sudo apt-get update -qq && sudo apt-get install -y -qq unzip curl ca-certificates; fi

say "۲/۷ نصب Node.js 22 و Bun (اگر نباشند)"
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs
fi
if ! command -v bun >/dev/null; then curl -fsSL https://bun.sh/install | bash >/dev/null; fi
export PATH="$HOME/.bun/bin:$PATH"
echo "    Node: $(node -v) | Bun: $(bun --version)"

say "۳/۷ باز کردن پروژه از زیپ"
if [[ -d "$APP_DIR" ]]; then
  echo "⚠ پوشهٔ $APP_DIR موجود است — داخلش بکاپ می‌گیرم و ادامه می‌دهم."
  mv "$APP_DIR" "$APP_DIR-backup-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$APP_DIR"
unzip -q "$ZIP_PATH" -d "$APP_DIR"
cd "$APP_DIR"

say "۴/۷ آماده‌سازی دیتابیس و تنظیمات"
# مسیر مطلق سرور در DATABASE_URL — پیشوند file: و مسیر کامل
cat > .env <<EOF
DATABASE_URL=file:$APP_DIR/db/custom.db
SHOW_DEV_OTP=true
EOF
echo "    .env ساخته شد: $(grep DATABASE_URL .env)"

say "۵/۷ نصب وابستگی‌ها و تولید کلاینت Prisma"
bun install --frozen-lockfile 2>/dev/null || bun install
bunx prisma generate

say "۶/۷ بیلد production (چند دقیقه طول می‌کشد)"
bun run build

say "۷/۷ ساخت سرویس systemd (اجرای خودکار بعد از ریبوت)"
sudo tee /etc/systemd/system/hami-card.service >/dev/null <<EOF
[Unit]
Description=Hami Card (Next.js standalone)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$HOME/.bun/bin/bun $APP_DIR/.next/standalone/server.js
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOSTNAME=0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now hami-card

# فایروال: پورت ۳۰۰۰ باز (اگر ufw فعال باشد)
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow $PORT/tcp || true
  echo "    پورت $PORT در ufw باز شد."
fi

say "صبر برای بالا آمدن سرور…"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://localhost:$PORT/"; then break; fi
  sleep 2
done

if curl -sf -o /dev/null "http://localhost:$PORT/"; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo ""
  echo "✅ نصب کامل شد!"
  echo "   سایت:        http://$IP:$PORT  (یا http://localhost:$PORT)"
  echo "   ادمین:       ۰۹۱۲۰۰۰۰۰۰۰ — نمایندهٔ نمونه: ۰۹۱۲۰۰۰۰۰۰۲ (کد تأیید روی صفحه نمایش داده می‌شود چون پیامک متصل نیست)"
  echo "   وضعیت سرویس: systemctl status hami-card"
  echo "   لاگ زنده:    journalctl -u hami-card -f"
  echo "   کد OTP همیشه در لاگ سرویس چاپ می‌شود: journalctl -u hami-card | grep OTP"
else
  echo "✗ سرور بالا نیامد — لاگ را ببینید:" >&2
  echo "  sudo journalctl -u hami-card -n 50 --no-pager" >&2
  exit 1
fi
