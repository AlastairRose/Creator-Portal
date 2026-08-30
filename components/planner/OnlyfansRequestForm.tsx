"use client";

import { ONLYFANS_CONTENT_TYPE_LABELS, CONTENT_REQUEST_URGENCY_LABELS } from "@/lib/types";
import type {
  ContentRequestUrgency,
  OnlyfansContentRequestWithItems,
  OnlyfansContentType,
} from "@/lib/types";
import type { OnlyfansRequestFields, OnlyfansSextingItemFields } from "@/lib/actions/onlyfans";

const CONTENT_TYPES: OnlyfansContentType[] = ["sexting", "ppv", "wall_posts", "voice_notes", "day_to_day", "other"];
const URGENCIES: ContentRequestUrgency[] = ["highly_requested", "complete_when_possible", "not_required"];
const SEXTING_CONTENT_LABELS = ["Picture", "Video", "Voice Note", "Message"] as const;

const textFieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

function emptyItem(): OnlyfansSextingItemFields {
  return { content_label: "", description: null, length: null, creator_required: false };
}

// Message is something staff handle directly, never a creator task; Picture/
// Video/Voice Note are things the creator produces. This is only ever a
// default applied when the dropdown changes — the tick box stays editable
// afterward so staff can still override it.
function defaultCreatorRequiredForLabel(label: string): boolean {
  return label !== "Message" && label !== "";
}

export function defaultOnlyfansRequestFields(existing?: OnlyfansContentRequestWithItems): OnlyfansRequestFields {
  if (!existing) {
    return {
      content_type: "other",
      description: "",
      length: null,
      urgency: "complete_when_possible",
      sexting_drive_link: null,
      sexting_items: [emptyItem()],
    };
  }
  return {
    content_type: existing.content_type,
    description: existing.description,
    length: existing.length,
    urgency: existing.urgency,
    sexting_drive_link: existing.sexting_drive_link,
    sexting_items:
      existing.onlyfans_sexting_items.length > 0
        ? existing.onlyfans_sexting_items.map((item) => ({
            content_label: item.content_label,
            description: item.description,
            length: item.length,
            creator_required: item.creator_required,
          }))
        : [emptyItem()],
  };
}

export default function OnlyfansRequestForm({
  fields,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  error,
  submitLabel,
}: {
  fields: OnlyfansRequestFields;
  onChange: (fields: OnlyfansRequestFields) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
  submitLabel: string;
}) {
  function set<K extends keyof OnlyfansRequestFields>(key: K, value: OnlyfansRequestFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  function setItem(index: number, patch: Partial<OnlyfansSextingItemFields>) {
    onChange({
      ...fields,
      sexting_items: fields.sexting_items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  function addItem() {
    onChange({ ...fields, sexting_items: [...fields.sexting_items, emptyItem()] });
  }

  function removeItem(index: number) {
    onChange({ ...fields, sexting_items: fields.sexting_items.filter((_, i) => i !== index) });
  }

  const isSexting = fields.content_type === "sexting";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Content type</label>
          <select
            value={fields.content_type}
            onChange={(e) => set("content_type", e.target.value as OnlyfansContentType)}
            disabled={isPending}
            className={textFieldClass}
          >
            {CONTENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ONLYFANS_CONTENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Urgency</label>
          <select
            value={fields.urgency}
            onChange={(e) => set("urgency", e.target.value as ContentRequestUrgency)}
            disabled={isPending}
            className={textFieldClass}
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {CONTENT_REQUEST_URGENCY_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isSexting ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Google Drive link for sexting uploads</label>
            <input
              value={fields.sexting_drive_link ?? ""}
              onChange={(e) => set("sexting_drive_link", e.target.value)}
              disabled={isPending}
              placeholder="Where the creator should upload this content"
              className={textFieldClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted">
              Required content — tick the rows the creator needs to complete; leave unticked for staff-only steps
            </label>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Required Content</th>
                    <th className="px-3 py-2 text-center font-medium">Creator</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Length</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.sexting_items.map((item, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="px-3 py-2">
                        <select
                          value={item.content_label}
                          onChange={(e) => {
                            const label = e.target.value;
                            setItem(index, { content_label: label, creator_required: defaultCreatorRequiredForLabel(label) });
                          }}
                          disabled={isPending}
                          className={textFieldClass}
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {SEXTING_CONTENT_LABELS.map((label) => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.creator_required}
                          onChange={(e) => setItem(index, { creator_required: e.target.checked })}
                          disabled={isPending}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={item.description ?? ""}
                          onChange={(e) => setItem(index, { description: e.target.value })}
                          disabled={isPending}
                          className={textFieldClass}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={item.length ?? ""}
                          onChange={(e) => setItem(index, { length: e.target.value })}
                          disabled={isPending}
                          className={textFieldClass}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={isPending || fields.sexting_items.length === 1}
                          onClick={() => removeItem(index)}
                          className="text-xs text-danger hover:underline disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={addItem}
              className="self-start text-xs text-accent hover:underline disabled:opacity-50"
            >
              + Add row
            </button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Description</label>
            <input
              value={fields.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              disabled={isPending}
              placeholder="What content is needed"
              className={textFieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Length</label>
            <input
              value={fields.length ?? ""}
              onChange={(e) => set("length", e.target.value)}
              disabled={isPending}
              placeholder="How long the content should be"
              className={textFieldClass}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onSubmit}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
