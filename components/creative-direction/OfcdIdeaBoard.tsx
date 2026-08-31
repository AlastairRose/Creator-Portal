"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  createOfcdIdea,
  deleteOfcdIdea,
  pushOfcdIdeaToCreator,
  updateOfcdIdea,
  type OfcdIdeaFields,
} from "@/lib/actions/ofcd-ideas";
import { ONLYFANS_CONTENT_TYPE_LABELS } from "@/lib/types";
import type { Creator, OfcdIdeaWithItems } from "@/lib/types";
import type { OnlyfansRequestFields } from "@/lib/actions/onlyfans";
import Modal from "@/components/shared/Modal";
import OnlyfansRequestForm from "@/components/planner/OnlyfansRequestForm";

function emptyItem() {
  return { content_label: "", description: null, length: null, creator_required: false };
}

function emptyFields(): OfcdIdeaFields {
  return {
    title: "",
    content_type: "other",
    description: "",
    length: null,
    urgency: "complete_when_possible",
    sexting_drive_link: null,
    sexting_storyline: null,
    sexting_items: [emptyItem()],
  };
}

function fieldsFromIdea(idea: OfcdIdeaWithItems): OfcdIdeaFields {
  return {
    title: idea.title,
    content_type: idea.content_type,
    description: idea.description,
    length: idea.length,
    urgency: "complete_when_possible",
    sexting_drive_link: idea.sexting_drive_link,
    sexting_storyline: idea.sexting_storyline,
    sexting_items:
      idea.ofcd_idea_sexting_items.length > 0
        ? idea.ofcd_idea_sexting_items.map((item) => ({
            content_label: item.content_label,
            description: item.description,
            length: item.length,
            creator_required: item.creator_required,
          }))
        : [emptyItem()],
  };
}

export default function OfcdIdeaBoard({ ideas, creators }: { ideas: OfcdIdeaWithItems[]; creators: Creator[] }) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<OfcdIdeaWithItems | null>(null);
  const [pushingIdea, setPushingIdea] = useState<OfcdIdeaWithItems | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        + Add idea
      </button>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                onEdit={() => setEditingIdea(idea)}
                onPush={() => setPushingIdea(idea)}
              />
            ))}
            {ideas.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  No ideas saved yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddOpen && (
        <IdeaFormModal
          title="Add idea"
          submitLabel="Save idea"
          initial={emptyFields()}
          onClose={() => setIsAddOpen(false)}
          onSubmit={async (fields) => createOfcdIdea(fields)}
          onSaved={() => {
            setIsAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingIdea && (
        <IdeaFormModal
          title="Edit idea"
          submitLabel="Save"
          initial={fieldsFromIdea(editingIdea)}
          onClose={() => setEditingIdea(null)}
          onSubmit={async (fields) => updateOfcdIdea(editingIdea.id, fields)}
          onSaved={() => {
            setEditingIdea(null);
            router.refresh();
          }}
        />
      )}

      {pushingIdea && (
        <PushToCreatorModal
          idea={pushingIdea}
          creators={creators}
          onClose={() => setPushingIdea(null)}
          onSaved={() => {
            setPushingIdea(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function IdeaFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initial: OfcdIdeaFields;
  onClose: () => void;
  onSubmit: (fields: OfcdIdeaFields) => Promise<void>;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<OfcdIdeaFields>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      try {
        await onSubmit(fields);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that idea.");
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
            placeholder="A short label to find this idea again later"
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
          />
        </div>
        <OnlyfansRequestForm
          fields={fields}
          onChange={(next: OnlyfansRequestFields) => setFields({ ...fields, ...next })}
          onSubmit={submit}
          onCancel={onClose}
          isPending={isPending}
          error={error}
          submitLabel={submitLabel}
        />
      </div>
    </Modal>
  );
}

function PushToCreatorModal({
  idea,
  creators,
  onClose,
  onSaved,
}: {
  idea: OfcdIdeaWithItems;
  creators: Creator[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? "");
  const [fields, setFields] = useState<OnlyfansRequestFields>(fieldsFromIdea(idea));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!creatorId) return;
    startTransition(async () => {
      try {
        await pushOfcdIdeaToCreator(creatorId, fields);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that to the plan.");
      }
    });
  }

  return (
    <Modal title={`Add "${idea.title}" to a creator's plan`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Creator</label>
          <select
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <OnlyfansRequestForm
          fields={fields}
          onChange={setFields}
          onSubmit={submit}
          onCancel={onClose}
          isPending={isPending}
          error={error}
          submitLabel="Add to plan"
        />
      </div>
    </Modal>
  );
}

function IdeaRow({
  idea,
  onEdit,
  onPush,
}: {
  idea: OfcdIdeaWithItems;
  onEdit: () => void;
  onPush: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const isSexting = idea.content_type === "sexting";

  function remove() {
    startTransition(async () => {
      await deleteOfcdIdea(idea.id);
      router.refresh();
    });
  }

  return (
    <Fragment>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer border-t border-border hover:bg-surface-raised"
      >
        <td className="px-4 py-3 font-medium">{idea.title}</td>
        <td className="px-4 py-3 text-muted">{ONLYFANS_CONTENT_TYPE_LABELS[idea.content_type]}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onPush} className="text-accent hover:underline">
              Add to creator plan
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
      {isExpanded && (
        <tr className="border-t border-border">
          <td colSpan={3} className="bg-background p-4">
            {isSexting ? (
              <div className="flex flex-col gap-3">
                {idea.sexting_storyline && (
                  <p className="whitespace-pre-wrap text-sm">{idea.sexting_storyline}</p>
                )}
                {idea.sexting_drive_link && (
                  <p className="text-xs text-muted">
                    Upload to:{" "}
                    <a
                      href={idea.sexting_drive_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {idea.sexting_drive_link}
                    </a>
                  </p>
                )}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="px-3 py-2 font-medium">Required Content</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Length</th>
                        <th className="px-3 py-2 font-medium">Visible to creator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {idea.ofcd_idea_sexting_items.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{item.content_label}</td>
                          <td className="px-3 py-2 text-muted">{item.description ?? "—"}</td>
                          <td className="px-3 py-2 text-muted">{item.length ?? "—"}</td>
                          <td className="px-3 py-2 text-muted">{item.creator_required ? "Yes" : "Staff only"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-muted">Description</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{idea.description || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Length</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{idea.length || "—"}</dd>
                </div>
              </dl>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
