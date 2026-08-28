"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  deleteOutstandingCustom,
  markCustomUploaded,
  setCustomStatus,
  updateOutstandingCustom,
  type CustomFields,
} from "@/lib/actions/customs";
import { OUTSTANDING_CUSTOM_STATUS_LABELS } from "@/lib/types";
import type { OutstandingCustom, OutstandingCustomStatus } from "@/lib/types";
import DueStatusBadge from "./DueStatusBadge";
import CustomFieldsForm from "./CustomFieldsForm";
import ChatScreenshotThumbnail from "./ChatScreenshotThumbnail";

const STAFF_TABS: OutstandingCustomStatus[] = ["outstanding", "to_do_later", "uploaded", "sent"];

export default function OutstandingCustomsSection({
  customs,
  isStaff,
}: {
  customs: OutstandingCustom[];
  isStaff: boolean;
}) {
  if (!isStaff) {
    return <CreatorCustomsList customs={customs.filter((c) => c.status === "outstanding")} />;
  }
  return <StaffCustomsBoard customs={customs} />;
}

function CreatorCustomsList({ customs }: { customs: OutstandingCustom[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Outstanding Customs</h2>
      {customs.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          No outstanding customs.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {customs.map((custom) => (
            <div key={custom.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <ChatScreenshotThumbnail path={custom.chat_screenshot_path} />
                  <div>
                    <p className="text-sm">{custom.description}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted">
                      {custom.length_of_video_or_call && <div>Length: {custom.length_of_video_or_call}</div>}
                      {custom.outfit && <div>Outfit: {custom.outfit}</div>}
                      {custom.location && <div>Location: {custom.location}</div>}
                      {custom.due_by && <div>Due by: {custom.due_by}</div>}
                    </dl>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <DueStatusBadge custom={custom} />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await markCustomUploaded(custom.id);
                        router.refresh();
                      })
                    }
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Mark uploaded
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StaffCustomsBoard({ customs }: { customs: OutstandingCustom[] }) {
  const [tab, setTab] = useState<OutstandingCustomStatus>("outstanding");
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = customs.filter((c) => c.status === tab);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Outstanding Customs</h2>

      <div className="flex gap-1 border-b border-border">
        {STAFF_TABS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setTab(status)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === status
                ? "border-b-2 border-accent text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {OUTSTANDING_CUSTOM_STATUS_LABELS[status]} ({customs.filter((c) => c.status === status).length})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Sub name</th>
              <th className="px-4 py-3 font-medium">Price paid</th>
              <th className="px-4 py-3 font-medium">Due date</th>
              <th className="px-4 py-3 font-medium">Tag</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((custom) => {
              const isExpanded = expandedId === custom.id;
              return (
                <Fragment key={custom.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3 text-muted">
                      {new Date(custom.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : custom.id)}
                        className="text-left font-medium hover:text-accent"
                      >
                        {custom.sub_name ?? custom.sub_username ?? "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">{custom.custom_price_agreed ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{custom.due_by ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DueStatusBadge custom={custom} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusActions custom={custom} isPending={isPending} startTransition={startTransition} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-border">
                      <td colSpan={6} className="bg-background p-4">
                        <EditableCustom custom={custom} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusActions({
  custom,
  isPending,
  startTransition,
}: {
  custom: OutstandingCustom;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const router = useRouter();

  function move(status: OutstandingCustomStatus) {
    startTransition(async () => {
      await setCustomStatus(custom.id, status);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteOutstandingCustom(custom.id);
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-3">
      {custom.status === "outstanding" && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => move("to_do_later")}
            className="text-xs text-muted hover:text-foreground disabled:opacity-50"
          >
            Move to To do later
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => move("uploaded")}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            Mark uploaded
          </button>
        </>
      )}
      {custom.status === "to_do_later" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => move("outstanding")}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          Move to Outstanding
        </button>
      )}
      {custom.status === "uploaded" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => move("sent")}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          Mark sent
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="text-xs text-danger hover:underline disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}

function EditableCustom({ custom }: { custom: OutstandingCustom }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<CustomFields>({
    sub_username: custom.sub_username,
    sub_name: custom.sub_name,
    length_of_video_or_call: custom.length_of_video_or_call,
    custom_or_call: custom.custom_or_call,
    outfit: custom.outfit,
    location: custom.location,
    description: custom.description,
    chat_link: custom.chat_link,
    custom_price_agreed: custom.custom_price_agreed,
    snapchat_handle: custom.snapchat_handle,
    due_by: custom.due_by,
  });

  function save(screenshotFile?: File | null) {
    startTransition(async () => {
      await updateOutstandingCustom(custom.id, fields, screenshotFile);
      router.refresh();
    });
  }

  return (
    <CustomFieldsForm
      fields={fields}
      onChange={setFields}
      onBlurField={() => save()}
      disabled={isPending}
      currentScreenshotPath={custom.chat_screenshot_path}
      onScreenshotFileChange={(file) => save(file)}
    />
  );
}
