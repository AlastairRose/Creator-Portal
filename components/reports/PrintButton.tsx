"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
    >
      Print / Save as PDF
    </button>
  );
}
