#!/usr/bin/env python3
"""یکپارچه‌سازی لوگوی اصلی کاربر (upload/logo.png) به‌عنوان هویت برند حامی‌کارت:
   ۱) public/brand/logo.png — نشان مربع شفاف برای BrandMark
   ۲) آیکون‌های PWA روی کاشی سفید (استاندارد/ماسک‌پذیر/اپل/فاوآیکون)
   ۳) نسخهٔ تحویلی در download/
"""
import os
from PIL import Image, ImageDraw, ImageOps

SRC = "/home/z/my-project/upload/logo.png"
PUB = "/home/z/my-project/public"
DL = "/home/z/my-project/download"
os.makedirs(f"{PUB}/brand", exist_ok=True)

IVORY = (246, 241, 231, 255)

# ── ۱) برش محتوا و مربع‌سازی با شفافیت ──
logo = Image.open(SRC).convert("RGBA")
bbox = logo.getbbox()
content = logo.crop(bbox)

def square_pad(img, size):
    """محتوا را در مربع شفاف با حاشیهٔ متقارن قرار می‌دهد."""
    w, h = img.size
    side = max(w, h)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return sq.resize((size, size), Image.LANCZOS)

# نشان اصلی برند — ۱۰۲۴ (شفاف)
mark = square_pad(content, 1024)
mark.save(f"{PUB}/brand/logo.png", optimize=True)
# نسخهٔ تحویلی
mark.save(f"{DL}/hamicard-logo-mark.png", optimize=True)
print("OK brand/logo.png + download/hamicard-logo-mark.png (1024, transparent)")

# ── ۲) آیکون روی کاشی سفید ──
def rounded_mask(size, radius_ratio=0.225):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size, size], radius=int(size * radius_ratio), fill=255)
    return m

def make_icon(size, logo_ratio=0.8, rounded=True, bg=(255, 255, 255, 255)):
    icon = Image.new("RGBA", (size, size), bg)
    lw = int(size * logo_ratio)
    lg = mark.resize((lw, lw), Image.LANCZOS)
    icon.paste(lg, ((size - lw) // 2, (size - lw) // 2), lg)
    if rounded:
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(icon, (0, 0), rounded_mask(size))
        return out
    return icon

# استاندارد (گوشه‌گرد)
make_icon(192).save(f"{PUB}/icons/icon-192.png", optimize=True)
make_icon(512).save(f"{PUB}/icons/icon-512.png", optimize=True)
# ماسک‌پذیر (تمام‌صفحه + ناحیهٔ امن ~۶۶٪)
make_icon(192, logo_ratio=0.66, rounded=False).save(f"{PUB}/icons/icon-maskable-192.png", optimize=True)
make_icon(512, logo_ratio=0.66, rounded=False).save(f"{PUB}/icons/icon-maskable-512.png", optimize=True)
# آیکون لمسی iOS (تمام‌صفحه سفید؛ خود iOS گوشه می‌سازد)
make_icon(180, logo_ratio=0.78, rounded=False).save(f"{PUB}/icons/apple-touch-icon.png", optimize=True)
# فاوآیکون
make_icon(64, logo_ratio=0.86).save(f"{PUB}/icons/favicon-64.png", optimize=True)
print("OK icons (192/512/maskable/apple/favicon) — white tile + logo")

# ── ۳) راستی‌آزمایی ──
for f in ["brand/logo.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"]:
    im = Image.open(f"{PUB}/{f}")
    print(f"  {f}: {im.size} {im.mode}")
