"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WILAYAS } from "@/lib/constants/wilayas";

interface WilayaSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  showAll?: boolean;
  allLabel?: string;
}

export function WilayaSelect({
  value,
  onValueChange,
  placeholder = "Sélectionner une wilaya",
  showAll = false,
  allLabel = "Toutes les wilayas",
}: WilayaSelectProps) {
  return (
    <Select value={value || (showAll ? "all" : "")} onValueChange={(v) => onValueChange(v === "all" ? "" : (v ?? ""))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showAll && (
          <SelectItem value="all">{allLabel}</SelectItem>
        )}
        {WILAYAS.map((wilaya) => (
          <SelectItem key={wilaya.code} value={wilaya.name}>
            {wilaya.code} - {wilaya.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
