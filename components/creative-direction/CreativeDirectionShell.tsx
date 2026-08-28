"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Creator } from "@/lib/types";

const TABS = [
  { href: "/creative-direction", label: "Reel Planner" },
  { href: "/creative-direction/overall-plan", label: "Overall Plan" },
];

export default function CreativeDirectionShell({
  creators,
  children,
}: {
  creators: Creator[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCreatorId = searchParams.get("creatorId") ?? creators[0]?.id ?? "";

  function handleCreatorChange(creatorId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("creatorId", creatorId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function tabHref(href: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedCreatorId) params.set("creatorId", selectedCreatorId);
    return `${href}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Creator</label>
          <select
            value={selectedCreatorId}
            onChange={(e) => handleCreatorChange(e.target.value)}
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tabHref(tab.href)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-accent text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
