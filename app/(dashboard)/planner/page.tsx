import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators } from "@/lib/queries";

export default async function PlannerIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profile.role === "creator") {
    if (!profile.creator_id) {
      return <p className="text-sm text-muted">No creator profile is linked to your account yet.</p>;
    }
    redirect(`/planner/${profile.creator_id}`);
  }

  if (!isStaffRole(profile.role)) redirect("/");

  const creators = await getCreators();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Content Planner</h1>
        <p className="mt-1 text-sm text-muted">Pick a creator to view their planner.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Creator</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => (
              <tr key={creator.id} className="border-t border-border hover:bg-surface-raised">
                <td className="px-4 py-3">
                  <Link href={`/planner/${creator.id}`} className="font-medium hover:text-accent">
                    {creator.name}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
