"use client";

import { useEffect, useState, useTransition } from "react";
import { FIELD_GROUPS, LIST_SECTIONS, SECTION_ORDER, fieldSectionKey } from "@/lib/onboarding/model-info-template";
import type { ModelInfoAnswers } from "@/lib/onboarding/state";
import { saveModelInfo } from "@/lib/actions/onboarding";

const inputClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";
const BOUNDARY_OPTIONS = ["", "Yes", "No", "Depends, ask me first"];
const EMPTY: ModelInfoAnswers = { fields: {}, lists: {} };

function draftKey(creatorId: string) {
  return `creator-portal:onboarding-model-info:${creatorId}`;
}

// The same questions as the Chatter Portal's Model Information page, so the
// answers drop straight in there. Progress is kept on this device as they
// type, so a long form isn't lost if they close the page.
export default function ModelInfoStep({ creatorId, onDone }: { creatorId: string; onDone: () => void }) {
  const [answers, setAnswers] = useState<ModelInfoAnswers>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let draft: ModelInfoAnswers = EMPTY;
    try {
      const raw = localStorage.getItem(draftKey(creatorId));
      if (raw) draft = JSON.parse(raw) as ModelInfoAnswers;
    } catch {
      // ignore unreadable drafts
    }
    // Restoring a saved draft from this device once, on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers({ fields: draft.fields ?? {}, lists: draft.lists ?? {} });
    setLoaded(true);
  }, [creatorId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(draftKey(creatorId), JSON.stringify(answers));
    } catch {
      // private browsing; nothing to do
    }
  }, [answers, loaded, creatorId]);

  function setField(key: string, value: string) {
    setAnswers((a) => ({ ...a, fields: { ...a.fields, [key]: value } }));
  }
  function setListItems(listKey: string, items: { title: string; content: string }[]) {
    setAnswers((a) => ({ ...a, lists: { ...a.lists, [listKey]: items } }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const { error } = await saveModelInfo(answers);
      if (error) {
        setError(error);
        return;
      }
      try {
        localStorage.removeItem(draftKey(creatorId));
      } catch {
        // ignore
      }
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        This helps our chat team talk to your fans exactly like you would. If you have a persona, answer as that persona.
        Skip anything you&apos;d rather not answer. Your answers are saved on this device as you go.
      </p>

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
                  return (
                    <label key={key} className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                      {field.label}
                      {isBoundaries ? (
                        <select
                          value={answers.fields[key] ?? ""}
                          onChange={(e) => setField(key, e.target.value)}
                          className={inputClass}
                        >
                          {BOUNDARY_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o || "Choose…"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={answers.fields[key] ?? ""}
                          onChange={(e) => setField(key, e.target.value)}
                          className={inputClass}
                        />
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
              <div key={i} className="flex flex-col gap-2">
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
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save and continue"}
      </button>
    </div>
  );
}
