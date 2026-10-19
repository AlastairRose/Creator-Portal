"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      Download / print
    </button>
  );
}
