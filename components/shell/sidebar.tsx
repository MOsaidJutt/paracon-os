import Image from "next/image";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside className="hidden w-64 flex-col bg-ink lg:flex">
      <div className="flex h-16 items-center px-5">
        <Image
          src="/logo-white-transparent.png"
          alt="Paracon"
          width={140}
          height={26}
          className="h-6 w-auto"
          priority
        />
      </div>
      <SidebarNav permissions={permissions} />
      <div className="px-5 py-4 text-xs text-paper/55">Build in Parallel</div>
    </aside>
  );
}
