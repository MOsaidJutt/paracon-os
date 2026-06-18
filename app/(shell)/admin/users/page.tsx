import { UsersTable } from "@/components/admin/users/users-table";
import { PendingInvites } from "@/components/admin/users/pending-invites";

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <UsersTable />
      <PendingInvites />
    </div>
  );
}
