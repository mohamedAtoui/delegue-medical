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
}

export function WilayaSelect({
  value,
  onValueChange,
  placeholder = "Sélectionner une wilaya",
}: WilayaSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {WILAYAS.map((wilaya) => (
          <SelectItem key={wilaya.code} value={wilaya.name}>
            {wilaya.code} - {wilaya.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
