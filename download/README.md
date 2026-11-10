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

## Evidence تست‌های دوره‌های قبل
- `ui-*.png` — رابط کاربری نهایی (خانه، ورود، طرح‌ها، داشبوردها، دایرکتوری پزشکان)
- `e2e-*.png` — سناریوهای E2E (پزشک، نماینده، کاربر، مدیر، عمومی)
