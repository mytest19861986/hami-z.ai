#!/usr/bin/env python3
# مهاجرت داده به سیاست تک‌نقشی (SINGLE-ROLE):
# هر کاربر فقط پرارزش‌ترین نقشش را نگه می‌دارد (اولویت مدیریت > عملیاتی > پایه).
# پیش از اجرا بکاپ از UserRole می‌گیرد و گزارش کاملی چاپ می‌کند.
import sqlite3, shutil, sys, time

DB = "/home/z/my-project/db/custom.db"

# اولویت نقش — عدد بالاتر = نگه‌داشته می‌شود
PRIORITY = {"SUPER_ADMIN": 70, "ADMIN": 60, "SUPPORT": 50, "DOCTOR": 40, "AGENT": 35, "REFERRER": 30, "USER": 10}

shutil.copy(DB, f"{DB}.pre-single-role-{int(time.time())}.bak")

db = sqlite3.connect(DB)
db.execute("BEGIN")

rows = db.execute("""
  SELECT ur.userId, u.mobile, GROUP_CONCAT(r.name) as roles
  FROM UserRole ur
  JOIN Role r ON r.id = ur.roleId
  JOIN User u ON u.id = ur.userId
  GROUP BY ur.userId
  HAVING COUNT(*) > 1
""").fetchall()

print(f"کاربران چندنقش: {len(rows)}")
changed = []
for user_id, mobile, roles_str in rows:
    roles = roles_str.split(",")
    # نقش نگه‌داشته‌شده = بیشترین اولویت
    keep = max(roles, key=lambda r: PRIORITY.get(r, 0))
    drop = [r for r in roles if r != keep]
    db.execute("""
      DELETE FROM UserRole
      WHERE userId = ? AND roleId NOT IN (SELECT id FROM Role WHERE name = ?)
    """, (user_id, keep))
    changed.append((mobile, roles_str, keep, ",".join(drop)))
    print(f"  {mobile}: {roles_str} → {keep} (حذف: {','.join(drop)})")

db.commit()

# راستی‌آزمایی: هیچ کاربر چندنقشی نمانده باشد
remain = db.execute("""
  SELECT u.mobile, COUNT(*) n FROM UserRole ur JOIN User u ON u.id = ur.userId
  GROUP BY ur.userId HAVING n > 1
""").fetchall()
assert not remain, f"هنوز چندنقش مانده: {remain}"

# راستی‌آزمایی: هیچ کاربری بدون نقش نمانده باشد
no_role = db.execute("""
  SELECT COUNT(*) FROM User u WHERE NOT EXISTS (SELECT 1 FROM UserRole ur WHERE ur.userId = u.id)
""").fetchone()[0]
assert no_role == 0, f"{no_role} کاربر بدون نقش!"

total = db.execute("SELECT COUNT(*) FROM UserRole").fetchone()[0]
users = db.execute("SELECT COUNT(*) FROM User").fetchone()[0]
print(f"\n✅ تک‌نقشی اعمال شد: {users} کاربر، {total} رکورد نقش (باید برابر باشد)")
assert total == users, "تعداد رکورد نقش با تعداد کاربر برابر نیست!"
db.close()
