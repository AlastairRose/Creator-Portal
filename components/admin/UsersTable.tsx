"use client";

import { useTransition } from "react";
import { removeUser } from "@/lib/actions/users";
import type { Creator, Profile } from "@/lib/types";

export default function UsersTable({
  profiles,
  creators,
}: {
  profiles: Profile[];
  creators: Creator[];
}) {
  const [isPending, startTransition] = useTransition();
  const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Creator</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{profile.display_name}</td>
              <td className="px-4 py-3 text-muted">{profile.email}</td>
              <td className="px-4 py-3">{profile.role.replace("_", " ")}</td>
              <td className="px-4 py-3 text-muted">
                {profile.creator_id ? creatorNameById.get(profile.creator_id) ?? "—" : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm(`Remove ${profile.display_name}'s access?`)) return;
                    startTransition(() => removeUser(profile.id));
                  }}
                  className="text-xs text-danger hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
