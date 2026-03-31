"use client";

import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Doctor } from "@/types";

interface DoctorSearchProps {
  onSelect: (doctor: Doctor) => void;
  onCreateNew: () => void;
  selectedDoctor?: Doctor | null;
}

export function DoctorSearch({
  onSelect,
  onCreateNew,
  selectedDoctor,
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
        const res = await fetch(`/api/doctors?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        setResults(data.data || []);
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  if (selectedDoctor) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <div className="flex-1">
          <p className="font-medium text-sm">
            Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedDoctor.specialty} - {selectedDoctor.wilaya}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSelect(null as unknown as Doctor);
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
          placeholder="Rechercher un médecin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => search.length >= 2 && setIsOpen(true)}
          className="pl-9"
        />
      </div>

      {isOpen && (search.length >= 2) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Recherche...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {results.map((doctor) => (
                <button
                  key={doctor.id}
                  className="w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => {
                    onSelect(doctor);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  <p className="font-medium text-sm">
                    Dr. {doctor.first_name} {doctor.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doctor.specialty} - {doctor.wilaya}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Aucun médecin trouvé
            </div>
          )}

          <div className="border-t border-border">
            <button
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter un nouveau médecin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
