import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import AppSidebar from "@/components/shared/AppSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = isStaffRole(profile.role);
  const isOwner = profile.role === "owner";

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/planner", label: "Content Planner" },
    ...(isStaff ? [{ href: "/creative-direction", label: "Creative Direction" }] : []),
    { href: "/reports", label: "Reports" },
    ...(isStaff ? [{ href: "/admin/creators", label: "Creators" }] : []),
    ...(isStaff ? [{ href: "/admin/intake-links", label: "Custom Request Links" }] : []),
    ...(isOwner ? [{ href: "/admin/users", label: "Users" }] : []),
    ...(isOwner ? [{ href: "/admin/google-drive", label: "Google Drive" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AppSidebar
        navItems={navItems}
        displayName={profile.display_name}
        role={profile.role}
        signOutAction={signOutAction}
      />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
