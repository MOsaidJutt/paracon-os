import { OrgLogo } from "./org-logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { RoleBadge } from "./role-badge";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({
  orgName,
  logoUrl,
  permissions,
  userName,
  userEmail,
  role,
}: {
  orgName: string;
  logoUrl: string | null;
  permissions: string[];
  userName: string;
  userEmail: string;
  role: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <MobileNav permissions={permissions} />
        <OrgLogo logoUrl={logoUrl} orgName={orgName} />
      </div>
      <div className="flex items-center gap-3">
        <RoleBadge role={role} />
        <ThemeToggle />
        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  );
}
