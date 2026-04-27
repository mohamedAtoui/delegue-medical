"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Stethoscope, Pill } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Doctor, DoctorType } from "@/types";

interface DoctorSearchProps {
  onSelect: (doctor: Doctor | null) => void;
  onCreateNew: () => void;
  selectedDoctor?: Doctor | null;
  type?: DoctorType;
}

export function DoctorSearch({
  onSelect,
  onCreateNew,
  selectedDoctor,
  type,
}: DoctorSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Doctor[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("search", search);
        if (type) params.set("type", type);
        const res = await fetch(`/api/doctors?${params}`);
        const data = await res.json();
        setResults(data.data || []);
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, type]);

  const label = type === "pharmacien" ? "pharmacien" : "médecin";
  const labelCap = type === "pharmacien" ? "Pharmacien" : "Médecin";

  if (selectedDoctor) {
    const isPharm = selectedDoctor.doctor_type === "pharmacien";
    const Icon = isPharm ? Pill : Stethoscope;
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isPharm ? "bg-accent/10" : "bg-primary/10"}`}>
          <Icon className={`h-4 w-4 ${isPharm ? "text-accent" : "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {isPharm ? "" : "Dr. "}
            {selectedDoctor.last_name} {selectedDoctor.first_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {selectedDoctor.specialty ? `${selectedDoctor.specialty} · ` : ""}
            {selectedDoctor.wilaya}
            {selectedDoctor.commune ? `, ${selectedDoctor.commune}` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="cursor-pointer"
          onClick={() => {
            onSelect(null);
            setSearch("");
          }}
        >
          Changer
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Rechercher un ${label}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => search.length >= 2 && setIsOpen(true)}
          className="pl-9"
        />
      </div>

      {isOpen && search.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Recherche...</div>
          ) : results.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {results.map((doctor) => {
                const isPharm = doctor.doctor_type === "pharmacien";
                const Icon = isPharm ? Pill : Stethoscope;
                return (
                  <button
                    key={doctor.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      onSelect(doctor);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isPharm ? "text-accent" : "text-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {isPharm ? "" : "Dr. "}
                        {doctor.last_name} {doctor.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doctor.specialty ? `${doctor.specialty} · ` : ""}
                        {doctor.wilaya}
                        {doctor.commune ? `, ${doctor.commune}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Aucun {label} trouvé
            </div>
          )}

          <div className="border-t border-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter un nouveau {labelCap.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
