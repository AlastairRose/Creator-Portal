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

function ReelFieldsForm({
  fields,
  onChange,
  onBlurField,
  disabled,
  footer,
}: {
  fields: ReelDraftFields;
  onChange: (fields: ReelDraftFields) => void;
  onBlurField?: () => void;
  disabled: boolean;
  footer?: React.ReactNode;
}) {
  function set<K extends keyof ReelDraftFields>(key: K, value: ReelDraftFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  const textFieldClass =
    "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" span={2}>
          <input
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="Short label shown when sharing a summary"
            className={textFieldClass}
          />
        </Field>
        <Field label="Idea" span={2}>
          <input
            value={fields.idea}
            onChange={(e) => set("idea", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="Overall idea explained clearly"
            className={textFieldClass}
          />
        </Field>
        <Field label="Inspo link" span={2}>
          <input
            value={fields.inspo_link ?? ""}
            onChange={(e) => set("inspo_link", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="Link to a similar reel"
            className={textFieldClass}
          />
        </Field>
        <Field label="Required shots" span={2}>
          <textarea
            value={fields.required_shots ?? ""}
            onChange={(e) => set("required_shots", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            rows={3}
            placeholder={"All required shots go here eg.\nShot 1 - ...\nShot 2 - ...\nShot 3 - ..."}
            className={textFieldClass}
          />
        </Field>
        <Field label="Hook (first 1-3 seconds)">
          <input
            value={fields.hook ?? ""}
            onChange={(e) => set("hook", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Outfit">
          <input
            value={fields.outfit ?? ""}
            onChange={(e) => set("outfit", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Location">
          <input
            value={fields.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Filming style">
          <input
            value={fields.filming_style ?? ""}
            onChange={(e) => set("filming_style", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            className={textFieldClass}
          />
        </Field>
        <Field label="Vertical">
          <input
            value={fields.vertical ?? ""}
            onChange={(e) => set("vertical", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            placeholder="e.g. Skit, Snapchat, Fundamental, Talking Head etc."
            className={textFieldClass}
          />
        </Field>
        <Field label="Editing notes" span={2}>
          <textarea
            value={fields.editing_notes ?? ""}
            onChange={(e) => set("editing_notes", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            rows={2}
            placeholder={
              "E.g. Music suggestion, Text on screen, Chop at X seconds, Transition between Shot 1 to shot 2"
            }
            className={textFieldClass}
          />
        </Field>
        <Field label="Posting notes" span={2}>
          <textarea
            value={fields.posting_notes ?? ""}
            onChange={(e) => set("posting_notes", e.target.value)}
            onBlur={onBlurField}
            disabled={disabled}
            rows={2}
            placeholder="E.g. Caption to be used or # to be used or tracker marker to be used"
            className={textFieldClass}
          />
        </Field>
      </div>
      {footer}
    </div>
  );
}

function Field({
  label,
  span = 1,
  children,
}: {
  label: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span === 2 ? "col-span-2" : ""}`}>
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
