import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function generateToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Job status helpers
export const JOB_STATUSES = [
  "new",
  "quoted",
  "scheduled",
  "in_progress",
  "done",
  "paid",
  "archive",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  quoted: "Quoted",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  done: "Done",
  paid: "Paid",
  archive: "Archive",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  scheduled: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-orange-100 text-orange-800",
  done: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
  archive: "bg-gray-100 text-gray-600",
};

// Service types
export const SERVICE_TYPES = {
  sqft: ["interior_walls", "ceilings", "trim_doors"] as const,
  flat: ["cabinets", "prep_work", "repairs", "deck_fence", "touchups"] as const,
};

export const SERVICE_LABELS: Record<string, string> = {
  interior_walls: "Interior Walls",
  ceilings: "Ceilings",
  trim_doors: "Trim & Doors",
  cabinets: "Cabinets",
  prep_work: "Prep Work",
  repairs: "Repairs",
  deck_fence: "Deck / Fence",
  touchups: "Touch-ups",
};

// Default materials per service
export const SERVICE_MATERIALS: Record<string, string[]> = {
  interior_walls: ["Paint (gallons)", "Primer", "Rollers", "Brushes", "Tape", "Drop cloths"],
  ceilings: ["Ceiling paint", "Extension pole", "Rollers", "Tape"],
  trim_doors: ["Trim paint", "Brushes", "Sandpaper", "Tape"],
  cabinets: ["Cabinet paint", "Primer", "Brushes", "Sandpaper", "Degreaser"],
  prep_work: ["Spackle", "Sandpaper", "Caulk", "Primer"],
  repairs: ["Spackle", "Drywall patch", "Joint compound", "Sandpaper"],
  deck_fence: ["Stain/Paint", "Pressure washer", "Brushes", "Rollers"],
  touchups: ["Touch-up paint", "Small brushes", "Spackle"],
};

// Theme options
export const THEMES = [
  { id: "agreeable-gray", name: "Agreeable Gray", color: "#d1ccc4" },
  { id: "alabaster", name: "Alabaster", color: "#f3ede5" },
  { id: "pure-white", name: "Pure White", color: "#f8f8f8" },
  { id: "extra-white", name: "Extra White", color: "#fcfcfc" },
  { id: "iron-ore", name: "Iron Ore", color: "#434343" },
  { id: "urbane-bronze", name: "Urbane Bronze", color: "#54504a" },
  { id: "tricorn-black", name: "Tricorn Black", color: "#2f2f2f" },
  { id: "drift-of-mist", name: "Drift of Mist", color: "#e8e3db" },
  { id: "shoji-white", name: "Shoji White", color: "#ebe6dd" },
  { id: "accessible-beige", name: "Accessible Beige", color: "#d4cfc4" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

