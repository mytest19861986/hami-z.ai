# حامی‌کارت — فایل‌های تحویلی (Evidence & Artifacts)

## آرشیو مخزن (برای پوش دستی به GitHub)
- `hamicard-repo.bundle` — باندل کامل گیت (تمام تاریخچهٔ کامیت‌ها). برای انتقال:
  ```bash
  git clone hamicard-repo.bundle hami && cd hami
  git remote set-url origin https://github.com/mytest19861986/hami-z.ai.git
  git push -u origin main
  ```
- `hamicard-full-archive.zip` — سورس کامل پروژه (بدون node_modules و .next)

## Evidence تست PWA (RUN-HAMICARD-001 / TASK-GLM-003)
- `pwa-install-banner-android.png` — نوار شناور نصب در شبیه‌سازی Pixel 7 (Android 13 / Chrome 116) با دکمهٔ «نصب اپلیکیشن حامی‌کارت»
- `pwa-install-banner-ios.png` — نوار شناور در شبیه‌سازی iPhone 14 (iOS 16 / Safari) با راهنمای Share و «Add to Home Screen»
- `pwa-offline-shell.png` — پوستهٔ آفلاین («اتصال اینترنت برقرار نیست») سرو‌شده توسط Service Worker با سرور کاملاً خاموش


## لوگوی اصلی برند (آپلودی کارفرما — یکپارچه‌شده در کل سامانه)
- `hamicard-logo-main.png` — لوگوی کامل: نشان + نام «حامی‌کارت»
- `hamicard-logo-mark.png` — نشان مربع شفاف ۱۰۲۴px
- `brand-logo-home.png` / `brand-logo-login.png` / `brand-logo-admin-panel.png` — نمونهٔ درج لوگو در هدر، ورود و پنل تیره
- آیکون‌های PWA (manifest/فاوآیکون/Apple Touch) همگی از لوگوی اصلی بازتولید شدند.

## بومی‌سازی مازندران/ساری
- `doctors-sari-directory.png` — دایرکتوری پزشکان (همه در ساری)
- `doctors-sari-filtered.png` — فیلتر استان مازندران
- `home-sari-footer.png` — فوتر با نشانی و تلفن ساری

## سامانهٔ کد رفرال و پورسانت (REF-SYS)
- `e2e-login-referral.png` — فیلد «کد معرف» در ورود/ثبت‌نام با پر شدن خودکار از لینک `?ref=`
- `e2e-profile-referral.png` — کارت «کد رفرال شما» + دکمه‌های کپی کد/لینک دعوت + وضعیت اطلاعات بانکی
- `e2e-user-wallet.png` — صفحهٔ «کیف پول و پورسانت» کاربر (مانده‌ها، درخواست تسویه، ریز پورسانت‌ها)
- `e2e-buy-nationalcode-gate.png` — گیت الزام کد ملی (۱۰ رقم) در صفحهٔ خرید
- `e2e-admin-settings.png` — تنظیم «درصد پورسانت معرفی کاربر» در داشبورد ادمین
- `e2e-admin-commissions.png` — نشانگر «اطلاعات بانکی کامل / بدون کارت-شبا» در پورسانت‌های ادمین
- `scripts/referral-system-e2e.mjs` (در سورس) — ۴۰/۴۰ سنجهٔ سبز: اعتبارسنجی‌ها، رفرال، پورسانت ۱۷٪ سراسری کاربر، ۲۲٪ اختصاصی طرح همکار، گیت بانکی، تسویه

قوانین اعتبارسنجی (مصوب کارفرما): موبایل ۱۱ رقم با صفر / ۱۰ رقم بدون صفر · کد ملی ۱۰ رقم · کارت بانکی ۱۶ رقم · شبا ۲۴ رقم — همه بدون رقم کنترل.

## فرم ورود کارت و شبا در داشبوردها (BANK-INFO)
- `agent-bank-info.png` — صفحهٔ جدید «اطلاعات بانکی» در پنل همکار فروش (/agent/bank) با فرم کارت ۱۶ رقمی (گروه‌بندی چهارتایی)، شبا ۲۴ رقمی (پیشوند IR خودکار) و نام صاحب حساب
- `agent-settlements-complete.png` — صفحهٔ تسویهٔ همکار: نمایش ماسک‌شدهٔ کارت/شبا + «ویرایش اطلاعات بانکی»؛ در حالت ناقص فرم درون‌خطی جایگزین لینک می‌شود
- `user-wallet-bank.png` — کیف پول کاربر: فرم درون‌خطی هنگام نقص اطلاعات + بنر سبز «اطلاعات بانکی ثبت شده» پس از ذخیره
- کامپوننت مشترک: `src/components/shared/bank-info-form.tsx` — اعتبارسنجی زنده (پیام تعداد رقم)، ذخیره از طریق `PUT /api/v1/user/profile`

## Evidence تست‌های دوره‌های قبل
- `ui-*.png` — رابط کاربری نهایی (خانه، ورود، طرح‌ها، داشبوردها، دایرکتوری پزشکان)
- `e2e-*.png` — سناریوهای E2E (پزشک، نماینده، کاربر، مدیر، عمومی)
