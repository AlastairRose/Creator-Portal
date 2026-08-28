"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCreator, type CreatorFields } from "@/lib/actions/creators";
import { getCurrentWeekStart } from "@/lib/weeks";

const fieldClass =
  "rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

const EMPTY_FIELDS: CreatorFields = {
  name: "",
  ig_handle: null,
  notes: null,
  baseline_seed: null,
  track_from_date: "",
};

export default function NewCreatorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<CreatorFields>({
    ...EMPTY_FIELDS,
    track_from_date: getCurrentWeekStart(),
  });

  function set<K extends keyof CreatorFields>(key: K, value: CreatorFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!fields.name.trim()) return;
    startTransition(async () => {
      try {
        await createCreator(fields);
        setFields({ ...EMPTY_FIELDS, track_from_date: getCurrentWeekStart() });
        setError(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that creator.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">New creator</h2>
      <p className="text-xs text-muted">
        Adds to the same roster Outlier Engine uses — shows up there too, no extra syncing.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Name</label>
          <input
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={isPending}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">IG handle</label>
          <input
            value={fields.ig_handle ?? ""}
            onChange={(e) => set("ig_handle", e.target.value)}
            disabled={isPending}
            placeholder="@handle"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Baseline seed (optional)</label>
          <input
            type="number"
            min={0}
            value={fields.baseline_seed ?? ""}
            onChange={(e) => set("baseline_seed", e.target.value ? Number(e.target.value) : null)}
            disabled={isPending}
            placeholder="Typical reel views"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Track posts from</label>
          <input
            type="date"
            value={fields.track_from_date}
            onChange={(e) => set("track_from_date", e.target.value)}
            disabled={isPending}
            className={fieldClass}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Notes (optional)</label>
          <input
            value={fields.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            disabled={isPending}
            className={fieldClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={isPending || !fields.name.trim()}
        onClick={handleSubmit}
        className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add creator"}
      </button>
    </div>
  );
}
