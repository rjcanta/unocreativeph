import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-faint">{eyebrow}</div> : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-sage-50 text-sage-600 [&_svg]:size-5">{icon}</div> : null}
      <div className="text-sm font-medium text-ink">{title}</div>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, href, tone = "default", icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; tone?: "default" | "attention"; icon?: React.ReactNode }) {
  const inner = (
    <div className={cn("h-full rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-card)] transition-colors", tone === "attention" ? "border-clay-500/30" : "border-line", href && "hover:border-sage-200 hover:bg-sage-50/40")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-medium text-ink-muted">{label}</div>
        {icon ? <div className="text-ink-faint [&_svg]:size-4">{icon}</div> : null}
      </div>
      <div className={cn("tabular mt-2 text-[26px] font-semibold leading-none tracking-tight", tone === "attention" ? "text-clay-600" : "text-ink")}>{value}</div>
      {hint ? <div className="mt-2 text-[12px] text-ink-faint">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string; count?: number }[]; current: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
            current === t.key ? "border-sage-600 font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="tabular rounded-full bg-subtle px-1.5 text-[11px] text-ink-muted">{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Reasons({ reasons, className }: { reasons: string[]; className?: string }) {
  if (!reasons.length) return null;
  return (
    <ul className={cn("space-y-1 text-[12.5px] text-ink-muted", className)}>
      {reasons.map((r, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-faint" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

export function KeyValue({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 text-ink-muted">{k}</dt>
          <dd className="min-w-0 text-right text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-sky-600/20 bg-sky-50 text-sky-600",
    warning: "border-amber-600/25 bg-amber-50 text-amber-600",
    danger: "border-rose-600/25 bg-rose-50 text-rose-600",
    success: "border-sage-200 bg-sage-50 text-sage-700",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-[13px]", tones[tone], className)}>
      {title ? <div className="font-medium">{title}</div> : null}
      {children ? <div className={cn("text-ink-muted", title && "mt-0.5")}>{children}</div> : null}
    </div>
  );
}
