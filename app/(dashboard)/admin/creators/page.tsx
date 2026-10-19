import { requireStaff } from "@/lib/roles";
import { getCreators } from "@/lib/queries";
import NewCreatorForm from "@/components/admin/NewCreatorForm";
import { getCreatorNotificationStatuses, type CreatorNotificationStatus } from "@/lib/push";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOnboardingState, type OnboardingRow } from "@/lib/onboarding/state";

export default async function CreatorsPage() {
  await requireStaff();
  const [creators, notificationStatuses, onboardingRows, awaitingCountersign] = await Promise.all([
    getCreators(),
    getCreatorNotificationStatuses(),
    createAdminClient()
      .from("creator_onboarding")
      .select("*")
      .then(({ data }) => new Map(((data ?? []) as OnboardingRow[]).map((r) => [r.creator_id, r]))),
    createAdminClient()
      .from("creator_agreements")
      .select("creator_id")
      .is("countersigned_at", null)
      .then(({ data }) => new Set((data ?? []).map((r) => r.creator_id as string))),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Creators</h1>
        <p className="mt-1 text-sm text-muted">
          Add a new creator here or in Outlier Engine — both apps share the same roster.
        </p>
      </div>

      <NewCreatorForm />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">IG handle</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Phone notifications</th>
              <th className="px-4 py-3 font-medium">Onboarding</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => (
              <tr key={creator.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{creator.name}</td>
                <td className="px-4 py-3 text-muted">{creator.ig_handle || "—"}</td>
                <td className="px-4 py-3">
                  {creator.archived ? (
                    <span className="rounded-full bg-surface-raised px-2.5 py-1 text-xs text-muted">
                      Archived
                    </span>
                  ) : (
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <NotificationCell status={notificationStatuses ? notificationStatuses.get(creator.id) ?? null : undefined} />
                </td>
                <td className="px-4 py-3">
                  <OnboardingCell
                    creatorId={creator.id}
                    row={onboardingRows.get(creator.id) ?? null}
                    awaitingCountersign={awaitingCountersign.has(creator.id)}
                  />
                </td>
              </tr>
            ))}
            {creators.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No creators yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// undefined = couldn't check; null = creator has no portal login yet.
function NotificationCell({ status }: { status: CreatorNotificationStatus | null | undefined }) {
  if (status === undefined) return <span className="text-xs text-muted">—</span>;
  if (status === null || !status.hasLogin) return <span className="text-xs text-muted">No portal login</span>;
  if (status.devices.length === 0) {
    return <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs text-warning">Off</span>;
  }
  return (
    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">
      On · {status.devices.join(", ")}
    </span>
  );
}

function OnboardingCell({
  creatorId,
  row,
  awaitingCountersign,
}: {
  creatorId: string;
  row: OnboardingRow | null;
  awaitingCountersign: boolean;
}) {
  const state = computeOnboardingState(row);
  const label = state.exempt
    ? "Not required"
    : state.allDone
      ? "Complete"
      : !state.done.agreement
        ? "Not started"
        : `In progress (${Object.values(state.done).filter(Boolean).length}/5)`;
  const tone = state.exempt
    ? "bg-surface-raised text-muted"
    : state.allDone
      ? "bg-success/15 text-success"
      : "bg-warning/15 text-warning";
  return (
    <span className="flex flex-col items-start gap-1">
      <Link href={`/admin/creators/${creatorId}/onboarding`} className={`rounded-full px-2.5 py-1 text-xs hover:opacity-80 ${tone}`}>
        {label}
      </Link>
      {awaitingCountersign && (
        <Link href={`/admin/creators/${creatorId}/onboarding`} className="text-xs font-medium text-accent hover:underline">
          ✍️ Needs agency signature
        </Link>
      )}
    </span>
  );
}
