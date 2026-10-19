import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import AppSidebar from "@/components/shared/AppSidebar";
import NotificationSetup from "@/components/shared/NotificationSetup";
import Link from "next/link";
import { getOnboardingState } from "@/lib/onboarding/state";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");

  // New creators must sign their agreement and give their details before
  // using the portal; the remaining onboarding steps show as a reminder.
  const onboarding =
    profile.role === "creator" && profile.creator_id ? await getOnboardingState(profile.creator_id) : null;
  if (onboarding && !onboarding.requiredDone) redirect("/onboarding");
  const onboardingIncomplete = !!onboarding && !onboarding.allDone;

  const isStaff = isStaffRole(profile.role);
  const isOwner = profile.role === "owner";

  // Agreements creators have signed that still need the agency's signature.
  let awaitingCountersign = 0;
  if (isOwner) {
    const { count } = await createAdminClient()
      .from("creator_agreements")
      .select("id", { count: "exact", head: true })
      .is("countersigned_at", null);
    awaitingCountersign = count ?? 0;
  }

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/planner", label: "Content Planner" },
    { href: "/video-calls", label: "Video Calls" },
    ...(isStaff ? [{ href: "/creative-direction", label: "Creative Direction" }] : []),
    ...(isStaff ? [{ href: "/ofcd", label: "OFCD" }] : []),
    ...(isStaff ? [{ href: "/sops", label: "SOPs" }] : []),
    { href: "/reports", label: "Reports" },
    ...(isStaff ? [{ href: "/admin/creators", label: "Creators" }] : []),
    ...(isStaff ? [{ href: "/admin/intake-links", label: "Custom Request Links" }] : []),
    ...(isOwner ? [{ href: "/admin/users", label: "Users" }] : []),
    ...(isOwner ? [{ href: "/admin/google-drive", label: "Google Drive" }] : []),
    ...(isOwner ? [{ href: "/admin/onboarding", label: "Onboarding" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AppSidebar
        navItems={navItems}
        displayName={profile.display_name}
        role={profile.role}
        signOutAction={signOutAction}
      />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Phone notifications are for creators (new customs, reels, content requests). */}
        {awaitingCountersign > 0 && (
          <Link
            href="/admin/creators"
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium">
                ✍️ {awaitingCountersign} creator agreement{awaitingCountersign === 1 ? "" : "s"} waiting for your signature
              </span>
            </span>
            <span className="shrink-0 font-medium text-accent">Review</span>
          </Link>
        )}
        {onboardingIncomplete && (
          <Link
            href="/onboarding"
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium">✨ Finish setting up your account</span>
              <span className="text-muted"> to get the most out of the portal.</span>
            </span>
            <span className="shrink-0 font-medium text-accent">Continue</span>
          </Link>
        )}
        {profile.role === "creator" && !onboardingIncomplete && <NotificationSetup />}
        {children}
      </main>
    </div>
  );
}
