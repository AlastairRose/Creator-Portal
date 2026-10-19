"use client";

import { useEffect, useState, useTransition } from "react";
import { FIELD_GROUPS, LIST_SECTIONS, SECTION_ORDER, fieldSectionKey } from "@/lib/onboarding/model-info-template";
import type { ModelInfoAnswers } from "@/lib/onboarding/state";

const inputClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";
const BOUNDARY_OPTIONS = ["", "Yes", "No", "Depends, ask me first"];

// The same questions as the Chatter Portal's Model Information page. Used
// in onboarding (with a draft kept on the device) and on My Info.
export default function ModelInfoForm({
  initial,
  draftKey,
  submitLabel,
  onSave,
}: {
  initial: ModelInfoAnswers;
  draftKey?: string;
  submitLabel: string;
  onSave: (answers: ModelInfoAnswers) => Promise<string | null>;
}) {
  const [answers, setAnswers] = useState<ModelInfoAnswers>(initial);
  const [loaded, setLoaded] = useState(!draftKey);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as ModelInfoAnswers;
        // Restoring a saved draft from this device once, on mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnswers({ fields: draft.fields ?? {}, lists: draft.lists ?? {} });
      }
    } catch {
      // ignore unreadable drafts
    }
    setLoaded(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !loaded) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      // private browsing; nothing to do
    }
  }, [answers, loaded, draftKey]);

  function setField(key: string, value: string) {
    setSaved(false);
    setAnswers((a) => ({ ...a, fields: { ...a.fields, [key]: value } }));
  }
  function setListItems(listKey: string, items: ModelInfoAnswers["lists"][string]) {
    setSaved(false);
    setAnswers((a) => ({ ...a, lists: { ...a.lists, [listKey]: items } }));
  }

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const err = await onSave(answers);
      if (err) {
        setError(err);
        return;
      }
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {SECTION_ORDER.map((sectionKey) => {
        const group = FIELD_GROUPS.find((g) => g.groupKey === sectionKey);
        if (group) {
          const isBoundaries = group.groupKey === "boundaries";
          return (
            <section key={sectionKey} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">{group.groupLabel}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.fields.map((field) => {
                  const key = fieldSectionKey(group.groupKey, field.key);
                  const value = answers.fields[key] ?? "";
                  // Keep any answer the chat team wrote in their own words.
                  const options = BOUNDARY_OPTIONS.includes(value) ? BOUNDARY_OPTIONS : [...BOUNDARY_OPTIONS, value];
                  return (
                    <label key={key} className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                      {field.label}
                      {isBoundaries ? (
                        <select value={value} onChange={(e) => setField(key, e.target.value)} className={inputClass}>
                          {options.map((o) => (
                            <option key={o} value={o}>
                              {o || "Choose…"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input value={value} onChange={(e) => setField(key, e.target.value)} className={inputClass} />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        }

        const list = LIST_SECTIONS.find((l) => l.listKey === sectionKey);
        if (!list) return null;
        const items = answers.lists[list.listKey]?.length ? answers.lists[list.listKey] : [{ title: "", content: "" }];
        return (
          <section key={sectionKey} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold">{list.groupLabel}</h3>
            {items.map((item, i) => (
              <div key={item.key ?? `new-${i}`} className="flex flex-col gap-2">
                {list.hasTitle && (
                  <input
                    value={item.title}
                    onChange={(e) => setListItems(list.listKey, items.map((it, j) => (j === i ? { ...it, title: e.target.value } : it)))}
                    placeholder={list.titlePlaceholder}
                    className={inputClass}
                  />
                )}
                <textarea
                  value={item.content}
                  onChange={(e) => setListItems(list.listKey, items.map((it, j) => (j === i ? { ...it, content: e.target.value } : it)))}
                  placeholder={list.contentPlaceholder}
                  rows={2}
                  className={inputClass}
                />
                {(item.content || item.title) && (
                  <button
                    type="button"
                    onClick={() => setListItems(list.listKey, items.filter((_, j) => j !== i))}
                    className="self-end text-xs text-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setListItems(list.listKey, [...items, { title: "", content: "" }])}
              className="self-start text-xs text-accent hover:underline"
            >
              + {list.addButtonLabel}
            </button>
          </section>
        );
      })}

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">✓ Saved.</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="sticky bottom-4 w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white shadow-lg hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
