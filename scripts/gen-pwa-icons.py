#!/usr/bin/env python3
"""تولید آیکون‌های PWA حامی‌کارت از نشان شمسهٔ برند (لاجورد و زعفران)."""
import os
import cairosvg

OUT = "/home/z/my-project/public/icons"
os.makedirs(OUT, exist_ok=True)

# رنگ‌های هویت
LAJVARD = "#2a4494"
LAJVARD_DEEP = "#1f336e"
ZAFARAN = "#d9942b"
IVORY = "#f6f1e7"

# ── قالب محتوا: دو مربع چرخیده (شمسهٔ هشت‌پر) + خط نبض + نقطهٔ مرکزی ──
def content(cx, cy, s, stroke_w, pulse_w, dot_r, stroke=IVORY, pulse=ZAFARAN):
    """s = نصف ضلع مربع شمسه"""
    half = s
    x = cx - half
    y = cy - half
    size = s * 2
    return f'''
  <g stroke="{stroke}" stroke-opacity="0.78" stroke-width="{stroke_w}" fill="none">
    <rect x="{x}" y="{y}" width="{size}" height="{size}"/>
    <rect x="{x}" y="{y}" width="{size}" height="{size}" transform="rotate(45 {cx} {cy})"/>
  </g>
  <path d="M{cx - s * 1.19:.0f} {cy} h{s * 0.64:.0f} l{s * 0.27:.0f} {-s * 0.62:.0f} {s * 0.46:.0f} {s * 1.25:.0f} {s * 0.31:.0f} {-s * 0.62:.0f} H{cx + s * 1.19:.0f}"
        stroke="{pulse}" stroke-width="{pulse_w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="{cx}" cy="{cy}" r="{dot_r}" fill="{pulse}"/>'''


def icon_svg(size, rounded=True, content_scale=1.0):
    """آیکون با پس‌زمینهٔ لاجوردی؛ content_scale برای ناحیهٔ امن ماسک‌پذیر."""
    pad = 0 if not rounded else size * 0.25  # rx پس‌زمینه
    c = size / 2
    s = size * 0.177 * content_scale      # نصف ضلع مربع شمسه
    stroke_w = size * 0.042
    pulse_w = size * 0.058
    dot_r = size * 0.044
    rx = size * 0.238 if rounded else 0
    grad = f'''
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="{LAJVARD}"/>
      <stop offset="100%" stop-color="{LAJVARD_DEEP}"/>
    </radialGradient>
  </defs>'''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  {grad}
  <rect width="{size}" height="{size}" rx="{rx}" fill="url(#bg)"/>{content(c, c, s, stroke_w, pulse_w, dot_r)}
</svg>'''


def write(svg, name):
    path = os.path.join(OUT, name)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=path)
    print(f"OK {name}")


# آیکون‌های استاندارد
write(icon_svg(192), "icon-192.png")
write(icon_svg(512), "icon-512.png")
# ماسک‌پذیر: تمام‌صفحه + محتوا در ناحیهٔ امن (مقیاس ۰٫۷۸)
write(icon_svg(192, rounded=False, content_scale=0.78), "icon-maskable-192.png")
write(icon_svg(512, rounded=False, content_scale=0.78), "icon-maskable-512.png")
# آیکون لمسی iOS: مربع تمام‌صفحه (خود iOS گوشه می‌سازد)
write(icon_svg(180, rounded=False, content_scale=0.82), "apple-touch-icon.png")
# favicon کوچک
write(icon_svg(64), "favicon-64.png")
print("همهٔ آیکون‌ها تولید شد.")
