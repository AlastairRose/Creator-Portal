"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { upsertCreatorSocialAccount, type SocialAccountFields } from "@/lib/actions/social-accounts";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type CreatorSocialAccount,
  type SocialAccountManagedBy,
  type SocialPlatform,
} from "@/lib/types";

const MANAGED_BY_LABELS: Record<SocialAccountManagedBy, string> = {
  autoposter: "Autoposter",
  account_manager: "Account manager",
};

export default function AccountsSection({
  creatorId,
  accounts,
}: {
  creatorId: string;
  accounts: CreatorSocialAccount[];
}) {
  const accountByPlatform = new Map(accounts.map((a) => [a.platform, a]));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Accounts</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Managed by</th>
              <th className="px-4 py-3 font-medium">Profile</th>
            </tr>
          </thead>
          <tbody>
            {SOCIAL_PLATFORMS.map((platform) => (
              <AccountRow
                key={platform}
                creatorId={creatorId}
                platform={platform}
                account={accountByPlatform.get(platform) ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountRow({
  creatorId,
  platform,
  account,
}: {
  creatorId: string;
  platform: SocialPlatform;
  account: CreatorSocialAccount | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<SocialAccountFields>({
    is_active: account?.is_active ?? false,
    managed_by: account?.managed_by ?? null,
    profile_url: account?.profile_url ?? null,
  });

  function save(next: SocialAccountFields) {
    setFields(next);
    startTransition(async () => {
      await upsertCreatorSocialAccount(creatorId, platform, next);
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">{SOCIAL_PLATFORM_LABELS[platform]}</td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={fields.is_active}
          disabled={isPending}
          onChange={(e) => save({ ...fields, is_active: e.target.checked })}
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={fields.managed_by ?? ""}
          disabled={isPending}
          onChange={(e) =>
            save({
              ...fields,
              managed_by: (e.target.value || null) as SocialAccountManagedBy | null,
            })
          }
          className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
        >
          <option value="">—</option>
          {(Object.keys(MANAGED_BY_LABELS) as SocialAccountManagedBy[]).map((value) => (
            <option key={value} value={value}>
              {MANAGED_BY_LABELS[value]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={fields.profile_url ?? ""}
            disabled={isPending}
            placeholder="Profile link"
            onChange={(e) => setFields({ ...fields, profile_url: e.target.value })}
            onBlur={() => save(fields)}
            className="w-56 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70"
          />
          {fields.profile_url && (
            <a
              href={fields.profile_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs text-accent hover:underline"
            >
              View
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}
