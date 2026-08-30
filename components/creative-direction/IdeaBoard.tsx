"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  createIdea,
  deleteIdea,
  pushIdeaToWeek,
  updateIdea,
  type IdeaFields,
} from "@/lib/actions/ideas";
import { getNextWeekStart } from "@/lib/weeks";
import WeekPicker from "@/components/shared/WeekPicker";
import ReelFieldsForm from "@/components/shared/ReelFieldsForm";
import type { ReelDraftFields } from "@/lib/actions/creative-direction";
import type { Creator, Idea } from "@/lib/types";

function toReelDraftFields(fields: IdeaFields): ReelDraftFields {
  return {
    name: fields.name,
    idea: fields.idea,
    inspo_link: fields.inspo_link,
    required_shots: fields.required_shots,
    hook: fields.hook,
    outfit: fields.outfit,
    location: fields.location,
    filming_style: fields.filming_style,
    editing_notes: fields.editing_notes,
    posting_notes: fields.posting_notes,
    vertical: fields.vertical,
  };
}

const EMPTY_FIELDS: IdeaFields = {
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
  suitable_creator_ids: [],
};

export default function IdeaBoard({ ideas, creators }: { ideas: Idea[]; creators: Creator[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newFields, setNewFields] = useState<IdeaFields>(EMPTY_FIELDS);
  const [filterVertical, setFilterVertical] = useState("");
  const [filterCreatorId, setFilterCreatorId] = useState("");

  function handleAdd() {
    if (!newFields.name.trim()) return;
    startTransition(async () => {
      await createIdea(newFields);
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
        <SuitableCreatorsForm fields={newFields} onChange={setNewFields} creators={creators} disabled={isPending}>
          <button
            type="button"
            disabled={isPending || !newFields.name.trim()}
            onClick={handleAdd}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save idea
          </button>
        </SuitableCreatorsForm>
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
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Outfit</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Suitable creators</th>
                <th className="px-4 py-3 font-medium">Submitted by</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredIdeas.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} creators={creators} creatorNameById={creatorNameById} />
              ))}
              {filteredIdeas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
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
  idea: Idea;
  creators: Creator[];
  creatorNameById: Map<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [fields, setFields] = useState<IdeaFields>({
    name: idea.name,
    idea: idea.idea ?? "",
    inspo_link: idea.inspo_link,
    required_shots: idea.required_shots,
    hook: idea.hook,
    outfit: idea.outfit,
    location: idea.location,
    filming_style: idea.filming_style,
    editing_notes: idea.editing_notes,
    posting_notes: idea.posting_notes,
    vertical: idea.vertical,
    suitable_creator_ids: idea.suitable_creator_ids,
  });
  const [pushCreatorId, setPushCreatorId] = useState(idea.suitable_creator_ids[0] ?? creators[0]?.id ?? "");
  const [pushWeek, setPushWeek] = useState(getNextWeekStart());
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushed, setPushed] = useState(false);

  function save() {
    startTransition(async () => {
      await updateIdea(idea.id, fields);
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteIdea(idea.id);
      router.refresh();
    });
  }

  function confirmPush() {
    if (!pushCreatorId) return;
    startTransition(async () => {
      try {
        await pushIdeaToWeek(toReelDraftFields(fields), pushCreatorId, pushWeek);
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
        <td className="px-4 py-3 font-medium">{idea.name}</td>
        <td className="px-4 py-3 text-muted">{idea.vertical || "—"}</td>
        <td className="px-4 py-3 text-muted">{idea.outfit || "—"}</td>
        <td className="px-4 py-3 text-muted">{idea.location || "—"}</td>
        <td className="px-4 py-3 text-muted">
          {idea.suitable_creator_ids.length > 0
            ? idea.suitable_creator_ids.map((id) => creatorNameById.get(id) ?? "Unknown").join(", ")
            : "—"}
        </td>
        <td className="px-4 py-3 text-muted">
          {idea.submitted_by_creator_id ? creatorNameById.get(idea.submitted_by_creator_id) ?? "Unknown" : "—"}
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
          <td colSpan={7} className="bg-background p-4">
            {editing ? (
              <SuitableCreatorsForm fields={fields} onChange={setFields} creators={creators} disabled={isPending}>
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
              </SuitableCreatorsForm>
            ) : (
              <div className="flex flex-col gap-3">
                <ReelDetail idea={idea} />

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

function ReelDetail({ idea }: { idea: Idea }) {
  const rows: [string, string | null][] = [
    ["Idea", idea.idea],
    ["Inspo link", idea.inspo_link],
    ["Required shots", idea.required_shots],
    ["Hook", idea.hook],
    ["Filming style", idea.filming_style],
    ["Editing notes", idea.editing_notes],
    ["Posting notes", idea.posting_notes],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-muted">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">
            {label === "Inspo link" && value ? (
              <a href={value} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {value}
              </a>
            ) : (
              value || "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Wraps the shared reel-fields form with the "suitable creators" checkbox
// list and whatever footer the caller needs (save/add button).
function SuitableCreatorsForm({
  fields,
  onChange,
  creators,
  disabled,
  children,
}: {
  fields: IdeaFields;
  onChange: (fields: IdeaFields) => void;
  creators: Creator[];
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  function toggleCreator(id: string, checked: boolean) {
    onChange({
      ...fields,
      suitable_creator_ids: checked
        ? [...fields.suitable_creator_ids, id]
        : fields.suitable_creator_ids.filter((c) => c !== id),
    });
  }

  return (
    <ReelFieldsForm
      fields={fields}
      onChange={(next) => onChange({ ...fields, ...next })}
      disabled={disabled ?? false}
      footer={
        <div className="flex flex-col gap-4">
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
          {children}
        </div>
      }
    />
  );
}
