# بررسی پیکسلی اسکرین‌شات‌ها: نباید خالی/سفید باشند و رنگ‌های برند باید حضور داشته باشند
from PIL import Image
import os

for name in ["agent-bank-info.png", "user-wallet-bank.png"]:
    path = f"/home/z/my-project/download/{name}"
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.resize((min(w, 400), min(h, 2000))).getdata()
    total = len(px)
    white = sum(1 for p in px if p[0] > 240 and p[1] > 240 and p[2] > 240)
    # لاجوردی #2a4494 (پرچم برند) — تلورانس
    azure = sum(1 for p in px if abs(p[0]-0x2a) < 45 and abs(p[1]-0x44) < 45 and abs(p[2]-0x94) < 50)
    # زعفرانی #d9942b
    saffron = sum(1 for p in px if abs(p[0]-0xd9) < 45 and abs(p[1]-0x94) < 45 and abs(p[2]-0x2b) < 50)
    dark_text = sum(1 for p in px if p[0] < 80 and p[1] < 80 and p[2] < 80)
    print(
        f"{name}: {w}x{h} | white={white/total:.1%} azure={azure/total:.2%} "
        f"saffron={saffron/total:.2%} dark(text)={dark_text/total:.2%} "
        f"size={os.path.getsize(path)//1024}KB"
    )
