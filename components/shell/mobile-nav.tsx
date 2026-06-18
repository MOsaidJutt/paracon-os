"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-12 shrink-0 lg:hidden"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-6" />
      </Button>
      <SheetContent side="left" className="w-72 border-0 bg-ink p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-16 items-center px-5">
          <Image
            src="/logo-white-transparent.png"
            alt="Paracon"
            width={140}
            height={26}
            className="h-6 w-auto"
          />
        </div>
        <div onClick={() => setOpen(false)}>
          <SidebarNav permissions={permissions} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
