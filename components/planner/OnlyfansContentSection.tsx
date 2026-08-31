"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  createOnlyfansRequest,
  deleteOnlyfansRequest,
  markOnlyfansRequestComplete,
  updateOnlyfansRequest,
  updateOnlyfansRequestUrgency,
  type OnlyfansRequestFields,
} from "@/lib/actions/onlyfans";
import { updateOnlyfansDriveLink } from "@/lib/actions/creator-drive-links";
import { saveOnlyfansRequestToOfcd } from "@/lib/actions/ofcd-ideas";
import {
  CONTENT_REQUEST_URGENCY_LABELS,
  ONLYFANS_CONTENT_TYPE_LABELS,
  ONLYFANS_DUE_TAG_LABELS,
} from "@/lib/types";
import { computeOnlyfansDueTag } from "@/lib/onlyfans";
import type { ContentRequestUrgency, OnlyfansContentRequestWithItems, OnlyfansDueTag } from "@/lib/types";
import Modal from "@/components/shared/Modal";
import CreatorDriveLinkField from "@/components/shared/CreatorDriveLinkField";
import OnlyfansRequestForm, { defaultOnlyfansRequestFields } from "./OnlyfansRequestForm";

const DUE_TAG_BADGE_CLASS: Record<OnlyfansDueTag, string> = {
  due_in_2_weeks: "bg-success/15 text-success",
  due_this_week: "bg-orange/15 text-orange",
  due_in_3_days: "bg-orange/15 text-orange",
  due_today: "bg-danger/15 text-danger",
  overdue: "bg-danger/15 text-danger",
};

// Highly requested always floats to the top regardless of anything else;
// within the same urgency, the oldest request (the one waiting longest)
// comes first.
const URGENCY_SORT_ORDER: Record<ContentRequestUrgency, number> = {
  highly_requested: 0,
  complete_when_possible: 1,
  not_required: 2,
};

function compareRequests(a: OnlyfansContentRequestWithItems, b: OnlyfansContentRequestWithItems) {
  const urgencyDiff = URGENCY_SORT_ORDER[a.urgency] - URGENCY_SORT_ORDER[b.urgency];
  if (urgencyDiff !== 0) return urgencyDiff;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function OnlyfansContentSection({
  creatorId,
  requests,
  driveLink,
  isStaff,
}: {
  creatorId: string;
  requests: OnlyfansContentRequestWithItems[];
  driveLink: string | null;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<OnlyfansContentRequestWithItems | null>(null);

  // Completed requests are dropped entirely once marked complete, not just
  // styled differently — the list is meant to only ever show what's still
  // outstanding.
  const openRequests = [...requests].filter((r) => r.status === "open").sort(compareRequests);
  const columnCount = isStaff ? 7 : 6;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-sm font-semibold">Onlyfans Content</h2>
        <CreatorDriveLinkField
          label="Google Drive upload link"
          buttonLabel="Upload OF Content Here"
          initialLink={driveLink}
          isStaff={isStaff}
          onSave={(value) => updateOnlyfansDriveLink(creatorId, value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Content Required</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Length</th>
              <th className="px-4 py-3 font-medium">Logged</th>
              <th className="px-4 py-3 font-medium">Urgency</th>
              <th className="px-4 py-3 font-medium">Due</th>
              {isStaff && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {openRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                isStaff={isStaff}
                onEdit={() => setEditingRequest(request)}
              />
            ))}
            {openRequests.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-muted">
                  Nothing logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isStaff && (
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + Add content request
        </button>
      )}

      {isAddOpen && (
        <AddRequestModal
          creatorId={creatorId}
          onClose={() => setIsAddOpen(false)}
          onSaved={() => {
            setIsAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {editingRequest && (
        <EditRequestModal
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSaved={() => {
            setEditingRequest(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function AddRequestModal({
  creatorId,
  onClose,
  onSaved,
}: {
  creatorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<OnlyfansRequestFields>(defaultOnlyfansRequestFields());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      try {
        await createOnlyfansRequest(creatorId, fields);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that request.");
      }
    });
  }

  return (
    <Modal title="Add content request" onClose={onClose}>
      <OnlyfansRequestForm
        fields={fields}
        onChange={setFields}
        onSubmit={submit}
        onCancel={onClose}
        isPending={isPending}
        error={error}
        submitLabel="Add"
      />
    </Modal>
  );
}

function EditRequestModal({
  request,
  onClose,
  onSaved,
}: {
  request: OnlyfansContentRequestWithItems;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<OnlyfansRequestFields>(defaultOnlyfansRequestFields(request));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      try {
        await updateOnlyfansRequest(request.id, fields);
        setError(null);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that change.");
      }
    });
  }

  return (
    <Modal title="Edit content request" onClose={onClose}>
      <OnlyfansRequestForm
        fields={fields}
        onChange={setFields}
        onSubmit={submit}
        onCancel={onClose}
        isPending={isPending}
        error={error}
        submitLabel="Save"
      />
    </Modal>
  );
}

function requestToFields(request: OnlyfansContentRequestWithItems): OnlyfansRequestFields {
  return {
    content_type: request.content_type,
    description: request.description,
    length: request.length,
    urgency: request.urgency,
    sexting_drive_link: request.sexting_drive_link,
    sexting_storyline: request.sexting_storyline,
    sexting_items: request.onlyfans_sexting_items.map((item) => ({
      content_label: item.content_label,
      description: item.description,
      length: item.length,
      creator_required: item.creator_required,
    })),
  };
}

function RequestRow({
  request,
  isStaff,
  onEdit,
}: {
  request: OnlyfansContentRequestWithItems;
  isStaff: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [savedToIdeas, setSavedToIdeas] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dueTag = computeOnlyfansDueTag(request);
  const isSexting = request.content_type === "sexting";
  const isCompleted = request.status === "completed";

  function changeUrgency(urgency: ContentRequestUrgency) {
    startTransition(async () => {
      await updateOnlyfansRequestUrgency(request.id, urgency);
      router.refresh();
    });
  }

  function saveToIdeas() {
    startTransition(async () => {
      try {
        const title = request.description?.trim() || `${ONLYFANS_CONTENT_TYPE_LABELS[request.content_type]} idea`;
        await saveOnlyfansRequestToOfcd(title, requestToFields(request));
        setSaveError(null);
        setSavedToIdeas(true);
        setTimeout(() => setSavedToIdeas(false), 2500);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Couldn't save that.");
      }
    });
  }

  return (
    <Fragment>
      <tr className={`border-t border-border ${isSexting ? "cursor-pointer" : ""}`}>
        <td className="px-4 py-3 text-muted">
          <div className="flex flex-col items-start gap-1">
            <span onClick={() => isSexting && setIsExpanded((v) => !v)}>
              {ONLYFANS_CONTENT_TYPE_LABELS[request.content_type]}
            </span>
            <button
              type="button"
              onClick={() => setShowMobileDetail(true)}
              className="text-xs text-accent hover:underline sm:hidden"
            >
              More info
            </button>
          </div>
        </td>
        <td
          className={`hidden px-4 py-3 sm:table-cell ${isCompleted ? "text-muted line-through" : ""}`}
          onClick={() => isSexting && setIsExpanded((v) => !v)}
        >
          {isSexting ? (
            <span className="text-accent">
              {isExpanded ? "Hide" : "Show"} checklist ({request.onlyfans_sexting_items.length} item
              {request.onlyfans_sexting_items.length === 1 ? "" : "s"})
            </span>
          ) : (
            request.description
          )}
        </td>
        <td className="hidden px-4 py-3 text-muted sm:table-cell">{isSexting ? "—" : request.length ?? "—"}</td>
        <td className="px-4 py-3 text-muted">{new Date(request.created_at).toLocaleDateString()}</td>
        <td className="px-4 py-3">
          {isStaff && request.status === "open" ? (
            <select
              value={request.urgency}
              disabled={isPending}
              onChange={(e) => changeUrgency(e.target.value as ContentRequestUrgency)}
              className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-70"
            >
              {(Object.keys(CONTENT_REQUEST_URGENCY_LABELS) as ContentRequestUrgency[]).map((u) => (
                <option key={u} value={u}>
                  {CONTENT_REQUEST_URGENCY_LABELS[u]}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-muted">{CONTENT_REQUEST_URGENCY_LABELS[request.urgency]}</span>
          )}
        </td>
        <td className="px-4 py-3">
          {dueTag ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DUE_TAG_BADGE_CLASS[dueTag]}`}>
              {ONLYFANS_DUE_TAG_LABELS[dueTag]}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        {isStaff && (
          <td className="px-4 py-3 text-right">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {savedToIdeas && <span className="text-xs text-success">Saved!</span>}
              {saveError && <span className="text-xs text-danger">{saveError}</span>}
              <button
                type="button"
                disabled={isPending}
                onClick={saveToIdeas}
                className="text-xs text-muted hover:text-foreground disabled:opacity-50"
              >
                Add to OFCD
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={onEdit}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                Edit
              </button>
              {request.status === "open" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await markOnlyfansRequestComplete(request.id);
                      router.refresh();
                    })
                  }
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Complete
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteOnlyfansRequest(request.id);
                    router.refresh();
                  })
                }
                className="text-xs text-danger hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </td>
        )}
      </tr>
      {isSexting && isExpanded && (
        <tr className="hidden border-t border-border sm:table-row">
          <td colSpan={isStaff ? 7 : 6} className="bg-background p-4">
            <RequestDetailContent request={request} isStaff={isStaff} />
          </td>
        </tr>
      )}
      {showMobileDetail && (
        <Modal title={ONLYFANS_CONTENT_TYPE_LABELS[request.content_type]} onClose={() => setShowMobileDetail(false)}>
          <RequestDetailContent request={request} isStaff={isStaff} />
        </Modal>
      )}
    </Fragment>
  );
}

function RequestDetailContent({
  request,
  isStaff,
}: {
  request: OnlyfansContentRequestWithItems;
  isStaff: boolean;
}) {
  if (request.content_type !== "sexting") {
    return (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted">Description</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">{request.description || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Length</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">{request.length || "—"}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {request.sexting_storyline && <p className="whitespace-pre-wrap text-sm">{request.sexting_storyline}</p>}
      {request.sexting_drive_link && (
        <p className="text-xs text-muted">
          Upload to:{" "}
          <a href={request.sexting_drive_link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {request.sexting_drive_link}
          </a>
        </p>
      )}
      {request.onlyfans_sexting_items.length === 0 ? (
        <p className="text-xs text-muted">Nothing required from you here.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Required Content</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Length</th>
                {isStaff && <th className="px-3 py-2 font-medium">Visible to creator</th>}
              </tr>
            </thead>
            <tbody>
              {request.onlyfans_sexting_items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{item.content_label}</td>
                  <td className="px-3 py-2 text-muted">{item.description ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{item.length ?? "—"}</td>
                  {isStaff && <td className="px-3 py-2 text-muted">{item.creator_required ? "Yes" : "Staff only"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
