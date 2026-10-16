export type AppointmentStatus = "pending" | "confirmed" | "completed" | "canceled" | "no_show";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface Studio {
  id: string;
  slug: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  show_address: boolean;
  description: string | null;
  instagram: string | null;
  logo_url: string | null;
  primary_color: string;
  timezone: string;
  auto_confirm: boolean;
  slot_interval_minutes: number;
  min_advance_minutes: number;
  max_advance_days: number;
  cancel_limit_hours: number;
  onboarding_completed_at: string | null;
  suspended_at: string | null;
}

export interface Service {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface Appointment {
  id: string;
  studio_id: string;
  professional_id: string;
  service_id: string | null;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "online" | "manual";
  service_name: string;
  price_cents: number;
  customer_note: string | null;
  internal_note: string | null;
  customers?: { id: string; name: string; phone: string } | null;
  professionals?: { name: string } | null;
}

export interface Subscription {
  id: string;
  studio_id: string;
  plan_code: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  canceled_at: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
}

export interface PublicStudio {
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  whatsapp: string | null;
  instagram: string | null;
  logo_url: string | null;
  primary_color: string;
  timezone: string;
  max_advance_days: number;
  accepting_bookings: boolean;
  services: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
  }[];
  photos?: string[];
  /** Equipe que recebe agendamentos online (ativa e com horário). */
  professionals?: { id: string; name: string; service_ids?: string[] | null }[];
}

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;
