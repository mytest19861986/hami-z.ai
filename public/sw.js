/* حامی‌کارت — Service Worker
   کش استاتیک‌ها + پوستهٔ آفلاین (App Shell)
   راهبرد‌ها:
     • ناوبری: شبکه-اول ← کش ← صفحهٔ آفلاین
     • /_next/static: کش-اول (دارایی‌های hash شده تغییرناپذیرند)
     • سایر استاتیک‌های هم‌مبدأ: stale-while-revalidate
     • /api/*: فقط شبکه (بدون کش — داده‌های حساس مالی)
*/
// hk-v4: بازاعتبارسنجی کش پس از رفع باگ استان و داشبورد طرح‌ها (چانک‌های dev پایدارند)
const VERSION = "hk-v4";
const STATIC_CACHE = `hk-static-${VERSION}`;
const RUNTIME_CACHE = `hk-runtime-${VERSION}`;
const OFFLINE_URL = "/offline";
// میزبانی محلی (سرور توسعه) → چانک‌ها پایدار نیستند و باید بازاعتبارسنجی شوند
const IS_LOCALHOST = ["localhost", "127.0.0.1"].includes(self.location.hostname);

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/logo.svg",
  "/brand/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // افزودن تک‌تک با catch — خطای یکی کل نصب را نمی‌شکند
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("hk-") && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** آیا درخواست استاتیک هم‌مبدأ قابل کش است؟ */
function isCacheableStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /^\/icons\//.test(url.pathname) ||
    /\.(png|svg|jpg|jpeg|webp|ico|woff2?|ttf|css|js|json|webmanifest)$/i.test(url.pathname) ||
    url.pathname === "/logo.svg"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط GET هم‌مبدأ؛ API هرگز کش نمی‌شود
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // ۱) ناوبری: شبکه-اول با fallback آفلاین
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = (await caches.match(request)) || (await caches.match(OFFLINE_URL));
          return (
            cached ||
            new Response("<h1 dir=\"rtl\">اتصال اینترنت برقرار نیست</h1>", {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 503,
            })
          );
        }
      })()
    );
    return;
  }

  // ۲) استاتیک‌های hash شدهٔ Next: کش-اول در پروداکشن؛ در توسعه stale-while-revalidate
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const refresh = fetch(request)
          .then((fresh) => {
            if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
            return fresh;
          })
          .catch(() => cached);
        if (cached && IS_LOCALHOST) return cached; // محلی: از کش، بازاعتبارسنجی در پس‌زمینه
        if (cached) return cached;
        try {
          return await refresh;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // ۳) سایر استاتیک‌های هم‌مبدأ: stale-while-revalidate
  if (isCacheableStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const refresh = fetch(request)
          .then((fresh) => {
            if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
            return fresh;
          })
          .catch(() => cached);
        return cached || refresh;
      })()
    );
  }
});
