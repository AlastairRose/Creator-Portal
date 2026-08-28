"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createOnlyfansRequest,
  deleteOnlyfansRequest,
  markOnlyfansRequestComplete,
} from "@/lib/actions/onlyfans";
import { CONTENT_REQUEST_URGENCY_LABELS } from "@/lib/types";
import type { ContentRequestUrgency, OnlyfansContentRequest } from "@/lib/types";

const URGENCY_BADGE_CLASS: Record<ContentRequestUrgency, string> = {
  low: "bg-surface-raised text-muted",
  normal: "bg-accent/15 text-accent",
  high: "bg-warning/15 text-warning",
  urgent: "bg-danger/15 text-danger",
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
  const [urgency, setUrgency] = useState<ContentRequestUrgency>("normal");

  function handleAdd() {
    if (!description.trim()) return;
    startTransition(async () => {
      await createOnlyfansRequest(creatorId, description, urgency);
      setDescription("");
      setUrgency("normal");
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
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Logged</th>
              <th className="px-4 py-3 font-medium">Urgency</th>
              {isStaff && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {[...openRequests, ...completedRequests].map((request) => (
              <tr key={request.id} className="border-t border-border">
                <td
                  className={`px-4 py-3 ${request.status === "completed" ? "text-muted line-through" : ""}`}
                >
                  {request.description}
                </td>
                <td className="px-4 py-3 text-muted">{request.logged_at}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${URGENCY_BADGE_CLASS[request.urgency]}`}
                  >
                    {CONTENT_REQUEST_URGENCY_LABELS[request.urgency]}
                  </span>
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
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={isStaff ? 4 : 3} className="px-4 py-6 text-center text-muted">
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
