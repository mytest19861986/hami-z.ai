"use client"

import { useEffect } from "react"

/**
 * ثبت Service Worker حامی‌کارت (کش استاتیک + پوستهٔ آفلاین).
 * خطاها بی‌صدا نادیده گرفته می‌شوند تا تجربهٔ مرورگرهای بدون PWA خراب نشود.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* بدون SW هم برنامه کار می‌کند */
        })
    }
    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register, { once: true })
      return () => window.removeEventListener("load", register)
    }
  }, [])
  return null
}
