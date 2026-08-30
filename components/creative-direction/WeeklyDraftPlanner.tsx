"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  createDraftReel,
  createDraftReelLenient,
  deleteDraftReel,
  ensureDraftWeek,
  publishContentWeek,
  updateDraftReel,
  type ReelDraftFields,
} from "@/lib/actions/creative-direction";
import { pushRdIdeaToWeek } from "@/lib/actions/rd-ideas";
import { pushIdeaToWeek } from "@/lib/actions/ideas";
import { saveReelToIdeas, saveReelToRdIdeas } from "@/lib/actions/reel-library";
import { getMissingReelFields } from "@/lib/reels";
import WeekPicker from "@/components/shared/WeekPicker";
import ReelFieldsForm from "@/components/shared/ReelFieldsForm";
import Modal from "@/components/shared/Modal";
import type { ContentWeek, Creator, Idea, RdIdea, Reel } from "@/lib/types";

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

// Common shape both RdIdea and Idea satisfy — enough for the picker list.
type LibraryItem = {
  id: string;
  name: string;
  idea: string | null;
  inspo_link: string | null;
  required_shots: string | null;
  hook: string | null;
  outfit: string | null;
  location: string | null;
  filming_style: string | null;
  editing_notes: string | null;
  posting_notes: string | null;
  vertical: string | null;
  suitable_creator_ids: string[];
};

function toReelDraftFields(item: LibraryItem): ReelDraftFields {
  return {
    name: item.name,
    idea: item.idea ?? "",
    inspo_link: item.inspo_link,
    required_shots: item.required_shots,
    hook: item.hook,
    outfit: item.outfit,
    location: item.location,
    filming_style: item.filming_style,
    editing_notes: item.editing_notes,
    posting_notes: item.posting_notes,
    vertical: item.vertical,
  };
}

export default function WeeklyDraftPlanner({
  selectedCreatorId,
  weekStartDate,
  contentWeek,
  reels,
  agreedReelsPerWeek,
  rdIdeas,
  ideas,
  creators,
}: {
  selectedCreatorId: string | null;
  weekStartDate: string;
  contentWeek: ContentWeek | null;
  reels: Reel[];
  agreedReelsPerWeek: number | null;
  rdIdeas: RdIdea[];
  ideas: Idea[];
  creators: Creator[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(params: { week?: string }) {
    const url = new URL(window.location.href);
    if (params.week !== undefined) url.searchParams.set("week", params.week);
    router.push(`${url.pathname}${url.search}`);
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

        {!isPublished && selectedCreatorId && (
          <AddReelFlow
            selectedCreatorId={selectedCreatorId}
            weekStartDate={weekStartDate}
            contentWeekId={contentWeek?.id ?? null}
            reelCount={reels.length}
            rdIdeas={rdIdeas}
            ideas={ideas}
            creators={creators}
          />
        )}
      </div>
    </div>
  );
}

function AddReelFlow({
  selectedCreatorId,
  weekStartDate,
  contentWeekId,
  reelCount,
  rdIdeas,
  ideas,
  creators,
}: {
  selectedCreatorId: string;
  weekStartDate: string;
  contentWeekId: string | null;
  reelCount: number;
  rdIdeas: RdIdea[];
  ideas: Idea[];
  creators: Creator[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<null | "menu" | "pick-rd" | "pick-ideas" | "confirm">(null);
  const [source, setSource] = useState<"new" | "rd" | "ideas">("new");
  const [fields, setFields] = useState<ReelDraftFields>(EMPTY_FIELDS);
  const [error, setError] = useState<string | null>(null);

  function openMenu() {
    setStage("menu");
    setError(null);
  }

  function pickNew() {
    setFields(EMPTY_FIELDS);
    setSource("new");
    setStage("confirm");
  }

  function pickFromLibrary(item: LibraryItem, itemSource: "rd" | "ideas") {
    setFields(toReelDraftFields(item));
    setSource(itemSource);
    setStage("confirm");
  }

  const missingFields = source === "new" ? getMissingReelFields(fields) : [];
  const canSubmit = source === "new" ? missingFields.length === 0 : fields.name.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        if (source === "new") {
          const weekId = contentWeekId ?? (await ensureDraftWeek(selectedCreatorId, weekStartDate));
          await createDraftReel(weekId, selectedCreatorId, fields, reelCount);
        } else if (source === "rd") {
          await pushRdIdeaToWeek(fields, selectedCreatorId, weekStartDate);
        } else {
          await pushIdeaToWeek(fields, selectedCreatorId, weekStartDate);
        }
        setError(null);
        setStage(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that reel.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        + Add Reel
      </button>

      {stage === "menu" && (
        <Modal title="Add Reel" onClose={() => setStage(null)}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={pickNew}
              className="rounded-md border border-border px-4 py-3 text-left text-sm hover:bg-surface-raised"
            >
              <span className="font-medium">New Reel</span>
              <p className="mt-0.5 text-xs text-muted">Fill in a brand new reel from scratch</p>
            </button>
            <button
              type="button"
              onClick={() => setStage("pick-rd")}
              className="rounded-md border border-border px-4 py-3 text-left text-sm hover:bg-surface-raised"
            >
              <span className="font-medium">Add from R&D</span>
              <p className="mt-0.5 text-xs text-muted">Pick a saved R&D idea and add it to this week</p>
            </button>
            <button
              type="button"
              onClick={() => setStage("pick-ideas")}
              className="rounded-md border border-border px-4 py-3 text-left text-sm hover:bg-surface-raised"
            >
              <span className="font-medium">Add from Ideas</span>
              <p className="mt-0.5 text-xs text-muted">Pick a saved idea and add it to this week</p>
            </button>
          </div>
        </Modal>
      )}

      {(stage === "pick-rd" || stage === "pick-ideas") && (
        <LibraryPickerModal
          title={stage === "pick-rd" ? "Add from R&D" : "Add from Ideas"}
          items={stage === "pick-rd" ? rdIdeas : ideas}
          creators={creators}
          defaultCreatorId={selectedCreatorId}
          onBack={() => setStage("menu")}
          onClose={() => setStage(null)}
          onPick={(item) => pickFromLibrary(item, stage === "pick-rd" ? "rd" : "ideas")}
        />
      )}

      {stage === "confirm" && (
        <Modal title="Add Reel" onClose={() => setStage(null)}>
          <ReelFieldsForm
            fields={fields}
            onChange={setFields}
            disabled={isPending}
            footer={
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isPending || !canSubmit}
                    onClick={submit}
                    className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Add to plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage(null)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
                {source === "new" && missingFields.length > 0 && (
                  <p className="text-xs text-muted">Every field is required. Still missing: {missingFields.join(", ")}.</p>
                )}
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
            }
          />
        </Modal>
      )}
    </>
  );
}

function LibraryPickerModal({
  title,
  items,
  creators,
  defaultCreatorId,
  onBack,
  onClose,
  onPick,
}: {
  title: string;
  items: LibraryItem[];
  creators: Creator[];
  defaultCreatorId: string;
  onBack: () => void;
  onClose: () => void;
  onPick: (item: LibraryItem) => void;
}) {
  const [filterVertical, setFilterVertical] = useState("");
  const [filterCreatorId, setFilterCreatorId] = useState(defaultCreatorId);

  const verticals = useMemo(
    () => Array.from(new Set(items.map((i) => i.vertical).filter((v): v is string => Boolean(v)))).sort(),
    [items]
  );

  const filtered = items.filter((item) => {
    if (filterVertical && item.vertical !== filterVertical) return false;
    if (filterCreatorId && !item.suitable_creator_ids.includes(filterCreatorId)) return false;
    return true;
  });

  const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Vertical</label>
            <select
              value={filterVertical}
              onChange={(e) => setFilterVertical(e.target.value)}
              className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">All verticals</option>
              {verticals.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Suitable for</label>
            <select
              value={filterCreatorId}
              onChange={(e) => setFilterCreatorId(e.target.value)}
              className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">All creators</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Vertical</th>
                <th className="px-3 py-2 font-medium">Suitable creators</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onPick(item)}
                  className="cursor-pointer border-t border-border hover:bg-surface-raised"
                >
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 text-muted">{item.vertical || "—"}</td>
                  <td className="px-3 py-2 text-muted">
                    {item.suitable_creator_ids.length > 0
                      ? item.suitable_creator_ids.map((id) => creatorNameById.get(id) ?? "Unknown").join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    Nothing matches those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button type="button" onClick={onBack} className="self-start text-xs text-muted hover:text-foreground">
          ← Back
        </button>
      </div>
    </Modal>
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
  const [savedTo, setSavedTo] = useState<"rd" | "ideas" | null>(null);
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

  function saveToLibrary(target: "rd" | "ideas") {
    startTransition(async () => {
      try {
        if (target === "rd") await saveReelToRdIdeas(fields, reel.creator_id);
        else await saveReelToIdeas(fields, reel.creator_id);
        setError(null);
        setSavedTo(target);
        setTimeout(() => setSavedTo(null), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that.");
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
            <div className="flex flex-wrap gap-4">
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
                onClick={() => saveToLibrary("rd")}
                className="self-start text-xs text-muted hover:text-foreground disabled:opacity-50"
              >
                Save to R&D
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => saveToLibrary("ideas")}
                className="self-start text-xs text-muted hover:text-foreground disabled:opacity-50"
              >
                Save to Ideas
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
          {savedTo && <p className="text-xs text-success">Saved to {savedTo === "rd" ? "R&D" : "Ideas"}.</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      }
    />
  );
}
