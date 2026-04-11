"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

function getInitials(first?: string | null, last?: string | null): string {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (!f && !l) return "?";
  return ((f[0] || "") + (l[0] || "")).toUpperCase();
}

// Deterministic color from name (for fallback backgrounds)
function nameColor(name: string): string {
  const colors = [
    "bg-emerald-200 text-emerald-800",
    "bg-blue-200 text-blue-800",
    "bg-purple-200 text-purple-800",
    "bg-pink-200 text-pink-800",
    "bg-amber-200 text-amber-800",
    "bg-cyan-200 text-cyan-800",
    "bg-rose-200 text-rose-800",
    "bg-indigo-200 text-indigo-800",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export function UserAvatar({
  firstName,
  lastName,
  imageUrl,
  size = "default",
  className,
}: UserAvatarProps) {
  const initials = getInitials(firstName, lastName);
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  const fallbackColor = nameColor(fullName || "?");

  return (
    <Avatar size={size} className={className}>
      {imageUrl && <AvatarImage src={imageUrl} alt={fullName} />}
      <AvatarFallback className={cn("font-semibold", fallbackColor)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
