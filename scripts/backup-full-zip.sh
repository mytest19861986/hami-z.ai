#!/bin/bash
# بکاپ کامل پروژه حامی‌کارت — زیپ شامل کد + تاریخچهٔ کامل گیت + .env
# استثناها (قابل بازسازی): node_modules، .next، لاگ‌ها، فایل توکن گیت (امنیتی)
set -euo pipefail

cd /home/z/my-project
STAMP=$(date +%Y%m%d-%H%M)
ZIP_NAME="hami-card-backup-FULL-${STAMP}.zip"
TMP_DIR=$(mktemp -d)

echo "==> 1/4 ساخت زیپ (این ممکن است کمی طول بکشد)..."
zip -r -q "$TMP_DIR/$ZIP_NAME" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "*.log" \
  -x "dev.log" \
  -x "dev.out.log" \
  -x "server.log" \
  -x ".git/credentials-local" \
  -x "download/*" \
  -x "skills/*" \
  -x ".agent-browser/*" \
  -x "prompt" \
  -x "test"

echo "==> 2/4 کپی به کلود (/home/sync) ..."
cp "$TMP_DIR/$ZIP_NAME" /home/sync/"$ZIP_NAME"

echo "==> 3/4 کپی به download/ (برای دانلود شما) ..."
mkdir -p /home/z/my-project/download
cp "$TMP_DIR/$ZIP_NAME" /home/z/my-project/download/"$ZIP_NAME"

echo "==> 4/4 تأیید یکپارچگی ..."
unzip -t "/home/sync/$ZIP_NAME" > /tmp/unzip-test-cloud.txt 2>&1 && echo "کلود: unzip -t OK"
unzip -t "/home/z/my-project/download/$ZIP_NAME" > /tmp/unzip-test-local.txt 2>&1 && echo "محلی: unzip -t OK"

CLOUD_COUNT=$(unzip -l "/home/sync/$ZIP_NAME" | tail -1 | awk '{print $2}')
LOCAL_COUNT=$(unzip -l "/home/z/my-project/download/$ZIP_NAME" | tail -1 | awk '{print $2}')
CLOUD_SHA=$(sha256sum "/home/sync/$ZIP_NAME" | cut -d' ' -f1)
LOCAL_SHA=$(sha256sum "/home/z/my-project/download/$ZIP_NAME" | cut -d' ' -f1)

echo "فایل‌ها در زیپ: $CLOUD_COUNT"
echo "شباهت کلود/محلی: $([ "$CLOUD_SHA" = "$LOCAL_SHA" ] && echo 'یکسان ✅' || echo 'متفاوت ❌')"
echo "SHA256: $CLOUD_SHA"
echo "حجم: $(du -h "/home/sync/$ZIP_NAME" | cut -f1)"
echo "SIZE_BYTES=$(stat -c%s "/home/sync/$ZIP_NAME")"
echo "FILE_NAME=$ZIP_NAME"

rm -rf "$TMP_DIR"
