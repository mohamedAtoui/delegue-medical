"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Stethoscope,
  Pill,
  Users,
  MapPin,
  Phone,
  Star,
  Clock,
  ChevronDown,
  Pencil,
  Navigation,
  Mail,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { VisitEntry } from "@/components/visits/visit-entry";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { MedicalLoader } from "@/components/ui/medical-loader";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import type { Doctor, DoctorType, UserRole, VisitWithDetails } from "@/types";

type TypeFilter = "all" | DoctorType;

interface MedecinsClientProps {
  role: UserRole;
  initialDoctors?: Doctor[];
}

export function MedecinsClient({ role, initialDoctors }: MedecinsClientProps) {
  const hasInitial = initialDoctors !== undefined;
  const [doctors, setDoctors] = useState<Doctor[]>(initialDoctors || []);
  const [search, setSearch] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(!hasInitial);

  // Inline expand
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVisits, setExpandedVisits] = useState<VisitWithDetails[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Skip first fetch when server-rendered initial data is present.
  const skipNext = useRef(hasInitial);

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
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const timeout = setTimeout(fetchDoctors, 300);
    return () => clearTimeout(timeout);
  }, [fetchDoctors]);

  const toggleDoctor = async (doctorId: string) => {
    if (expandedId === doctorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(doctorId);
    setExpandedVisits([]);
    setVisitsLoading(true);
    try {
      const res = await fetch(`/api/visits?doctor_id=${doctorId}&all=true&limit=50`);
      const data = await res.json();
      setExpandedVisits(data.data || []);
    } finally {
      setVisitsLoading(false);
    }
  };

  const expandedDoctor = expandedId ? doctors.find((d) => d.id === expandedId) || null : null;

  const handleDoctorDeleted = () => {
    if (expandedId) {
      setDoctors((prev) => prev.filter((d) => d.id !== expandedId));
      setExpandedId(null);
      setShowEdit(false);
      toast.success("Médecin/pharmacien supprimé");
    }
  };

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
                <SelectValue placeholder="Toutes les spécialités" />
              </SelectTrigger>
              <SelectContent>
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
      {loading && doctors.length === 0 ? (
        <MedicalLoader variant="inline" />
      ) : doctors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun résultat</p>
        </div>
      ) : (
        <div className="relative space-y-3">
          {loading && <MedicalLoader variant="overlay" />}
          {doctors.map((doctor) => {
            const isExpanded = expandedId === doctor.id;
            const isPharm = doctor.doctor_type === "pharmacien";
            const Icon = isPharm ? Pill : Stethoscope;
            const iconBg = isPharm ? "bg-accent/10" : "bg-primary/10";
            const iconColor = isPharm ? "text-accent" : "text-primary";
            const phoneDisplay = doctor.phone_mobile || doctor.phone_fixe || (doctor as unknown as Record<string, string>).phone;

            return (
              <Card
                key={doctor.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-all",
                  isExpanded && "ring-1 ring-primary/20"
                )}
              >
                <CardContent className="p-4">
                  {/* Header — clickable to toggle */}
                  <div
                    className="flex items-center justify-between gap-3"
                    onClick={() => toggleDoctor(doctor.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">
                            {isPharm ? "" : "Dr. "}
                            {doctor.last_name} {doctor.first_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {isPharm ? "Pharmacien" : "Médecin"}
                          </Badge>
                          {doctor.specialty && !isPharm && (
                            <Badge variant="secondary" className="text-xs">
                              {doctor.specialty}
                            </Badge>
                          )}
                          {doctor.potentiel && (
                            <Badge
                              className={`text-xs ${
                                doctor.potentiel === "A"
                                  ? "bg-green-100 text-green-700 hover:bg-green-100"
                                  : doctor.potentiel === "B"
                                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                                  : "bg-red-100 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              Potentiel {doctor.potentiel}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {doctor.wilaya}
                          </span>
                          {phoneDisplay && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {phoneDisplay}
                            </span>
                          )}
                          {doctor.engagement != null && doctor.engagement > 0 && (
                            <span className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`h-3 w-3 ${
                                    s <= doctor.engagement!
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted-foreground/20"
                                  }`}
                                />
                              ))}
                            </span>
                          )}
                          {doctor.last_visited_at && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(doctor.last_visited_at), "d MMM yyyy", { locale: fr })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      className="mt-4 pt-3 border-t border-border/50 space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Doctor details */}
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {doctor.wilaya}
                          {doctor.address && ` — ${doctor.address}`}
                        </div>
                        {doctor.phone_fixe && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span className="font-medium text-foreground/80">Fixe :</span> {doctor.phone_fixe}
                          </div>
                        )}
                        {doctor.phone_mobile && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span className="font-medium text-foreground/80">Portable :</span> {doctor.phone_mobile}
                          </div>
                        )}
                        {doctor.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {doctor.email}
                          </div>
                        )}
                        {doctor.google_maps_url && (
                          <a
                            href={doctor.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Navigation className="h-4 w-4" />
                            Voir sur Google Maps
                          </a>
                        )}
                        {isPharm && (doctor.grossiste_pharma || doctor.grossiste_para_pharm) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Truck className="h-4 w-4" />
                            {doctor.grossiste_pharma && (
                              <Badge variant="outline" className="text-xs">
                                Pharma : {doctor.grossiste_pharma}
                              </Badge>
                            )}
                            {doctor.grossiste_para_pharm && (
                              <Badge variant="outline" className="text-xs">
                                Para-pharm : {doctor.grossiste_para_pharm}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEdit(true)}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </Button>

                      {/* Visit history */}
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground/80">
                          Historique des visites
                          {!visitsLoading && ` (${expandedVisits.length})`}
                        </p>
                        {visitsLoading ? (
                          <MedicalLoader variant="inline" className="min-h-[120px]" />
                        ) : expandedVisits.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-3 text-center">
                            Aucune visite enregistrée
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {expandedVisits.map((visit) => (
                              <VisitEntry
                                key={visit.id}
                                visit={visit}
                                showUser
                                userRole={role}
                                onDelete={(id) =>
                                  setExpandedVisits((prev) => prev.filter((v) => v.id !== id))
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {expandedDoctor && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Modifier {expandedDoctor.doctor_type === "pharmacien" ? "le pharmacien" : "le médecin"}
              </DialogTitle>
            </DialogHeader>
            <DoctorForm
              initialData={expandedDoctor}
              userRole={role}
              onSuccess={(updated) => {
                setDoctors((prev) =>
                  prev.map((d) => (d.id === updated.id ? updated : d))
                );
                setShowEdit(false);
              }}
              onCancel={() => setShowEdit(false)}
              onDelete={handleDoctorDeleted}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
