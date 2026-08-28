import { redirect } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";

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
    ...(isStaff ? [{ href: "/admin/intake-links", label: "Custom Request Links" }] : []),
    ...(isOwner ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="px-2 text-sm font-semibold tracking-tight">Creator Portal</div>
        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-2">
          <div className="text-xs text-muted">
            {profile.display_name}
            <div className="text-[11px] uppercase tracking-wide">{profile.role.replace("_", " ")}</div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
