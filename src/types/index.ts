export type UserRole = "delegue" | "superviseur";

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
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
  specialty: string | null;
  wilaya: string;
  phone: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
