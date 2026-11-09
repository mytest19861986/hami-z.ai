"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell } from "lucide-react"
import { api } from "@/lib/client"
import { faDateTime } from "@/lib/jalali"
import { cn } from "@/lib/utils"

interface Notice {
  id: string
  title: string
  body: string | null
  type: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

// زنگ اعلان‌ها (NOTICE-001/002 · USER-010)
export function useNotifications() {
  const router = useRouter()
  const [items, setItems] = useState<Notice[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    api
      .get<{ items: Notice[]; unreadCount: number }>("/api/v1/user/notifications")
      .then((d) => {
        if (!mounted) return
        setItems(d.items)
        setUnread(d.unreadCount)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  async function markAllRead() {
    await api.post("/api/v1/user/notifications", { all: true }).catch(() => {})
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const bell = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="اعلان‌ها">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 99 ? "۹۹+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">اعلان‌ها</span>
          {unread > 0 ? (
            <button className="text-xs text-primary hover:underline" onClick={markAllRead}>
              خواندن همه
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">اعلانی ندارید.</p>
          ) : (
            items.slice(0, 10).map((n) => (
              <div
                key={n.id}
                className={cn("border-b px-3 py-2.5 text-sm last:border-b-0", !n.isRead && "bg-primary/5")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("font-medium", !n.isRead && "text-primary")}>{n.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{faDateTime(n.createdAt)}</span>
                </div>
                {n.body ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                {n.linkUrl ? (
                  <button
                    className="mt-1 text-xs text-primary hover:underline"
                    onClick={() => {
                      setOpen(false)
                      router.push(n.linkUrl!)
                    }}
                  >
                    مشاهده
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="border-t p-2 text-center">
          <Link href="/user/notifications" className="text-xs text-primary hover:underline">
            همه اعلان‌ها
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )

  return { bell, items, unread, markAllRead }
}
