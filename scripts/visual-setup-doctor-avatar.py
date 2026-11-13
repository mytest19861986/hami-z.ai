#!/usr/bin/env python3
# ساخت عکس پروفایل واقعی‌نما برای پزشک تستی (برای بررسی بصری UI)
# یک JPEG معتبر 400x400 با الگوی ساده — بدون وابستگی (ساخت دستی JPEG نیست؛ از PIL استفاده می‌کنیم)
import sqlite3, hashlib, secrets, time, sys, base64, os

DB = "/home/z/my-project/db/custom.db"
MOBILE = "09121111101"

# ساخت JPEG با PIL (در سندباکس موجود است)
from PIL import Image, ImageDraw
img = Image.new("RGB", (400, 400), (212, 175, 55))  # پس‌زمینه طلایی برند
d = ImageDraw.Draw(img)
# سر و بدن ساده (آواتار پیش‌فرض)
d.ellipse([150, 80, 250, 180], fill=(255, 255, 255))
d.ellipse([100, 200, 300, 400], fill=(255, 255, 255))
img.save("/tmp/doctor-avatar.jpg", "JPEG", quality=88)

buf = open("/tmp/doctor-avatar.jpg", "rb").read()
b64 = base64.b64encode(buf).decode()
print(f"avatar image: {len(buf)} bytes")

# درج نشست + آپلود مستقیم فایل (بدون API — ساده‌تر برای setup)
name = f"avatar-visual-{int(time.time()*1000)}-{secrets.token_hex(4)}.jpg"
updir = "/home/z/my-project/db/uploads/doctor-avatars"
os.makedirs(updir, exist_ok=True)
open(os.path.join(updir, name), "wb").write(buf)

db = sqlite3.connect(DB)
uid = db.execute("SELECT id FROM User WHERE mobile=?", (MOBILE,)).fetchone()[0]
did = db.execute("SELECT id FROM Doctor WHERE userId=?", (uid,)).fetchone()[0]
avatar_url = f"/api/v1/public/avatars/{name}"
db.execute("UPDATE Doctor SET avatarUrl=? WHERE id=?", (avatar_url, did))
db.execute(
    "INSERT INTO Upload (id, ownerUserId, purpose, fileName, filePath, mimeType, sizeBytes, createdAt) VALUES (?,?,?,?,?,?,?,?)",
    (secrets.token_hex(12), uid, "DOCTOR_AVATAR", "visual-test.jpg", f"doctor-avatars/{name}", "image/jpeg", len(buf), int(time.time() * 1000)),
)
db.commit()
db.close()
print("avatarUrl:", avatar_url)
