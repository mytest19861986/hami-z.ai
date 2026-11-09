export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display flex items-center gap-2.5 text-xl font-extrabold sm:text-2xl">
          <span className="h-5 w-1.5 rounded-full bg-gold" />
          {title}
        </h1>
        {description ? <p className="mt-1.5 pr-4 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
