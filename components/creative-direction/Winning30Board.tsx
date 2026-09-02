"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createWinningReel,
  deleteWinningReel,
  fetchViralCandidates,
  importWinningReels,
  setWinningReelLastPostedDate,
  setWinningReelScheduledDate,
  updateWinningReel,
  type WinningReelFields,
} from "@/lib/actions/winning-reels";
import type { ViralPostCandidate } from "@/lib/outlier-import";
import type { WinningReel } from "@/lib/types";
import Modal from "@/components/shared/Modal";

function emptyFields(): WinningReelFields {
  return {
    title: "",
    original_link: null,
    footage_link: null,
    scheduled_for: new Date().toISOString().slice(0, 10),
    last_posted_date: null,
  };
}

function fieldsFromReel(reel: WinningReel): WinningReelFields {
  return {
    title: reel.title,
    original_link: reel.original_link,
    footage_link: reel.footage_link,
    scheduled_for: reel.scheduled_for,
    last_posted_date: reel.last_posted_date,
  };
}

export default function Winning30Board({ creatorId, reels }: { creatorId: string; reels: WinningReel[] }) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingReel, setEditingReel] = useState<WinningReel | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + Add winner
        </button>
        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised"
        >
          Import from Outlier Engine
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Original</th>
              <th className="px-4 py-3 font-medium">Footage</th>
              <th className="px-4 py-3 font-medium">Last posted</th>
              <th className="px-4 py-3 font-medium">Scheduled for</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {reels.map((reel) => (
              <ReelRow key={reel.id} reel={reel} onEdit={() => setEditingReel(reel)} />
            ))}
            {reels.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No winning reels saved yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddOpen && (
        <ReelFormModal
          title="Add winner"
          submitLabel="Add"
          initial={emptyFields()}
          onClose={() => setIsAddOpen(false)}
          onSubmit={(fields) => createWinningReel(creatorId, fields)}
          onSaved={() => {
            setIsAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingReel && (
        <ReelFormModal
          title="Edit winner"
          submitLabel="Save"
          initial={fieldsFromReel(editingReel)}
          onClose={() => setEditingReel(null)}
          onSubmit={(fields) => updateWinningReel(editingReel.id, fields)}
          onSaved={() => {
            setEditingReel(null);
            router.refresh();
          }}
        />
      )}

      {isImportOpen && (
        <ImportModal
          creatorId={creatorId}
          onClose={() => setIsImportOpen(false)}
          onSaved={() => {
            setIsImportOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ImportModal({
  creatorId,
  onClose,
  onSaved,
}: {
  creatorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [candidates, setCandidates] = useState<ViralPostCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchViralCandidates(creatorId)
      .then((found) => {
        if (!active) return;
        setCandidates(found);
        setSelected(new Set(found.map((c) => c.postId)));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load candidates.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(postId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function submit() {
    const chosen = candidates.filter((c) => selected.has(c.postId));
    startTransition(async () => {
      try {
        await importWinningReels(creatorId, chosen);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't import those reels.");
      }
    });
  }

  return (
    <Modal title="Import viral reels from Outlier Engine" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted">
          Reels flagged viral (10x+ their own baseline) that aren&apos;t already in this list. The
          Drive footage link isn&apos;t known to Outlier Engine, so add it by hand afterward.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted">No new viral reels found.</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.size === candidates.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(candidates.map((c) => c.postId)) : new Set())
                      }
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Posted</th>
                  <th className="px-3 py-2 font-medium">Views</th>
                  <th className="px-3 py-2 font-medium">Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.postId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(c.postId)}
                        onChange={() => toggle(c.postId)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <a href={c.originalLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        {c.title}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted">{c.datePosted}</td>
                    <td className="px-3 py-2 text-muted">{c.views.toLocaleString()}</td>
                    <td className="px-3 py-2 text-muted">{c.multiplier.toFixed(1)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending || isLoading || selected.size === 0}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add {selected.size > 0 ? selected.size : ""} selected
          </button>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReelRow({ reel, onEdit }: { reel: WinningReel; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(reel.scheduled_for);
  const [lastPosted, setLastPosted] = useState(reel.last_posted_date ?? "");

  function saveDate(nextDate: string) {
    if (!nextDate || nextDate === reel.scheduled_for) return;
    startTransition(async () => {
      await setWinningReelScheduledDate(reel.id, nextDate);
      router.refresh();
    });
  }

  function saveLastPosted(nextDate: string) {
    if (nextDate === (reel.last_posted_date ?? "")) return;
    startTransition(async () => {
      await setWinningReelLastPostedDate(reel.id, nextDate || null);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteWinningReel(reel.id);
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">{reel.title}</td>
      <td className="px-4 py-3">
        {reel.original_link ? (
          <a href={reel.original_link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Link
          </a>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {reel.footage_link ? (
          <a href={reel.footage_link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Link
          </a>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={lastPosted}
          onChange={(e) => setLastPosted(e.target.value)}
          onBlur={(e) => saveLastPosted(e.target.value)}
          disabled={isPending}
          className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-70"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={(e) => saveDate(e.target.value)}
          disabled={isPending}
          className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-70"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-3 text-xs">
          <button type="button" onClick={onEdit} className="text-muted hover:text-foreground">
            Edit
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={remove}
            className="text-danger hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function ReelFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initial: WinningReelFields;
  onClose: () => void;
  onSubmit: (fields: WinningReelFields) => Promise<void>;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<WinningReelFields>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const textFieldClass =
    "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

  function submit() {
    startTransition(async () => {
      try {
        await onSubmit(fields);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that.");
      }
    });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Title</label>
          <input
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
            disabled={isPending}
            placeholder="A short label to find this reel again later"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Link to the original</label>
          <input
            value={fields.original_link ?? ""}
            onChange={(e) => setFields({ ...fields, original_link: e.target.value })}
            disabled={isPending}
            placeholder="Link to where it was originally posted"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Link to original footage</label>
          <input
            value={fields.footage_link ?? ""}
            onChange={(e) => setFields({ ...fields, footage_link: e.target.value })}
            disabled={isPending}
            placeholder="Where the raw footage lives in the shared Drive"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Last posted</label>
          <input
            type="date"
            value={fields.last_posted_date ?? ""}
            onChange={(e) => setFields({ ...fields, last_posted_date: e.target.value || null })}
            disabled={isPending}
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Scheduled for</label>
          <input
            type="date"
            value={fields.scheduled_for}
            onChange={(e) => setFields({ ...fields, scheduled_for: e.target.value })}
            disabled={isPending}
            className={textFieldClass}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending || !fields.title.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitLabel}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
