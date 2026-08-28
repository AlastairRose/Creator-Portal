"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createOnlyfansRequest,
  deleteOnlyfansRequest,
  markOnlyfansRequestComplete,
  updateOnlyfansRequest,
} from "@/lib/actions/onlyfans";
import { CONTENT_REQUEST_URGENCY_LABELS, ONLYFANS_DUE_TAG_LABELS } from "@/lib/types";
import { computeOnlyfansDueTag } from "@/lib/onlyfans";
import type { ContentRequestUrgency, OnlyfansContentRequest, OnlyfansDueTag } from "@/lib/types";

const DUE_TAG_BADGE_CLASS: Record<OnlyfansDueTag, string> = {
  due_in_2_weeks: "bg-success/15 text-success",
  due_this_week: "bg-orange/15 text-orange",
  due_in_3_days: "bg-orange/15 text-orange",
  due_today: "bg-danger/15 text-danger",
  overdue: "bg-danger/15 text-danger",
};

export default function OnlyfansContentSection({
  creatorId,
  requests,
  isStaff,
}: {
  creatorId: string;
  requests: OnlyfansContentRequest[];
  isStaff: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<ContentRequestUrgency>("complete_when_possible");

  function handleAdd() {
    if (!description.trim()) return;
    startTransition(async () => {
      await createOnlyfansRequest(creatorId, description, urgency);
      setDescription("");
      setUrgency("complete_when_possible");
      router.refresh();
    });
  }

  const openRequests = requests.filter((r) => r.status === "open");
  const completedRequests = requests.filter((r) => r.status === "completed");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Onlyfans Content</h2>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Content Required</th>
              <th className="px-4 py-3 font-medium">Logged</th>
              <th className="px-4 py-3 font-medium">Urgency</th>
              <th className="px-4 py-3 font-medium">Due</th>
              {isStaff && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {[...openRequests, ...completedRequests].map((request) => (
              <RequestRow key={request.id} request={request} isStaff={isStaff} />
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={isStaff ? 5 : 4} className="px-4 py-6 text-center text-muted">
                  Nothing logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isStaff && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What content is needed"
            className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as ContentRequestUrgency)}
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(CONTENT_REQUEST_URGENCY_LABELS) as ContentRequestUrgency[]).map((u) => (
              <option key={u} value={u}>
                {CONTENT_REQUEST_URGENCY_LABELS[u]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !description.trim()}
            onClick={handleAdd}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </section>
  );
}

function RequestRow({ request, isStaff }: { request: OnlyfansContentRequest; isStaff: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dueTag = computeOnlyfansDueTag(request);

  function changeUrgency(urgency: ContentRequestUrgency) {
    startTransition(async () => {
      await updateOnlyfansRequest(request.id, { description: request.description, urgency });
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-border">
      <td className={`px-4 py-3 ${request.status === "completed" ? "text-muted line-through" : ""}`}>
        {request.description}
      </td>
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
          <div className="flex justify-end gap-3">
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
  );
}
