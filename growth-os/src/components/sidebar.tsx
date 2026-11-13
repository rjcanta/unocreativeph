"use client";

import { BarChart3, Handshake, Inbox, LayoutDashboard, ListChecks, Mail, Menu, Plug, Settings, ShieldCheck, Users, Workflow, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/actions", label: "Action Queue", icon: ListChecks, key: "actions", badge: "tasks" },
  { href: "/contacts", label: "Contacts", icon: Users, key: "contacts" },
  { href: "/campaigns", label: "Nurture Campaigns", icon: Mail, key: "campaigns", badge: "approvals" },
  { href: "/inbox", label: "Replies", icon: Inbox, key: "inbox", badge: "replies" },
  { href: "/opportunities", label: "Opportunities", icon: Handshake, key: "opportunities" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, key: "analytics" },
] as const;

const SYSTEM = [
  { href: "/automation", label: "Automation", icon: Workflow, key: "automation", badge: "failed" },
  { href: "/settings", label: "Settings", icon: Settings, key: "settings" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, key: "integrations" },
  { href: "/settings/audit", label: "Audit log", icon: ShieldCheck, key: "audit" },
] as const;

export type NavCounts = { tasks: number; approvals: number; replies: number; failed: number };

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/settings") return path === "/settings";
  return path === href || path.startsWith(`${href}/`);
}

function NavList({ counts, path, onNavigate }: { counts: NavCounts; path: string; onNavigate?: () => void }) {
  const item = (n: (typeof NAV)[number] | (typeof SYSTEM)[number]) => {
    const Icon = n.icon;
    const active = isActive(path, n.href);
    const count = "badge" in n ? counts[n.badge as keyof NavCounts] : 0;
    return (
      <Link
        key={n.key}
        href={n.href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors",
          active ? "bg-sage-50 font-medium text-sage-800" : "text-ink-muted hover:bg-subtle hover:text-ink",
        )}
      >
        <Icon className={cn("size-4 shrink-0", active ? "text-sage-600" : "text-ink-faint group-hover:text-ink-muted")} />
        <span className="flex-1 truncate">{n.label}</span>
        {count > 0 ? (
          <span className={cn("tabular rounded-full px-1.5 text-[11px] font-medium", n.key === "automation" ? "bg-rose-50 text-rose-600" : "bg-sand-100 text-clay-600")}>{count}</span>
        ) : null}
      </Link>
    );
  };
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {NAV.map(item)}
      <div className="mb-1 mt-5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">System</div>
      {SYSTEM.map(item)}
    </nav>
  );
}

function Brand({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-sage-600 text-[13px] font-semibold text-white">GO</div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold leading-tight text-ink">Realtor Growth OS</div>
        <div className="truncate text-[11.5px] text-ink-faint">{workspaceName}</div>
      </div>
    </div>
  );
}

export function Sidebar({ counts, workspaceName, userName, isDemo }: { counts: NavCounts; workspaceName: string; userName: string; isDemo: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const footer = (
    <div className="border-t border-line px-5 py-3">
      <div className="text-[13px] font-medium text-ink">{userName}</div>
      <div className="text-[11.5px] text-ink-faint">{isDemo ? "Demo authentication — not for production" : "Signed in"}</div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <Brand workspaceName={workspaceName} />
        <NavList counts={counts} path={path} />
        {footer}
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-sage-600 text-[11px] font-semibold text-white">GO</div>
          <span className="text-sm font-semibold">Growth OS</span>
        </div>
        <button aria-label="Open navigation" className="rounded-md p-1.5 text-ink-muted hover:bg-subtle" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Brand workspaceName={workspaceName} />
              <button aria-label="Close navigation" className="rounded-md p-1.5 text-ink-muted hover:bg-subtle" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <NavList counts={counts} path={path} onNavigate={() => setOpen(false)} />
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  );
}
