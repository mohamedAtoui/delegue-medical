import { createClient } from "@/utils/supabase/server";
import type { Doctor } from "@/types";

export interface DoctorQueryOptions {
  search?: string | null;
  wilaya?: string | null;
  specialty?: string | null;
  type?: "medecin" | "pharmacien" | "grossiste" | null;
  page?: number;
  limit?: number;
}

export interface DoctorsResult {
  data: Doctor[];
  count: number;
  page: number;
  limit: number;
}

/**
 * Shared doctors query — used by /api/doctors route and the server-rendered
 * /medecins page. Includes `last_visited_at` enrichment.
 */
export async function fetchDoctors(
  opts: DoctorQueryOptions = {}
): Promise<DoctorsResult> {
  const {
    search,
    wilaya,
    specialty,
    type,
    page = 1,
    limit = 20,
  } = opts;

  const offset = (page - 1) * limit;
  const supabase = await createClient();

  let query = supabase.from("doctors").select("*", { count: "exact" });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    );
  }
  if (wilaya) query = query.eq("wilaya", wilaya);
  if (specialty) query = query.eq("specialty", specialty);
  if (type === "medecin" || type === "pharmacien" || type === "grossiste") {
    query = query.eq("doctor_type", type);
  }

  const { data: doctors, count, error } = await query
    .order("last_name")
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  // Attach last_visited_at
  if (doctors && doctors.length > 0) {
    const doctorIds = doctors.map((d) => d.id);
    const { data: lastVisits } = await supabase
      .from("visits")
      .select("doctor_id, created_at")
      .in("doctor_id", doctorIds)
      .order("created_at", { ascending: false });

    const lastVisitMap = new Map<string, string>();
    lastVisits?.forEach((v) => {
      if (!lastVisitMap.has(v.doctor_id)) {
        lastVisitMap.set(v.doctor_id, v.created_at);
      }
    });

    doctors.forEach((doc) => {
      (doc as Record<string, unknown>).last_visited_at =
        lastVisitMap.get(doc.id) || null;
    });
  }

  return {
    data: (doctors || []) as Doctor[],
    count: count || 0,
    page,
    limit,
  };
}
