import { OrgLogo } from "./org-logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { RoleBadge } from "./role-badge";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "@/components/search/global-search";

export function Topbar({
  orgName,
  logoUrl,
  permissions,
  superAdminEnabled,
  userName,
  userEmail,
  role,
}: {
  orgName: string;
  logoUrl: string | null;
  permissions: string[];
  superAdminEnabled: boolean;
  userName: string;
  userEmail: string;
  role: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <MobileNav permissions={permissions} superAdminEnabled={superAdminEnabled} />
        <OrgLogo logoUrl={logoUrl} orgName={orgName} />
      </div>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        {/* Role identity and the theme switch are office-desk conveniences —
            on a phone-width screen they push the search/avatar cluster far
            enough left to overlap the logo (measured ~56px intrusion at
            390px). Both stay reachable on tablet/desktop; on mobile the role
            is still visible in the account menu, and a foreman in direct
            sun has no use for a dark-mode toggle anyway. */}
        <div className="hidden sm:block">
          <RoleBadge role={role} />
        </div>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  );
}
