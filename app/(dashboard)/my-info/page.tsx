import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/roles";
import { loadMyModelInfo } from "@/lib/onboarding/chatter-portal";
import MyInfoForm from "@/components/onboarding/MyInfoForm";

export const dynamic = "force-dynamic";

// A creator's own model info, editable any time. Saved straight to the chat
// team's Model Information page in the Chatter Portal.
export default async function MyInfoPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "creator" || !profile.creator_id) redirect("/");

  const { answers, linked, loadError } = await loadMyModelInfo(profile.creator_id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Info</h1>
        <p className="mt-1 text-sm text-muted">
          Everything our chat team knows about you, so they can talk to your fans just like you would. Keep it up to
          date whenever something changes. If you have a persona, answer as that persona, and leave anything blank
          you&apos;d rather not share.
        </p>
      </div>
      {loadError && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{loadError}</div>
      )}
      {!linked && (
        <p className="text-xs text-muted">
          Your answers are saved here and will be passed to the chat team once your account is connected on their side.
        </p>
      )}
      {/* Remount after each save so new list items pick up their saved keys. */}
      <MyInfoForm key={createHash("sha1").update(JSON.stringify(answers)).digest("hex")} initial={answers} />
    </div>
  );
}
