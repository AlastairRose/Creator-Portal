"use client";

import { useActionState, useState } from "react";
import { inviteUser, linkExistingUser, type UserFormState } from "@/lib/actions/users";
import type { Creator, Role } from "@/lib/types";

const initialState: UserFormState = { error: null };

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "creative_director", label: "Creative Director" },
  { value: "editor", label: "Editor" },
  { value: "creator", label: "Creator" },
];

export default function InviteUserForm({ creators }: { creators: Creator[] }) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const action = mode === "new" ? inviteUser : linkExistingUser;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [role, setRole] = useState<Role>("creator");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {mode === "new" ? "Invite someone new" : "Link an existing account"}
        </h2>
        <button
          type="button"
          onClick={() => setMode(mode === "new" ? "existing" : "new")}
          className="text-xs text-accent hover:underline"
        >
          {mode === "new" ? "This person already has a login →" : "← Create a new login instead"}
        </button>
      </div>
      {mode === "existing" && (
        <p className="text-xs text-muted">
          For someone who already has a login for another of your apps sharing this database
          (e.g. Outlier Engine) — this gives their existing account access here, instead of
          creating a confusing second login for the same person.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="display_name" className="text-xs font-medium text-muted">
            Display name
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-xs font-medium text-muted">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {role === "creator" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="creator_id" className="text-xs font-medium text-muted">
              Creator
            </label>
            <select
              id="creator_id"
              name="creator_id"
              required
              className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Select a creator…</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {mode === "new" && (
          <div className="flex flex-col gap-1.5 col-span-2">
            <label htmlFor="temp_password" className="text-xs font-medium text-muted">
              Temporary password
            </label>
            <input
              id="temp_password"
              name="temp_password"
              type="text"
              required
              minLength={8}
              placeholder="Share this with them directly — there's no invite email yet"
              className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      {state.error && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : mode === "new" ? "Create account" : "Link account"}
      </button>
    </form>
  );
}
