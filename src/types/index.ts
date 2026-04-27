export type UserRole = "delegue" | "superviseur";
export type DoctorType = "medecin" | "pharmacien";
export type VisitType = "medecin" | "pharmacien";
export type Potentiel = "A" | "B" | "C";

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  wilayas?: string[];
  daily_visit_goal?: number;
  today_count?: number;
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string | null;
  created_at: string;
  signed_up?: boolean;
}

export type NotificationType =
  | "comment"
  | "comment_reply"
  | "assignment_new"
  | "assignment_due_soon"
  | "assignment_overdue";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  entity_id: string | null;
  entity_type: string | null;
  read: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  reference: string | null;
  laboratory: string | null;
  quantity: number | null;
  price: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  doctor_type: DoctorType;
  specialty: string | null;
  address: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  wilaya: string;
  commune: string | null;
  phone: string | null;
  phone_fixe: string | null;
  phone_mobile: string | null;
  email: string | null;
  grossiste_pharma: string | null;
  grossiste_para_pharm: string | null;
  potentiel: Potentiel | null;
  engagement: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_visited_at?: string | null;
}

export type QuestionInputType = "yes_no" | "short_text" | "textarea" | "number";
export type QuestionTargetRole = "medecin" | "pharmacien";

/**
 * Rule that drives a question's visibility. `null` = always visible.
 * Evaluated client-side against the current answers map. Unknown ops should
 * fail open (question still renders) so old clients don't hide questions
 * once new rule shapes land server-side.
 */
export type VisibleWhenRule =
  | { op: "eq"; question_id: string; value: boolean | string | number };

export interface ProductQuestion {
  id: string;
  product_id: string;
  target_role: QuestionTargetRole;
  label: string;
  input_type: QuestionInputType;
  required: boolean;
  display_order: number;
  visible_when: VisibleWhenRule | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitAnswer {
  id: string;
  visit_id: string;
  question_id: string;
  value_boolean: boolean | null;
  value_text: string | null;
  value_number: number | null;
  created_at: string;
  question?: ProductQuestion;
}

export interface Visit {
  id: string;
  user_id: string;
  doctor_id: string;
  product_id: string | null;
  visit_type: VisitType;
  objective: string | null;
  compte_rendu: string | null;
  // Legacy médecin checklist — kept for pre-migration visits; new visits
  // store answers in visit_answers instead.
  synapgen_solves: boolean | null;
  already_prescribed: boolean | null;
  promised_to_suggest: boolean | null;
  price_objection: boolean | null;
  prescribes_magnesium: boolean | null;
  magnesium_brand: string | null;
  fears_side_effects: boolean | null;
  patient_feedback: boolean | null;
  patient_feedback_comment: string | null;
  ordonnance_return: boolean | null;
  free_sample: boolean | null;
  // Legacy pharmacien fields
  synapgen_count: number | null;
  prescriptions_received: number | null;
  prescribing_doctor: string | null;
  accepted_order: boolean | null;
  created_at: string;
}

export interface VisitWithDetails extends Visit {
  doctor: Doctor;
  user: User;
  comment_count?: number;
  visit_answers?: VisitAnswer[];
}

export interface VisitComment {
  id: string;
  visit_id: string;
  user_id: string;
  parent_id: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user?: Pick<User, "id" | "first_name" | "last_name" | "avatar_url">;
}

export interface TerritoryAssignment {
  id: string;
  user_id: string;
  wilaya: string;
  assigned_by: string | null;
  created_at: string;
}

export type AssignmentStatus = "pending" | "completed" | "overdue";

export interface VisitAssignment {
  id: string;
  assignee_id: string;
  doctor_id: string;
  assigned_by: string;
  status: AssignmentStatus;
  deadline: string;
  note: string | null;
  completed_at: string | null;
  visit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitAssignmentWithDetails extends VisitAssignment {
  doctor: Doctor;
  assignee: Pick<User, "id" | "first_name" | "last_name" | "avatar_url">;
  assigner: Pick<User, "id" | "first_name" | "last_name" | "avatar_url">;
}
