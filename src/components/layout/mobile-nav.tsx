"use client";

import Link from "next/link";
import { ClipboardList, Stethoscope, LayoutDashboard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const allNavItems = [
  { href: "/visites", label: "Visites", icon: ClipboardList, roles: ["delegue", "superviseur"] },
  { href: "/medecins", label: "Médecins", icon: Stethoscope, roles: ["delegue", "superviseur"] },
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["superviseur"] },
  { href: "/profil", label: "Profil", icon: User, roles: ["delegue", "superviseur"] },
];

export function MobileNav({ currentPath, role }: { currentPath: string; role: UserRole }) {
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1.5 text-[10px] transition-colors cursor-pointer",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
