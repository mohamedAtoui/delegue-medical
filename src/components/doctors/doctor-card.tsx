import { Stethoscope, MapPin, Phone, Star, Clock, Pill } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Doctor } from "@/types";

interface DoctorCardProps {
  doctor: Doctor;
  onClick?: () => void;
}

export function DoctorCard({ doctor, onClick }: DoctorCardProps) {
  const icon = doctor.doctor_type === "pharmacien" ? Pill : Stethoscope;
  const Icon = icon;

  return (
    <Card
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">
              {doctor.doctor_type === "pharmacien" ? "" : "Dr. "}
              {doctor.last_name} {doctor.first_name}
            </h3>
            <Badge variant="outline" className="text-xs">
              {doctor.doctor_type === "pharmacien" ? "Pharmacien" : "Médecin"}
            </Badge>
            {doctor.specialty && (
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
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {doctor.wilaya}
            </span>
            {doctor.phone && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {doctor.phone}
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
      </CardContent>
    </Card>
  );
}
