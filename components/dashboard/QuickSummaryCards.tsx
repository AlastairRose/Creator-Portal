import Link from "next/link";

export default function QuickSummaryCards({
  reelsToFilmCount,
  outstandingCustomsCount,
  highlyRequestedCount,
}: {
  reelsToFilmCount: number;
  outstandingCustomsCount: number;
  highlyRequestedCount: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard href="/reels-to-film" label="Reels to Film This Week" count={reelsToFilmCount} />
      <SummaryCard href="/outstanding-customs" label="Outstanding Customs" count={outstandingCustomsCount} />
      <SummaryCard
        href="/onlyfans-content"
        label="Highly Requested OnlyFans Content"
        count={highlyRequestedCount}
      />
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
