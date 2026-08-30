"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  markReelsUploaded,
  markReelStaffStatus,
  setReelDeclined,
  updateContentWeekDriveLink,
} from "@/lib/actions/planner";
import { saveReelToIdeas, saveReelToRdIdeas } from "@/lib/actions/reel-library";
import { submitOwnIdea } from "@/lib/actions/ideas";
import { REEL_STATUS_LABELS } from "@/lib/types";
import type { Reel, ReelStatus } from "@/lib/types";
import type { ReelDraftFields } from "@/lib/actions/creative-direction";
import Modal from "@/components/shared/Modal";
import ReelFieldsForm from "@/components/shared/ReelFieldsForm";
import DriveUploadButton from "@/components/shared/DriveUploadButton";

const EMPTY_OWN_IDEA_FIELDS: ReelDraftFields = {
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

const STATUS_BADGE_CLASS: Record<ReelStatus, string> = {
  planned: "bg-warning/15 text-warning",
  uploaded: "bg-accent/15 text-accent",
  edited: "bg-accent/15 text-accent",
  posted: "bg-success/15 text-success",
  unable_to_record: "bg-danger/15 text-danger",
  not_liked: "bg-danger/15 text-danger",
};

export default function ReelsToFilmSection({
  reels,
  isStaff,
  contentWeekId,
  driveLink,
}: {
  reels: Reel[];
  isStaff: boolean;
  contentWeekId?: string | null;
  driveLink?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const plannedIds = reels.filter((r) => r.status === "planned").map((r) => r.id);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === plannedIds.length ? new Set() : new Set(plannedIds)));
  }

  function handleMarkUploaded() {
    if (selected.size === 0) return;
    startTransition(async () => {
      await markReelsUploaded(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  }

  if (reels.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-sm font-semibold">Reels to film</h2>
          {contentWeekId && <ReelsDriveLinkField contentWeekId={contentWeekId} initialLink={driveLink ?? null} />}
        </div>
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          No reels were planned for this week.
        </div>
        {!isStaff && <SubmitOwnIdeaButton />}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-sm font-semibold">Reels to film</h2>
        <div className="flex flex-wrap items-end gap-4">
          {contentWeekId && <ReelsDriveLinkField contentWeekId={contentWeekId} initialLink={driveLink ?? null} />}
          {selected.size > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleMarkUploaded}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Mark {selected.size} as uploaded
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="w-10 px-4 py-3">
                {plannedIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={selected.size === plannedIds.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                )}
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Vertical</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {reels.map((reel) => (
              <ReelRow
                key={reel.id}
                reel={reel}
                isStaff={isStaff}
                isSelected={selected.has(reel.id)}
                onToggleSelected={() => toggleSelected(reel.id)}
                isExpanded={expandedId === reel.id}
                onToggleExpanded={() => setExpandedId(expandedId === reel.id ? null : reel.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!isStaff && <SubmitOwnIdeaButton />}
    </section>
  );
}

// Unlike the OnlyFans/Customs drive links, this one is editable by both
// staff and the creator themselves (the reels_creator_update_guard trigger
// explicitly allows a creator to change only drive_link on their own week).
function ReelsDriveLinkField({
  contentWeekId,
  initialLink,
}: {
  contentWeekId: string;
  initialLink: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialLink ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === (initialLink ?? "")) return;
    startTransition(async () => {
      await updateContentWeekDriveLink(contentWeekId, value);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">Google Drive upload link</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={isPending}
        placeholder="Paste this week's shared Drive folder link"
        className="w-80 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
      />
      {initialLink && <DriveUploadButton href={initialLink} label="Upload Reels Here" />}
    </div>
  );
}

function SubmitOwnIdeaButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ReelDraftFields>(EMPTY_OWN_IDEA_FIELDS);

  function submit() {
    if (!fields.name.trim()) return;
    startTransition(async () => {
      try {
        await submitOwnIdea(fields);
        setError(null);
        setIsOpen(false);
        setFields(EMPTY_OWN_IDEA_FIELDS);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit that idea.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-raised"
      >
        Submit Own Idea
      </button>

      {isOpen && (
        <Modal title="Submit your own idea" onClose={() => setIsOpen(false)}>
          <ReelFieldsForm
            fields={fields}
            onChange={setFields}
            disabled={isPending}
            footer={
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isPending || !fields.name.trim()}
                    onClick={submit}
                    className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Fill in whatever you like — only a short name is required, the rest is optional.
                </p>
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
            }
          />
        </Modal>
      )}
    </>
  );
}

function ReelRow({
  reel,
  isStaff,
  isSelected,
  onToggleSelected,
  isExpanded,
  onToggleExpanded,
}: {
  reel: Reel;
  isStaff: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [declining, setDeclining] = useState<"unable_to_record" | "not_liked" | null>(null);
  const [reason, setReason] = useState("");

  function submitDecline() {
    if (!declining) return;
    startTransition(async () => {
      await setReelDeclined(reel.id, declining, reason || null);
      setDeclining(null);
      setReason("");
      router.refresh();
    });
  }

  function advanceStaffStatus(status: "edited" | "posted") {
    startTransition(async () => {
      await markReelStaffStatus(reel.id, status);
      router.refresh();
    });
  }

  return (
    <Fragment>
      <tr className="border-t border-border">
        <td className="px-4 py-3">
          {reel.status === "planned" && (
            <input type="checkbox" checked={isSelected} onChange={onToggleSelected} />
          )}
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="text-left font-medium hover:text-accent"
          >
            {reel.name}
          </button>
        </td>
        <td className="px-4 py-3 text-muted">{reel.vertical}</td>
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[reel.status]}`}
          >
            {REEL_STATUS_LABELS[reel.status]}
          </span>
          {reel.status_reason && <p className="mt-1 text-xs text-muted">{reel.status_reason}</p>}
        </td>
        <td className="px-4 py-3 text-right">
          {reel.status === "planned" && !declining && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeclining("unable_to_record")}
                className="text-xs text-muted hover:text-foreground"
              >
                Unable to record
              </button>
              <button
                type="button"
                onClick={() => setDeclining("not_liked")}
                className="text-xs text-muted hover:text-foreground"
              >
                Didn&apos;t like idea
              </button>
            </div>
          )}
          {isStaff && reel.status === "uploaded" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => advanceStaffStatus("edited")}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              Mark edited
            </button>
          )}
          {isStaff && reel.status === "edited" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => advanceStaffStatus("posted")}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              Mark posted
            </button>
          )}
        </td>
      </tr>
      {declining && (
        <tr className="border-t border-border bg-surface-raised/50">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {declining === "unable_to_record" ? "Unable to record —" : "Didn't like the idea —"}
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={submitDecline}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setDeclining(null)}
                className="text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
      {isExpanded && (
        <tr className="border-t border-border">
          <td colSpan={5} className="bg-background p-4">
            <ReelDetail reel={reel} isStaff={isStaff} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function reelToDraftFields(reel: Reel): ReelDraftFields {
  return {
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
  };
}

function ReelDetail({ reel, isStaff }: { reel: Reel; isStaff: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [savedTo, setSavedTo] = useState<"rd" | "ideas" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows: [string, string | null][] = [
    ["Idea", reel.idea],
    ["Inspo link", reel.inspo_link],
    ["Required shots", reel.required_shots],
    ["Hook", reel.hook],
    ["Outfit", reel.outfit],
    ["Location", reel.location],
    ["Filming style", reel.filming_style],
  ];

  function saveToLibrary(target: "rd" | "ideas") {
    startTransition(async () => {
      try {
        const fields = reelToDraftFields(reel);
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
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {isStaff && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-4">
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
          </div>
          {savedTo && <p className="text-xs text-success">Saved to {savedTo === "rd" ? "R&D" : "Ideas"}.</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
