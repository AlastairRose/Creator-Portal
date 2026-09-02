"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  createSop,
  deleteSop,
  removeSopDocument,
  updateSop,
  type SopFields,
} from "@/lib/actions/sops";
import { getSopDocumentSignedUrl } from "@/lib/storage";
import type { Sop } from "@/lib/types";
import Modal from "@/components/shared/Modal";

function emptyFields(): SopFields {
  return { title: "", category: null, description: null, video_link: null };
}

function fieldsFromSop(sop: Sop): SopFields {
  return { title: sop.title, category: sop.category, description: sop.description, video_link: sop.video_link };
}

export default function SopsBoard({ sops }: { sops: Sop[] }) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [filterCategory, setFilterCategory] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(sops.map((s) => s.category).filter((c): c is string => Boolean(c)))).sort(),
    [sops]
  );

  const visible = sops.filter((s) => !filterCategory || s.category === filterCategory);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + Add SOP
        </button>
        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Filter by category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Video</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((sop) => (
              <SopRow key={sop.id} sop={sop} onEdit={() => setEditingSop(sop)} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  {sops.length === 0 ? "No SOPs added yet." : "No SOPs match that category."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddOpen && (
        <SopFormModal
          title="Add SOP"
          submitLabel="Add"
          initial={emptyFields()}
          hasExistingDocument={false}
          onClose={() => setIsAddOpen(false)}
          onSubmit={(fields, file) => createSop(fields, file)}
          onSaved={() => {
            setIsAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingSop && (
        <SopFormModal
          title="Edit SOP"
          submitLabel="Save"
          initial={fieldsFromSop(editingSop)}
          hasExistingDocument={Boolean(editingSop.document_path)}
          existingDocumentFilename={editingSop.document_filename}
          onRemoveDocument={() => removeSopDocument(editingSop.id)}
          onClose={() => setEditingSop(null)}
          onSubmit={(fields, file) => updateSop(editingSop.id, fields, file)}
          onSaved={() => {
            setEditingSop(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SopRow({ sop, onEdit }: { sop: Sop; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpeningDoc, setIsOpeningDoc] = useState(false);

  async function openDocument() {
    if (!sop.document_path) return;
    setIsOpeningDoc(true);
    try {
      const url = await getSopDocumentSignedUrl(sop.document_path);
      if (url) window.open(url, "_blank", "noreferrer");
    } finally {
      setIsOpeningDoc(false);
    }
  }

  function remove() {
    startTransition(async () => {
      await deleteSop(sop.id);
      router.refresh();
    });
  }

  return (
    <Fragment>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer border-t border-border hover:bg-surface-raised"
      >
        <td className="px-4 py-3 font-medium">{sop.title}</td>
        <td className="px-4 py-3 text-muted">{sop.category || "—"}</td>
        <td className="px-4 py-3">
          {sop.document_path ? (
            <button
              type="button"
              disabled={isOpeningDoc}
              onClick={(e) => {
                e.stopPropagation();
                openDocument();
              }}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {isOpeningDoc ? "Opening…" : sop.document_filename || "View document"}
            </button>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {sop.video_link ? (
            <a
              href={sop.video_link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent hover:underline"
            >
              Watch video
            </a>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
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
      {isExpanded && (
        <tr className="border-t border-border">
          <td colSpan={5} className="bg-background p-4">
            <p className="whitespace-pre-wrap text-sm">{sop.description || "No description."}</p>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function SopFormModal({
  title,
  submitLabel,
  initial,
  hasExistingDocument,
  existingDocumentFilename,
  onRemoveDocument,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initial: SopFields;
  hasExistingDocument: boolean;
  existingDocumentFilename?: string | null;
  onRemoveDocument?: () => Promise<void>;
  onClose: () => void;
  onSubmit: (fields: SopFields, file: File | null) => Promise<void>;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<SopFields>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [documentRemoved, setDocumentRemoved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const textFieldClass =
    "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

  function submit() {
    startTransition(async () => {
      try {
        if (documentRemoved && onRemoveDocument) await onRemoveDocument();
        await onSubmit(fields, file);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that SOP.");
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
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Category (optional)</label>
          <input
            value={fields.category ?? ""}
            onChange={(e) => setFields({ ...fields, category: e.target.value })}
            disabled={isPending}
            placeholder="e.g. Chat Management, Onboarding, Content Creation"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Description (optional)</label>
          <textarea
            value={fields.description ?? ""}
            onChange={(e) => setFields({ ...fields, description: e.target.value })}
            disabled={isPending}
            rows={3}
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Video link (optional)</label>
          <input
            value={fields.video_link ?? ""}
            onChange={(e) => setFields({ ...fields, video_link: e.target.value })}
            disabled={isPending}
            placeholder="Link to a walkthrough video"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Document (optional)</label>
          {hasExistingDocument && !documentRemoved && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">{existingDocumentFilename || "Current document"}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDocumentRemoved(true)}
                className="text-xs text-danger hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={isPending}
            className="text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-foreground"
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
