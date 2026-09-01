"use client";

import { Fragment, useState, useTransition } from "react";
import { removeUser, resetUserPassword } from "@/lib/actions/users";
import type { Creator, Profile } from "@/lib/types";

export default function UsersTable({
  profiles,
  creators,
}: {
  profiles: Profile[];
  creators: Creator[];
}) {
  const [isPending, startTransition] = useTransition();
  const [resettingId, setResettingId] = useState<string | null>(null);
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
          {profiles.map((profile) => {
            const isResetting = resettingId === profile.id;
            return (
              <Fragment key={profile.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{profile.display_name}</td>
                  <td className="px-4 py-3 text-muted">{profile.email}</td>
                  <td className="px-4 py-3">{profile.role.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-muted">
                    {profile.creator_id ? creatorNameById.get(profile.creator_id) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setResettingId(isResetting ? null : profile.id)}
                        className="text-xs text-accent hover:underline"
                      >
                        Reset password
                      </button>
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
                    </div>
                  </td>
                </tr>
                {isResetting && (
                  <tr className="border-b border-border bg-background last:border-0">
                    <td colSpan={5} className="px-4 py-3">
                      <ResetPasswordForm
                        profile={profile}
                        onDone={() => setResettingId(null)}
                        onCancel={() => setResettingId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResetPasswordForm({
  profile,
  onDone,
  onCancel,
}: {
  profile: Profile;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      try {
        await resetUserPassword(profile.id, password);
        setError(null);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reset that password.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">
          New temporary password for {profile.display_name}
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          minLength={8}
          placeholder="Share this with them directly"
          className="w-72 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
        />
      </div>
      <button
        type="button"
        disabled={isPending || password.length < 8}
        onClick={submit}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Set password
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-foreground">
        Cancel
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
