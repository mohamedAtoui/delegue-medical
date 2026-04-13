"use client";

import Link from "next/link";
import { useClerk, UserButton } from "@clerk/nextjs";
import {
  ClipboardList,
  Stethoscope,
  LayoutDashboard,
  Users,
  CalendarCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const allNavItems = [
  { href: "/visites", label: "Visites", icon: ClipboardList, roles: ["delegue", "superviseur"] },
  { href: "/medecins", label: "Médecins", icon: Stethoscope, roles: ["delegue", "superviseur"] },
  { href: "/planification", label: "Planification", icon: CalendarCheck, roles: ["delegue"] },
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["superviseur"] },
  { href: "/delegues", label: "Délégués", icon: Users, roles: ["superviseur"] },
];

export function Sidebar({ currentPath, role }: { currentPath: string; role: UserRole }) {
  const { signOut } = useClerk();
  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">H</span>
        </div>
        <div>
          <h1 className="font-semibold text-sidebar-foreground">Handson</h1>
          <p className="text-xs text-muted-foreground">Délégué Médical</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9" },
            }}
          />
          <span className="text-sm text-sidebar-foreground">Mon compte</span>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
