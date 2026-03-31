"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { VisitHistoryServer } from "@/components/visits/visit-history-server";
import { Stethoscope, Pill, MapPin, Phone, Star, Pencil, ArrowLeft, Navigation } from "lucide-react";
import type { Doctor, VisitWithDetails } from "@/types";

export default function DoctorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

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

  if (loading || !doctor) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  const Icon = doctor.doctor_type === "pharmacien" ? Pill : Stethoscope;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push("/medecins")} className="cursor-pointer">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour
      </Button>

      {/* Doctor info card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  {doctor.doctor_type === "pharmacien" ? "" : "Dr. "}
                  {doctor.last_name} {doctor.first_name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">
                    {doctor.doctor_type === "pharmacien" ? "Pharmacien" : "Médecin"}
                  </Badge>
                  {doctor.specialty && (
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
                    {doctor.address && ` — ${doctor.address}`}
                  </div>
                  {doctor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {doctor.phone}
                    </div>
                  )}
                  {doctor.latitude && doctor.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${doctor.latitude},${doctor.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline cursor-pointer"
                    >
                      <Navigation className="h-4 w-4" />
                      Voir sur Google Maps
                    </a>
                  )}
                  {doctor.engagement != null && doctor.engagement > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Engagement:</span>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des visites ({visits.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <VisitHistoryServer visits={visits} showUser />
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le médecin</DialogTitle>
          </DialogHeader>
          <DoctorForm
            initialData={doctor}
            onSuccess={(updated) => {
              setDoctor(updated);
              setShowEdit(false);
            }}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
