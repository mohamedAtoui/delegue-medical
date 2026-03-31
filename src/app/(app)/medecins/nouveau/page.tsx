"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorForm } from "@/components/doctors/doctor-form";

export default function NouveauMedecinPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un médecin</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorForm
            onSuccess={() => router.push("/medecins")}
            onCancel={() => router.back()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
