"use client";

import { useState } from "react";
import type { Creator } from "@/lib/types";

export default function IntakeLinksList({ creators }: { creators: Creator[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyLink(creator: Creator) {
    const url = `${window.location.origin}/intake/outstanding-custom/${creator.id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(creator.id);
    setTimeout(() => setCopiedId((current) => (current === creator.id ? null : current)), 2000);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Creator</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {creators.map((creator) => (
            <tr key={creator.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{creator.name}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => copyLink(creator)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  {copiedId === creator.id ? "Copied!" : "Copy link"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
