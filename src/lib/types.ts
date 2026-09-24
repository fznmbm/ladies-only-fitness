export type Plan = {
  id: string;
  name: string;
  sessions_per_week: number;
  price_pence: number;
  active: boolean;
  sort: number;
};

export type Member = {
  id: string;
  name: string;
  phone: string | null;
  status: "pending" | "active" | "inactive";
  notes: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  member_id: string;
  plan_id: string;
  month: string;
  sessions_per_week: number;
  price_pence: number;
  method: "cash" | "transfer";
  status: "pending" | "confirmed" | "rejected";
  receipt_path: string | null;
  created_at: string;
  confirmed_at: string | null;
};

export type Session = {
  id: string;
  session_date: string;
  start_time: string;
  title: string;
  cancelled: boolean;
};

export type Attendance = {
  id: string;
  session_id: string;
  member_id: string;
  flag: "over_plan" | "no_plan" | null;
  resolution: "allowed" | "cash" | "pay_later" | "settled" | null;
  extra_paid_pence: number;
  created_at: string;
};

export type Slot = {
  id: string;
  weekday: number;
  start_time: string;
  title: string;
};
