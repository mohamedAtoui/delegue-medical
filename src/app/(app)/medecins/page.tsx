"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Stethoscope, Pill, Users } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { cn } from "@/lib/utils";
import type { Doctor, DoctorType } from "@/types";

type TypeFilter = "all" | DoctorType;

export default function MedecinsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (wilaya) params.set("wilaya", wilaya);
      if (specialty && specialty !== "all") params.set("specialty", specialty);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/doctors?${params}`);
      const data = await res.json();
      setDoctors(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [search, wilaya, specialty, typeFilter]);

  useEffect(() => {
    const timeout = setTimeout(fetchDoctors, 300);
    return () => clearTimeout(timeout);
  }, [fetchDoctors]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Répertoire</h1>
          <p className="text-sm text-muted-foreground">
            Médecins et pharmaciens
          </p>
        </div>
        <Link href="/medecins/nouveau">
          <Button className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </Link>
      </div>

      {/* Type tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-muted/40 rounded-lg">
        {([
          { key: "all", label: "Tous", icon: Users },
          { key: "medecin", label: "Médecins", icon: Stethoscope },
          { key: "pharmacien", label: "Pharmaciens", icon: Pill },
        ] as { key: TypeFilter; label: string; icon: typeof Users }[]).map((tab) => {
          const Icon = tab.icon;
          const active = typeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all cursor-pointer",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {typeFilter !== "pharmacien" && (
          <div className="w-full sm:w-48">
            <Select value={specialty} onValueChange={(v) => setSpecialty(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Spécialité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {SPECIALTIES.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="w-full sm:w-48">
          <WilayaSelect
            value={wilaya}
            onValueChange={setWilaya}
            placeholder="Toutes les wilayas"
            showAll
          />
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun résultat</p>
        </div>
      ) : (
        <div className="space-y-3">
          {doctors.map((doctor) => (
            <Link key={doctor.id} href={`/medecins/${doctor.id}`} className="block cursor-pointer">
              <DoctorCard doctor={doctor} onClick={() => {}} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
