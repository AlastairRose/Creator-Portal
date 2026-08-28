"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  createRdIdea,
  deleteRdIdea,
  pushRdIdeaToWeek,
  updateRdIdea,
  type RdIdeaFields,
} from "@/lib/actions/rd-ideas";
import { getNextWeekStart } from "@/lib/weeks";
import WeekPicker from "@/components/shared/WeekPicker";
import type { Creator, RdIdea } from "@/lib/types";

const EMPTY_FIELDS: RdIdeaFields = {
  title: "",
  source_link: null,
  notes: null,
  vertical: null,
  suitable_creator_ids: [],
};

const textFieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

export default function RdIdeaBoard({ ideas, creators }: { ideas: RdIdea[]; creators: Creator[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newFields, setNewFields] = useState<RdIdeaFields>(EMPTY_FIELDS);
  const [filterVertical, setFilterVertical] = useState("");
  const [filterCreatorId, setFilterCreatorId] = useState("");

  function handleAdd() {
    if (!newFields.title.trim()) return;
    startTransition(async () => {
      await createRdIdea(newFields);
      setNewFields(EMPTY_FIELDS);
      router.refresh();
    });
  }

  const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));

  const verticals = useMemo(
    () =>
      Array.from(new Set(ideas.map((i) => i.vertical).filter((v): v is string => Boolean(v)))).sort(),
    [ideas]
  );

  const filteredIdeas = ideas.filter((idea) => {
    if (filterVertical && idea.vertical !== filterVertical) return false;
    if (filterCreatorId && !idea.suitable_creator_ids.includes(filterCreatorId)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Save a new idea</h2>
        <IdeaFieldsForm fields={newFields} onChange={setNewFields} creators={creators} disabled={isPending} />
        <button
          type="button"
          disabled={isPending || !newFields.title.trim()}
          onClick={handleAdd}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save idea
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Filter by vertical</label>
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
            <label className="text-xs font-medium text-muted">Filter by suitable creator</label>
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
          {(filterVertical || filterCreatorId) && (
            <button
              type="button"
              onClick={() => {
                setFilterVertical("");
                setFilterCreatorId("");
              }}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Suitable creators</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredIdeas.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} creators={creators} creatorNameById={creatorNameById} />
              ))}
              {filteredIdeas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    {ideas.length === 0 ? "No ideas saved yet." : "No ideas match those filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IdeaRow({
  idea,
  creators,
  creatorNameById,
}: {
  idea: RdIdea;
  creators: Creator[];
  creatorNameById: Map<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [fields, setFields] = useState<RdIdeaFields>({
    title: idea.title,
    source_link: idea.source_link,
    notes: idea.notes,
    vertical: idea.vertical,
    suitable_creator_ids: idea.suitable_creator_ids,
  });
  const [pushCreatorId, setPushCreatorId] = useState(idea.suitable_creator_ids[0] ?? creators[0]?.id ?? "");
  const [pushWeek, setPushWeek] = useState(getNextWeekStart());
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushed, setPushed] = useState(false);

  function save() {
    startTransition(async () => {
      await updateRdIdea(idea.id, fields);
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteRdIdea(idea.id);
      router.refresh();
    });
  }

  function confirmPush() {
    if (!pushCreatorId) return;
    startTransition(async () => {
      try {
        await pushRdIdeaToWeek(
          { title: idea.title, notes: idea.notes, source_link: idea.source_link, vertical: idea.vertical },
          pushCreatorId,
          pushWeek
        );
        setPushError(null);
        setPushed(true);
        setTimeout(() => setPushed(false), 2500);
        setPushing(false);
      } catch (err) {
        setPushError(err instanceof Error ? err.message : "Couldn't add that to the plan.");
      }
    });
  }

  return (
    <Fragment>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer border-t border-border hover:bg-surface-raised"
      >
        <td className="px-4 py-3 font-medium">{idea.title}</td>
        <td className="px-4 py-3 text-muted">{idea.vertical || "—"}</td>
        <td className="px-4 py-3 text-muted">
          {idea.suitable_creator_ids.length > 0
            ? idea.suitable_creator_ids.map((id) => creatorNameById.get(id) ?? "Unknown").join(", ")
            : "—"}
        </td>
        <td className="px-4 py-3">
          {idea.source_link ? (
            <a
              href={idea.source_link}
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
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-3 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(!editing);
                setExpanded(true);
              }}
              className="text-muted hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                remove();
              }}
              className="text-danger hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border">
          <td colSpan={5} className="bg-background p-4">
            {editing ? (
              <div className="flex flex-col gap-3">
                <IdeaFieldsForm fields={fields} onChange={setFields} creators={creators} disabled={isPending} />
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={save}
                    className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {idea.notes && <p className="text-sm text-muted">{idea.notes}</p>}

                {!pushing && !pushed && (
                  <button
                    type="button"
                    onClick={() => setPushing(true)}
                    className="self-start rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                  >
                    Add to a creator&apos;s plan
                  </button>
                )}
                {pushed && <p className="text-xs text-success">Added to the plan as a draft reel.</p>}

                {pushing && (
                  <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-raised p-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted">Creator</label>
                      <select
                        value={pushCreatorId}
                        onChange={(e) => setPushCreatorId(e.target.value)}
                        className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        {creators.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted">Week</label>
                      <WeekPicker weekStartDate={pushWeek} onChange={setPushWeek} />
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={confirmPush}
                      className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setPushing(false)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                    {pushError && <p className="w-full text-xs text-danger">{pushError}</p>}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function IdeaFieldsForm({
  fields,
  onChange,
  creators,
  disabled,
}: {
  fields: RdIdeaFields;
  onChange: (fields: RdIdeaFields) => void;
  creators: Creator[];
  disabled?: boolean;
}) {
  function set<K extends keyof RdIdeaFields>(key: K, value: RdIdeaFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  function toggleCreator(id: string, checked: boolean) {
    set(
      "suitable_creator_ids",
      checked
        ? [...fields.suitable_creator_ids, id]
        : fields.suitable_creator_ids.filter((c) => c !== id)
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Title</label>
        <input
          value={fields.title}
          onChange={(e) => set("title", e.target.value)}
          disabled={disabled}
          placeholder="Short label for this idea"
          className={textFieldClass}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Source link</label>
        <input
          value={fields.source_link ?? ""}
          onChange={(e) => set("source_link", e.target.value)}
          disabled={disabled}
          placeholder="Link to the reel/post"
          className={textFieldClass}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Notes</label>
        <textarea
          value={fields.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Why it's good, how to adapt it"
          className={textFieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Vertical</label>
        <input
          value={fields.vertical ?? ""}
          onChange={(e) => set("vertical", e.target.value)}
          disabled={disabled}
          placeholder="e.g. Skit, Snapchat, Fundamental, Talking Head etc."
          className={textFieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Suitable creators (select any number)</label>
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-2">
          {creators.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface">
              <input
                type="checkbox"
                checked={fields.suitable_creator_ids.includes(c.id)}
                disabled={disabled}
                onChange={(e) => toggleCreator(c.id, e.target.checked)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
