"use client";

import { useState } from "react";
import Link from "next/link";
import type { Creator } from "@/lib/types";

type Counts = {
  reelsToFilmCount: number;
  outstandingCustomsCount: number;
  highlyRequestedCount: number;
};

const EMPTY_COUNTS: Counts = { reelsToFilmCount: 0, outstandingCustomsCount: 0, highlyRequestedCount: 0 };

export default function StaffQuickSummaryCards({
  creators,
  countsByCreatorId,
}: {
  creators: Creator[];
  countsByCreatorId: Record<string, Counts>;
}) {
  const [selected, setSelected] = useState<string>("all");

  const counts: Counts =
    selected === "all"
      ? creators.reduce((acc, c) => {
          const cc = countsByCreatorId[c.id] ?? EMPTY_COUNTS;
          return {
            reelsToFilmCount: acc.reelsToFilmCount + cc.reelsToFilmCount,
            outstandingCustomsCount: acc.outstandingCustomsCount + cc.outstandingCustomsCount,
            highlyRequestedCount: acc.highlyRequestedCount + cc.highlyRequestedCount,
          };
        }, EMPTY_COUNTS)
      : (countsByCreatorId[selected] ?? EMPTY_COUNTS);

  const query = selected === "all" ? "" : `?creatorId=${selected}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Creator</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-56 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="all">All creators</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          href={`/reels-to-film${query}`}
          label="Reels to Film This Week"
          count={counts.reelsToFilmCount}
        />
        <SummaryCard
          href={`/outstanding-customs${query}`}
          label="Outstanding Customs"
          count={counts.outstandingCustomsCount}
        />
        <SummaryCard
          href={`/onlyfans-content${query}`}
          label="Highly Requested OnlyFans Content"
          count={counts.highlyRequestedCount}
        />
      </div>
    </div>
  );
}

function SummaryCard({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent hover:bg-surface-raised"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-3xl font-semibold tracking-tight">{count}</span>
    </Link>
  );
}
