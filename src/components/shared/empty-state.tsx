export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <svg width="52" height="52" viewBox="0 0 56 56" fill="none" className="text-border" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.4">
          <rect x="16" y="16" width="24" height="24" />
          <rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)" />
        </g>
      </svg>
      <h3 className="mt-4 font-bold">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
