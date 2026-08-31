"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Creator } from "@/lib/types";

const TABS = [
  { href: "/creative-direction", label: "Reel Planner" },
  { href: "/creative-direction/overall-plan", label: "Overall Plan" },
  { href: "/creative-direction/rd", label: "R&D" },
  { href: "/creative-direction/ideas", label: "Ideas" },
  { href: "/creative-direction/ofcd", label: "OFCD" },
];

// R&D, Ideas, and OFCD are shared idea libraries, not scoped to one creator,
// so they don't need (and would be misleading next to) the creator selector
// — each pushes to whichever creator is picked in its own "Add to plan" step
// instead.
const CREATOR_SCOPED_TABS = new Set(["/creative-direction", "/creative-direction/overall-plan"]);

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
  const isCreatorScoped = CREATOR_SCOPED_TABS.has(pathname);

  function handleCreatorChange(creatorId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("creatorId", creatorId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function tabHref(href: string) {
    if (!CREATOR_SCOPED_TABS.has(href)) return href;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedCreatorId) params.set("creatorId", selectedCreatorId);
    return `${href}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      {isCreatorScoped && (
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
      )}

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
