"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  createDraftReel,
  createDraftReelLenient,
  deleteDraftReel,
  ensureDraftWeek,
  publishContentWeek,
  updateDraftReel,
  type ReelDraftFields,
} from "@/lib/actions/creative-direction";
import { getMissingReelFields } from "@/lib/reels";
import WeekPicker from "@/components/shared/WeekPicker";
import ReelFieldsForm from "@/components/shared/ReelFieldsForm";
import type { ContentWeek, Reel } from "@/lib/types";

const EMPTY_FIELDS: ReelDraftFields = {
  name: "",
  idea: "",
  inspo_link: null,
  required_shots: null,
  hook: null,
  outfit: null,
  location: null,
  filming_style: null,
  editing_notes: null,
  posting_notes: null,
  vertical: null,
};

export default function WeeklyDraftPlanner({
  selectedCreatorId,
  weekStartDate,
  contentWeek,
  reels,
  agreedReelsPerWeek,
}: {
  selectedCreatorId: string | null;
  weekStartDate: string;
  contentWeek: ContentWeek | null;
  reels: Reel[];
  agreedReelsPerWeek: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newFields, setNewFields] = useState<ReelDraftFields>(EMPTY_FIELDS);

  function navigate(params: { week?: string }) {
    const url = new URL(window.location.href);
    if (params.week !== undefined) url.searchParams.set("week", params.week);
    router.push(`${url.pathname}${url.search}`);
  }

  const missingNewFields = getMissingReelFields(newFields);

  function handleAddReel() {
    if (!selectedCreatorId || missingNewFields.length > 0) return;
    startTransition(async () => {
      const weekId = contentWeek?.id ?? (await ensureDraftWeek(selectedCreatorId, weekStartDate));
      await createDraftReel(weekId, selectedCreatorId, newFields, reels.length);
      setNewFields(EMPTY_FIELDS);
      router.refresh();
    });
  }

  const isPublished = contentWeek?.status === "published";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Week</label>
          <WeekPicker weekStartDate={weekStartDate} onChange={(week) => navigate({ week })} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted">
            {agreedReelsPerWeek != null ? (
              <>
                <span className="font-medium text-foreground">{reels.length}</span>
                {" / "}
                {agreedReelsPerWeek} reels planned
              </>
            ) : (
              <>{reels.length} reels planned</>
            )}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              isPublished ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
          {contentWeek && !isPublished && reels.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await publishContentWeek(contentWeek.id);
                  router.refresh();
                })
              }
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Publish week
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {reels.length > 0 && (
          <ReelsTable reels={reels} disabled={isPublished || isPending} reelCount={reels.length} />
        )}

        {reels.length === 0 && isPublished && (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
            No reels were planned for this week.
          </div>
        )}

        {!isPublished && (
          <ReelFieldsForm
            fields={newFields}
            onChange={setNewFields}
            disabled={isPending}
            footer={
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isPending || missingNewFields.length > 0}
                  onClick={handleAddReel}
                  className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Add reel
                </button>
                {missingNewFields.length > 0 && (
                  <p className="text-xs text-muted">
                    Every field is required. Still missing: {missingNewFields.join(", ")}.
                  </p>
                )}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}

function ReelsTable({
  reels,
  disabled,
  reelCount,
}: {
  reels: Reel[];
  disabled: boolean;
  reelCount: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Vertical</th>
            <th className="px-4 py-3 font-medium">Outfit</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Inspo link</th>
          </tr>
        </thead>
        <tbody>
          {reels.map((reel) => {
            const isExpanded = expandedId === reel.id;
            return (
              <Fragment key={reel.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : reel.id)}
                  className="cursor-pointer border-t border-border hover:bg-surface-raised"
                >
                  <td className="px-4 py-3 font-medium">{reel.name}</td>
                  <td className="px-4 py-3 text-muted">{reel.vertical}</td>
                  <td className="px-4 py-3 text-muted">{reel.outfit}</td>
                  <td className="px-4 py-3 text-muted">{reel.location}</td>
                  <td className="px-4 py-3 text-muted">
                    {reel.inspo_link ? (
                      <a
                        href={reel.inspo_link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent hover:underline"
                      >
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-t border-border">
                    <td colSpan={5} className="bg-background p-4">
                      <ReelCard reel={reel} disabled={disabled} reelCount={reelCount} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReelCard({
  reel,
  disabled,
  reelCount,
}: {
  reel: Reel;
  disabled: boolean;
  reelCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ReelDraftFields>({
    name: reel.name,
    idea: reel.idea,
    inspo_link: reel.inspo_link,
    required_shots: reel.required_shots,
    hook: reel.hook,
    outfit: reel.outfit,
    location: reel.location,
    filming_style: reel.filming_style,
    editing_notes: reel.editing_notes,
    posting_notes: reel.posting_notes,
    vertical: reel.vertical,
  });

  function save() {
    startTransition(async () => {
      try {
        await updateDraftReel(reel.id, fields);
        setError(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that change.");
      }
    });
  }

  function duplicate() {
    startTransition(async () => {
      try {
        await createDraftReelLenient(reel.content_week_id, reel.creator_id, fields, reelCount);
        setError(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't duplicate that reel.");
      }
    });
  }

  return (
    <ReelFieldsForm
      fields={fields}
      onChange={setFields}
      onBlurField={save}
      disabled={disabled || isPending}
      footer={
        <div className="flex flex-col gap-2">
          {!disabled && (
            <div className="flex gap-4">
              <button
                type="button"
                disabled={isPending}
                onClick={duplicate}
                className="self-start text-xs text-accent hover:underline disabled:opacity-50"
              >
                Duplicate reel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteDraftReel(reel.id);
                    router.refresh();
                  })
                }
                className="self-start text-xs text-danger hover:underline disabled:opacity-50"
              >
                Remove reel
              </button>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      }
    />
  );
}

