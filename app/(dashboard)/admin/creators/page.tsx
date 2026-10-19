import { requireStaff } from "@/lib/roles";
import { getCreators } from "@/lib/queries";
import NewCreatorForm from "@/components/admin/NewCreatorForm";
import { getCreatorNotificationStatuses, type CreatorNotificationStatus } from "@/lib/push";

export default async function CreatorsPage() {
  await requireStaff();
  const [creators, notificationStatuses] = await Promise.all([getCreators(), getCreatorNotificationStatuses()]);

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
              </tr>
            ))}
            {creators.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
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
