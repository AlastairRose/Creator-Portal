"use client";

import { useState, useTransition } from "react";
import { upsertCreatorPlan } from "@/lib/actions/creator-plans";
import { updateWeeklyRootDriveLink } from "@/lib/actions/creator-drive-links";
import type { Creator, CreatorDriveLinks, CreatorPlan } from "@/lib/types";

export default function OverallPlanCard({
  creator,
  plan,
  driveLinks,
}: {
  creator: Creator;
  plan: CreatorPlan | null;
  driveLinks: CreatorDriveLinks | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedReelsPerWeek, setAgreedReelsPerWeek] = useState(
    plan?.agreed_reels_per_week?.toString() ?? ""
  );
  const [nicheBranding, setNicheBranding] = useState(plan?.niche_branding ?? "");
  const [verticals, setVerticals] = useState<string[]>(plan?.verticals_agreed ?? []);
  const [newVertical, setNewVertical] = useState("");
  const [weeklyRootDriveLink, setWeeklyRootDriveLink] = useState(driveLinks?.weekly_root_drive_link ?? "");
  const [isDriveLinkPending, startDriveLinkTransition] = useTransition();

  function addVertical() {
    const value = newVertical.trim();
    if (!value || verticals.includes(value)) return;
    setVerticals([...verticals, value]);
    setNewVertical("");
  }

  function removeVertical(value: string) {
    setVerticals(verticals.filter((v) => v !== value));
  }

  function saveWeeklyRootDriveLink() {
    if (weeklyRootDriveLink === (driveLinks?.weekly_root_drive_link ?? "")) return;
    startDriveLinkTransition(async () => {
      await updateWeeklyRootDriveLink(creator.id, weeklyRootDriveLink);
    });
  }

  function save() {
    startTransition(async () => {
      try {
        await upsertCreatorPlan(creator.id, {
          agreed_reels_per_week: agreedReelsPerWeek ? Number(agreedReelsPerWeek) : null,
          niche_branding: nicheBranding || null,
          verticals_agreed: verticals,
        });
        setSaved(true);
        setError(null);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  const textFieldClass =
    "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{creator.name} — Overall Plan</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Agreed reels per week</label>
        <input
          type="number"
          min={0}
          value={agreedReelsPerWeek}
          onChange={(e) => setAgreedReelsPerWeek(e.target.value)}
          disabled={isPending}
          className={`${textFieldClass} max-w-[160px]`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Niche / Branding</label>
        <textarea
          value={nicheBranding}
          onChange={(e) => setNicheBranding(e.target.value)}
          disabled={isPending}
          rows={4}
          placeholder="Describe the creator's niche, branding, or overarching story"
          className={textFieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Verticals agreed</label>
        <div className="flex flex-wrap gap-2">
          {verticals.map((vertical) => (
            <span
              key={vertical}
              className="flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-xs"
            >
              {vertical}
              <button
                type="button"
                disabled={isPending}
                onClick={() => removeVertical(vertical)}
                className="text-muted hover:text-danger disabled:opacity-50"
                aria-label={`Remove ${vertical}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newVertical}
            onChange={(e) => setNewVertical(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addVertical();
              }
            }}
            disabled={isPending}
            placeholder="e.g. Skit, Snapchat, Fundamental, Talking Head etc."
            className={textFieldClass}
          />
          <button
            type="button"
            disabled={isPending || !newVertical.trim()}
            onClick={addVertical}
            className="shrink-0 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-5">
        <label className="text-xs font-medium text-muted">Weekly Drive folder (optional)</label>
        <input
          value={weeklyRootDriveLink}
          onChange={(e) => setWeeklyRootDriveLink(e.target.value)}
          onBlur={saveWeeklyRootDriveLink}
          disabled={isDriveLinkPending}
          placeholder="Paste a Drive folder link to create weekly folders inside it instead of the default"
          className={textFieldClass}
        />
        <p className="text-xs text-muted">
          When a week is published, the dated folder is created here instead of under the default
          &quot;Creator Portal / {creator.name}&quot; folder. Leave blank to use the default.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-success">Saved.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
