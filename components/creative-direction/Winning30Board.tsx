"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createWinningReel,
  deleteWinningReel,
  markWinningReelPostedToday,
  updateWinningReel,
  type WinningReelFields,
} from "@/lib/actions/winning-reels";
import type { WinningReel } from "@/lib/types";
import Modal from "@/components/shared/Modal";

function emptyFields(): WinningReelFields {
  return {
    title: "",
    original_link: null,
    footage_link: null,
    last_posted_date: new Date().toISOString().slice(0, 10),
  };
}

function fieldsFromReel(reel: WinningReel): WinningReelFields {
  return {
    title: reel.title,
    original_link: reel.original_link,
    footage_link: reel.footage_link,
    last_posted_date: reel.last_posted_date,
  };
}

export default function Winning30Board({ creatorId, reels }: { creatorId: string; reels: WinningReel[] }) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingReel, setEditingReel] = useState<WinningReel | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        + Add winner
      </button>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Original</th>
              <th className="px-4 py-3 font-medium">Footage</th>
              <th className="px-4 py-3 font-medium">Last posted</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {reels.map((reel) => (
              <ReelRow key={reel.id} reel={reel} onEdit={() => setEditingReel(reel)} />
            ))}
            {reels.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
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
    </div>
  );
}

function ReelRow({ reel, onEdit }: { reel: WinningReel; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function markPostedToday() {
    startTransition(async () => {
      await markWinningReelPostedToday(reel.id);
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
      <td className="px-4 py-3 text-muted">{reel.last_posted_date}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-3 text-xs">
          <button
            type="button"
            disabled={isPending}
            onClick={markPostedToday}
            className="text-accent hover:underline disabled:opacity-50"
          >
            Mark posted today
          </button>
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
          <label className="text-xs font-medium text-muted">Last posted date</label>
          <input
            type="date"
            value={fields.last_posted_date}
            onChange={(e) => setFields({ ...fields, last_posted_date: e.target.value })}
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
