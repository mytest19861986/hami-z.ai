#!/usr/bin/env python3
"""تحلیل پیکسلی سه عکس مرجع طراحی — استخراج پالت رنگ غالب و تأیید VLM"""
from PIL import Image
from collections import Counter
import os

files = [
    "/home/z/my-project/upload/c0fbaa1b-c1bf-4d8c-a1ca-e1dacf7c5bcd.png",
    "/home/z/my-project/upload/b045b9e0-a530-4df0-addd-752eecbc8329.png",
    "/home/z/my-project/upload/61958bb2-472e-4c3d-a316-fb48e41aebd5.png",
]

def rgb2hex(c):
    return "#{:02X}{:02X}{:02X}".format(*c[:3])

def quantize(c, step=16):
    return tuple((v // step) * step for v in c[:3])

for f in files:
    im = Image.open(f).convert("RGB")
    w, h = im.size
    small = im.resize((min(w, 400), min(h, 800)))
    px = list(small.getdata())
    # کوانتیزه برای خوشه‌بندی رنگ
    counts = Counter(quantize(p) for p in px)
    top = counts.most_common(12)
    total = len(px)
    print(f"\n=== {os.path.basename(f)} ({w}x{h}) ===")
    for c, n in top:
        pct = 100 * n / total
        if pct < 0.5:
            continue
        print(f"  {rgb2hex(c)}  {pct:5.1f}%")
    # رنگ‌های اشباع (غیر خاکستری/سفید) برای پیدا کردن رنگ‌های برند
    sat = Counter()
    for p in px:
        r, g, b = p
        mx, mn = max(p), min(p)
        if mx - mn > 40 and mx > 60:  # اشباع قابل توجه
            sat[quantize(p, 24)] += 1
    print("  -- رنگ‌های اشباع غالب --")
    for c, n in sat.most_common(8):
        if 100 * n / total < 0.3:
            break
        print(f"  {rgb2hex(c)}  {100*n/total:5.1f}%")
