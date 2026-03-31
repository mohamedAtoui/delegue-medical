import { Stethoscope, MapPin, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Doctor } from "@/types";

interface DoctorCardProps {
  doctor: Doctor;
  onClick?: () => void;
}

export function DoctorCard({ doctor, onClick }: DoctorCardProps) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Stethoscope className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">
            Dr. {doctor.first_name} {doctor.last_name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {doctor.specialty && (
              <Badge variant="secondary" className="text-xs">
                {doctor.specialty}
              </Badge>
            )}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
