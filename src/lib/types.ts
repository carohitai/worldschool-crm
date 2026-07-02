export type StaffRole = "admin" | "coordinator" | "teacher" | "front_office";
export type CallStatus = "pending" | "reached" | "not_reached" | "callback";
export type CallSentiment = "positive" | "neutral" | "negative";

export interface Staff {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  linkus_extension: string | null;
  active: boolean;
}

export const CALL_TOPICS = [
  "Academics",
  "Homework",
  "Behaviour",
  "Attendance",
  "Health",
  "Transport",
  "Fees",
  "Complaint",
  "Appreciation",
  "Other",
] as const;

export const DISPOSITION_LABELS: Record<CallStatus, string> = {
  pending: "Pending",
  reached: "Reached",
  not_reached: "Not reached",
  callback: "Callback",
};
