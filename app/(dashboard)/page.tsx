import { getCurrentProfile } from "@/lib/roles";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Welcome, {profile?.display_name}. Weekly performance rollup lands here once content
        weeks exist.
      </p>
    </div>
  );
}
