import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"

export const dynamic = "force-dynamic"

// صفحات محتوایی عمومی (CONTENT-001..004: فقط محتوای منتشرشده)
export default async function ContentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const page = await db.pageContent.findFirst({ where: { pageKey: key, status: "PUBLISHED" } })
  if (!page) notFound()

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <div className="mt-6 whitespace-pre-line text-[15px] leading-8 text-foreground/90">
          {page.body}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
