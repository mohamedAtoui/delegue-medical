"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import type { UserRole } from "@/types";

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPath={pathname} role={role} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>

      <MobileNav currentPath={pathname} role={role} />
    </div>
  );
}
