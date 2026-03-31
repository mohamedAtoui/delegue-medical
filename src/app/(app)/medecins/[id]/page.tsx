import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { VisitHistoryServer } from "@/components/visits/visit-history-server";

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", id)
    .single();

  if (!doctor) notFound();

  const { data: visits } = await supabase
    .from("visits")
    .select("*, doctor:doctors(*), product:products(*), user:users(*)")
    .eq("doctor_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <DoctorCard doctor={doctor} />

      <div>
        <h2 className="text-lg font-semibold mb-4">Historique des visites</h2>
        <VisitHistoryServer visits={visits || []} showUser />
      </div>
    </div>
  );
}
