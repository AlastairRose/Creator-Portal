import { requireOwner } from "@/lib/roles";
import { getProfiles, getCreators } from "@/lib/queries";
import InviteUserForm from "@/components/admin/InviteUserForm";
import UsersTable from "@/components/admin/UsersTable";

export default async function UsersPage() {
  await requireOwner();
  const [profiles, creators] = await Promise.all([getProfiles(), getCreators()]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Invite-only. Create a login for a staff member or creator, and share the temporary
          password with them directly.
        </p>
      </div>

      <InviteUserForm creators={creators} />

      <UsersTable profiles={profiles} creators={creators} />
    </div>
  );
}
