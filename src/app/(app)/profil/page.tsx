"use client";

import { useClerk } from "@clerk/nextjs";
import { UserProfile } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function ProfilPage() {
  const { signOut } = useClerk();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Mon Profil</h1>
        <Button
          variant="destructive"
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
      <UserProfile />
    </div>
  );
}
