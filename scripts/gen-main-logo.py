#!/usr/bin/env python3
"""تولید لوگوی اصلی برند حامی‌کارت (نشان شمسه) در کیفیت بالا."""
import base64
import cairosvg
import os

LAJVARD = "#2a4494"
LAJVARD_DEEP = "#1f336e"
ZAFARAN = "#d9942b"
IVORY = "#f6f1e7"

# ── نشان شمسهٔ برند (مطابق BrandMark در src/components/shared/brand.tsx) ──
def content(cx, cy, s, stroke_w, pulse_w, dot_r):
    half = s
    x, y = cx - half, cy - half
    size = s * 2
    return f'''
  <g stroke="#f6f1e7" stroke-opacity="0.78" stroke-width="{stroke_w}" fill="none">
    <rect x="{x}" y="{y}" width="{size}" height="{size}"/>
    <rect x="{x}" y="{y}" width="{size}" height="{size}" transform="rotate(45 {cx} {cy})"/>
  </g>
  <path d="M{cx - s * 1.19:.0f} {cy} h{s * 0.64:.0f} l{s * 0.27:.0f} {-s * 0.62:.0f} {s * 0.46:.0f} {s * 1.25:.0f} {s * 0.31:.0f} {-s * 0.62:.0f} H{cx + s * 1.19:.0f}"
        stroke="{ZAFARAN}" stroke-width="{pulse_w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="{cx}" cy="{cy}" r="{dot_r}" fill="{ZAFARAN}"/>'''


def mark_svg(size):
    c = size / 2
    s = size * 0.177
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="{LAJVARD}"/>
      <stop offset="100%" stop-color="{LAJVARD_DEEP}"/>
    </radialGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{size * 0.238}" fill="url(#bg)"/>{content(c, c, s, size * 0.042, size * 0.058, size * 0.044)}
</svg>'''


OUT = "/home/z/my-project/download"
os.makedirs(OUT, exist_ok=True)

# ۱) PNG نشان تنها — ۱۰۲۴ پیکسل
cairosvg.svg2png(bytestring=mark_svg(1024).encode(), write_to=f"{OUT}/hamicard-logo-mark.png")
# ۲) SVG نشان (برداری، self-contained)
with open(f"{OUT}/hamicard-logo-mark.svg", "w") as f:
    f.write(mark_svg(512))

# ۳) صفحهٔ HTML برای رندر لوگوی کامل (نشان + نام) با فونت‌های واقعی اپ — رندر مرورگر
def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

estedad = b64("/home/z/my-project/src/app/fonts/Estedad-Bold.woff2")
vazir = b64("/home/z/my-project/src/app/fonts/Vazirmatn-Medium.woff2")

html = f'''<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  @font-face {{ font-family: "Estedad"; src: url(data:font/woff2;base64,{estedad}) format("woff2"); font-weight: 700; }}
  @font-face {{ font-family: "Vazirmatn"; src: url(data:font/woff2;base64,{vazir}) format("woff2"); font-weight: 500; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: #f6f1e7; width: 1600px; height: 900px; display: flex; align-items: center; justify-content: center; }}
  .logo {{ display: flex; align-items: center; gap: 40px; direction: rtl; }}
  .title {{ font-family: "Estedad", sans-serif; font-weight: 700; font-size: 128px; color: #1d2433; line-height: 1; }}
  .sub {{ font-family: "Vazirmatn", sans-serif; font-weight: 500; font-size: 40px; color: #5d6576; margin-top: 26px; }}
  .word {{ display: flex; flex-direction: column; }}
</style>
</head>
<body>
  <div class="logo">
    <svg width="360" height="360" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2a4494"/>
      <g stroke="#f6f1e7" stroke-opacity="0.78" stroke-width="2">
        <rect x="15.5" y="15.5" width="17" height="17"/>
        <rect x="15.5" y="15.5" width="17" height="17" transform="rotate(45 24 24)"/>
      </g>
      <path d="M12 24h6.2l2.6-6 4.4 12 3-6H36" stroke="#d9942b" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="24" cy="24" r="2" fill="#d9942b"/>
    </svg>
    <div class="word">
      <div class="title">حامی‌کارت</div>
      <div class="sub">تخفیف واقعی خدمات درمانی</div>
    </div>
  </div>
</body>
</html>'''

with open("/tmp/hamicard-logo.html", "w") as f:
    f.write(html)

print("OK: hamicard-logo-mark.png (1024px), hamicard-logo-mark.svg, /tmp/hamicard-logo.html آمادهٔ رندر")
