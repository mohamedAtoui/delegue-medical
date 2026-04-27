"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { DoctorVisitGroup } from "@/components/visits/visit-card";
import {
  Stethoscope,
  Pill,
  MapPin,
  Phone,
  Star,
  Pencil,
  ArrowLeft,
  Navigation,
  Mail,
  Truck,
} from "lucide-react";
import type { Doctor, UserRole, VisitWithDetails } from "@/types";

export default function DoctorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("delegue");

  const fetchDoctor = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, visitsRes] = await Promise.all([
        fetch(`/api/doctors/${params.id}`),
        fetch(`/api/visits?doctor_id=${params.id}&all=true&limit=50`),
      ]);
      const docData = await docRes.json();
      const visitsData = await visitsRes.json();
      setDoctor(docData);
      setVisits(visitsData.data || []);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  useEffect(() => {
    fetch("/api/users?me=true")
      .then((r) => r.json())
      .then((data) => {
        if (data?.role) setUserRole(data.role);
      })
      .catch(() => {});
  }, []);

  if (loading || !doctor) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  const isPharmacien = doctor.doctor_type === "pharmacien";
  const Icon = isPharmacien ? Pill : Stethoscope;
  const iconBg = isPharmacien ? "bg-accent/10" : "bg-primary/10";
  const iconColor = isPharmacien ? "text-accent" : "text-primary";

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push("/medecins")} className="cursor-pointer">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour
      </Button>

      {/* Doctor info card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                <Icon className={`h-7 w-7 ${iconColor}`} />
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  {isPharmacien ? "" : "Dr. "}
                  {doctor.last_name} {doctor.first_name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">
                    {isPharmacien ? "Pharmacien" : "Médecin"}
                  </Badge>
                  {doctor.specialty && !isPharmacien && (
                    <Badge variant="secondary">{doctor.specialty}</Badge>
                  )}
                  {doctor.potentiel && (
                    <Badge
                      className={
                        doctor.potentiel === "A"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : doctor.potentiel === "B"
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                          : "bg-red-100 text-red-700 hover:bg-red-100"
                      }
                    >
                      Potentiel {doctor.potentiel}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {doctor.wilaya}
                    {doctor.commune ? `, ${doctor.commune}` : ""}
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
                      className="flex items-center gap-2 text-primary hover:underline cursor-pointer"
                    >
                      <Navigation className="h-4 w-4" />
                      Voir sur Google Maps
                    </a>
                  )}
                  {isPharmacien && (doctor.grossiste_pharma || doctor.grossiste_para_pharm) && (
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
                  {doctor.engagement != null && doctor.engagement > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Engagement :</span>
                      <span className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= doctor.engagement!
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/20"
                            }`}
                          />
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visit history */}
      {visits.length > 0 ? (
        <DoctorVisitGroup
          doctorId={doctor.id}
          doctorName={`${isPharmacien ? "" : "Dr. "}${doctor.last_name} ${doctor.first_name}`.trim()}
          specialty={doctor.specialty || null}
          wilaya={doctor.wilaya || ""}
          commune={doctor.commune || null}
          address={doctor.address || null}
          visits={visits}
          doctorType={doctor.doctor_type as import("@/types").DoctorType}
          showUser
        />
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground py-6">
              Aucune visite enregistrée
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifier {isPharmacien ? "le pharmacien" : "le médecin"}
            </DialogTitle>
          </DialogHeader>
          <DoctorForm
            initialData={doctor}
            userRole={userRole}
            onSuccess={(updated) => {
              setDoctor(updated);
              setShowEdit(false);
            }}
            onCancel={() => setShowEdit(false)}
            onDelete={() => {
              setShowEdit(false);
              router.push("/medecins");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
