"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  createCulturalEvent,
  deleteCulturalEvent,
  searchForNewEventsAction,
  setCulturalEventStatus,
  updateCulturalEvent,
  type CulturalEventFields,
} from "@/lib/actions/cultural-events";
import { CULTURAL_EVENT_REGIONS } from "@/lib/types";
import type { CulturalEvent, CulturalEventStatus } from "@/lib/types";
import Modal from "@/components/shared/Modal";

const TABS: CulturalEventStatus[] = ["confirmed", "suggested", "dismissed"];
const TAB_LABELS: Record<CulturalEventStatus, string> = {
  confirmed: "Confirmed",
  suggested: "Suggested",
  dismissed: "Dismissed",
};

function emptyFields(): CulturalEventFields {
  return { title: "", event_date: "", event_end_date: null, category: null, regions: [], description: null };
}

function fieldsFromEvent(event: CulturalEvent): CulturalEventFields {
  return {
    title: event.title,
    event_date: event.event_date,
    event_end_date: event.event_end_date,
    category: event.category,
    regions: event.regions,
    description: event.description,
  };
}

function formatDate(event: CulturalEvent) {
  if (event.event_end_date && event.event_end_date !== event.event_date) {
    return `${event.event_date} – ${event.event_end_date}`;
  }
  return event.event_date;
}

export default function AntEnaBoard({ events }: { events: CulturalEvent[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<CulturalEventStatus>("confirmed");
  const [isSearching, startSearch] = useTransition();
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CulturalEvent | null>(null);

  const visible = events.filter((e) => e.status === tab);

  function runSearch() {
    startSearch(async () => {
      try {
        const count = await searchForNewEventsAction();
        setSearchError(null);
        setSearchResult(
          count === 0 ? "No new events found." : `Found ${count} new event${count === 1 ? "" : "s"} to review.`
        );
        router.refresh();
      } catch (err) {
        setSearchResult(null);
        setSearchError(err instanceof Error ? err.message : "Search failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isSearching}
          onClick={runSearch}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSearching ? "Searching…" : "Search now"}
        </button>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised"
        >
          + Add event
        </button>
        {searchResult && <span className="text-xs text-success">{searchResult}</span>}
        {searchError && <span className="text-xs text-danger">{searchError}</span>}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setTab(status)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === status ? "border-b-2 border-accent text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {TAB_LABELS[status]} ({events.filter((e) => e.status === status).length})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Regions</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((event) => (
              <EventRow key={event.id} event={event} onEdit={() => setEditingEvent(event)} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  {tab === "confirmed" ? "Nothing confirmed yet." : `Nothing ${tab}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddOpen && (
        <EventFormModal
          title="Add event"
          submitLabel="Add"
          initial={emptyFields()}
          onClose={() => setIsAddOpen(false)}
          onSubmit={createCulturalEvent}
          onSaved={() => {
            setIsAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingEvent && (
        <EventFormModal
          title="Edit event"
          submitLabel="Save"
          initial={fieldsFromEvent(editingEvent)}
          onClose={() => setEditingEvent(null)}
          onSubmit={(fields) => updateCulturalEvent(editingEvent.id, fields)}
          onSaved={() => {
            setEditingEvent(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EventRow({ event, onEdit }: { event: CulturalEvent; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);

  function setStatus(status: CulturalEventStatus) {
    startTransition(async () => {
      await setCulturalEventStatus(event.id, status);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteCulturalEvent(event.id);
      router.refresh();
    });
  }

  return (
    <Fragment>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer border-t border-border hover:bg-surface-raised"
      >
        <td className="px-4 py-3 text-muted">{formatDate(event)}</td>
        <td className="px-4 py-3 font-medium">
          {event.title}
          {event.source === "ai_suggested" && (
            <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
              AI
            </span>
          )}
        </td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">{event.category || "—"}</td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">
          {event.regions.length > 0 ? event.regions.join(", ") : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
            {event.status === "suggested" && (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("confirmed")}
                  className="text-accent hover:underline disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("dismissed")}
                  className="text-muted hover:text-foreground disabled:opacity-50"
                >
                  Dismiss
                </button>
              </>
            )}
            {event.status === "confirmed" && (
              <>
                <button type="button" onClick={onEdit} className="text-accent hover:underline">
                  Edit
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("dismissed")}
                  className="text-muted hover:text-foreground disabled:opacity-50"
                >
                  Dismiss
                </button>
              </>
            )}
            {event.status === "dismissed" && (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus("confirmed")}
                  className="text-accent hover:underline disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={remove}
                  className="text-danger hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-t border-border">
          <td colSpan={5} className="bg-background p-4">
            <p className="text-sm whitespace-pre-wrap">{event.description || "No description."}</p>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function EventFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  submitLabel: string;
  initial: CulturalEventFields;
  onClose: () => void;
  onSubmit: (fields: CulturalEventFields) => Promise<void>;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<CulturalEventFields>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const textFieldClass =
    "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

  function toggleRegion(region: string, checked: boolean) {
    setFields({
      ...fields,
      regions: checked ? [...fields.regions, region] : fields.regions.filter((r) => r !== region),
    });
  }

  function submit() {
    startTransition(async () => {
      try {
        await onSubmit(fields);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that event.");
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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Date</label>
            <input
              type="date"
              value={fields.event_date}
              onChange={(e) => setFields({ ...fields, event_date: e.target.value })}
              disabled={isPending}
              className={textFieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">End date (optional)</label>
            <input
              type="date"
              value={fields.event_end_date ?? ""}
              onChange={(e) => setFields({ ...fields, event_end_date: e.target.value || null })}
              disabled={isPending}
              className={textFieldClass}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Category</label>
          <input
            value={fields.category ?? ""}
            onChange={(e) => setFields({ ...fields, category: e.target.value })}
            disabled={isPending}
            placeholder="e.g. Sport, Music, Gaming, Awards show, Holiday"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Regions</label>
          <div className="flex flex-wrap gap-3 rounded-md border border-border bg-surface-raised p-2">
            {CULTURAL_EVENT_REGIONS.map((region) => (
              <label key={region} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={fields.regions.includes(region)}
                  disabled={isPending}
                  onChange={(e) => toggleRegion(region, e.target.checked)}
                />
                {region}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Description</label>
          <textarea
            value={fields.description ?? ""}
            onChange={(e) => setFields({ ...fields, description: e.target.value })}
            disabled={isPending}
            rows={3}
            placeholder="Why this is culturally relevant, or what angles it might suit"
            className={textFieldClass}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending || !fields.title.trim() || !fields.event_date}
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
