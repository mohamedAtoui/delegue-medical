export type UserRole = "delegue" | "superviseur";
export type DoctorType = "medecin" | "pharmacien";
export type Potentiel = "A" | "B" | "C";

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  wilayas?: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  doctor_type: DoctorType;
  specialty: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  wilaya: string;
  phone: string | null;
  potentiel: Potentiel | null;
  engagement: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_visited_at?: string | null;
}

export interface Visit {
  id: string;
  user_id: string;
  doctor_id: string;
  product_id: string;
  notes: string | null;
  created_at: string;
}

export interface VisitWithDetails extends Visit {
  doctor: Doctor;
  product: Product;
  user: User;
}

export interface TerritoryAssignment {
  id: string;
  user_id: string;
  wilaya: string;
  assigned_by: string | null;
  created_at: string;
}
