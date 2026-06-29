"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Set only when demoing through a tunnel (ngrok etc.) where the dev server
// can't see the public host — see NEXT_PUBLIC_APP_URL in .env.example.
const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  onDarkSurface = false,
}: {
  name: string;
  email: string;
  /** True when rendered on a surface that's dark regardless of the light/dark theme (e.g. the always-ink super-admin header) — picks the light-on-dark brass variant unconditionally instead of following the theme toggle. */
  onDarkSurface?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-12 gap-2 px-2" aria-label={`Account menu for ${name}`}>
          <Avatar className="size-9">
            <AvatarFallback
              className={
                onDarkSurface ? "bg-brass/15 text-brass-light" : "bg-brass/15 text-brass-deep dark:text-brass-light"
              }
            >
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: appBaseUrl ? `${appBaseUrl}/login` : "/login" })}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
