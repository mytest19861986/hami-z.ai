"use client"

// کلاینت API — همه درخواست‌ها مسیر نسبی و هم‌مبدأ
export interface ApiError {
  message: string
  status: number
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    // X-Requested-With نشانهٔ درخواست‌های خود اپ است (لایهٔ ضد CSRF؛ هدر سفارشی از مبدا متقاطع قابل ارسال نیست)
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  })
  let json: { ok?: boolean; data?: T; error?: string } | null = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok || !json?.ok) {
    throw { message: json?.error ?? "خطا در ارتباط با سرور.", status: res.status } as ApiError
  }
  return json.data as T
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(url: string, body?: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(url: string, body?: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(url: string, body?: unknown) => request<T>(url, { method: "DELETE", body: JSON.stringify(body ?? {}) }),
}

export function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as ApiError).message
  if (e instanceof Error) return e.message
  return "خطای ناشناخته"
}
