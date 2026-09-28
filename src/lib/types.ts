export type Group = {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  /** The end of the short join link, e.g. "livefitclub-7a3f" in /join/livefitclub-7a3f. */
  join_slug: string | null;
};

export type MemberGroup = {
  member_id: string;
  group_id: string;
  status: "pending" | "active";
};

export type Plan = {
  id: string;
  group_id: string;
  name: string;
  sessions_per_week: number;
  price_pence: number;
  active: boolean;
  sort: number;
};

export type Member = {
  id: string;
  name: string;
  /** Her own reference for bank transfers, e.g. AMINA-4821. */
  pay_ref: string | null;
  phone: string | null;
  status: "pending" | "active" | "inactive";
  notes: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  member_id: string;
  group_id: string;
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
  group_id: string;
  session_date: string;
  start_time: string;
  title: string;
  cancelled: boolean;
  cancel_reason: string | null;
  slot_id: string | null;
  slot_date: string | null;
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
  group_id: string;
  weekday: number;
  start_time: string;
  title: string;
};

export type Rsvp = {
  id: string;
  session_id: string;
  member_id: string;
  coming: boolean;
  created_at: string;
};

export const EXPENSE_CATEGORIES = {
  hall: "Hall hire",
  instructor: "Instructor",
  music: "Music licence",
  equipment: "Equipment",
  marketing: "Advertising",
  other: "Other",
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export type Expense = {
  id: string;
  /** Empty means the cost is shared by all groups. */
  group_id: string | null;
  category: ExpenseCategory;
  description: string | null;
  amount_pence: number;
  paid_on: string;
  covers_from: string;
  covers_months: number;
  receipt_path: string | null;
  created_at: string;
};
