// Data aggregation queries for Matte
// Each function returns only the data needed for responses

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency, formatDate } from "@/lib/utils";

interface UnpaidInvoicesData {
  count: number;
  total: number;
  invoices: Array<{ id: string; customerName: string; amount: number; created: string }>;
}

interface JobsData {
  count: number;
  jobs: Array<{ id: string; title: string; customerName: string; status: string; scheduledDate?: string }>;
}

interface MaterialsData {
  materials: Array<{ name: string; jobTitle: string; customerName: string }>;
}

interface PaymentsData {
  count: number;
  total: number;
  payments: Array<{ amount: number; customerName: string; date: string }>;
}

interface FocusData {
  jobsToday: number;
  unpaidInvoices: number;
  unpaidTotal: number;
}

export async function getUnpaidInvoices(
  supabase: SupabaseClient,
  companyId: string
): Promise<UnpaidInvoicesData> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount_total, created_at, customer:customers(name)")
    .eq("company_id", companyId)
    .neq("status", "paid")
    .order("created_at", { ascending: false });

  const invoicesList = (invoices || []).map((inv) => ({
    id: inv.id,
    customerName: (inv.customer as any)?.name || "Unknown",
    amount: inv.amount_total,
    created: inv.created_at,
  }));

  const total = invoicesList.reduce((sum, inv) => sum + inv.amount, 0);

  return {
    count: invoicesList.length,
    total,
    invoices: invoicesList.slice(0, 10), // Limit to 10 for response
  };
}

export async function getOverdueInvoices(
  supabase: SupabaseClient,
  companyId: string
): Promise<UnpaidInvoicesData> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount_total, created_at, customer:customers(name)")
    .eq("company_id", companyId)
    .neq("status", "paid")
    .lt("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const invoicesList = (invoices || []).map((inv) => ({
    id: inv.id,
    customerName: (inv.customer as any)?.name || "Unknown",
    amount: inv.amount_total,
    created: inv.created_at,
  }));

  const total = invoicesList.reduce((sum, inv) => sum + inv.amount, 0);

  return {
    count: invoicesList.length,
    total,
    invoices: invoicesList.slice(0, 10),
  };
}

export async function getPaymentsThisWeek(
  supabase: SupabaseClient,
  companyId: string
): Promise<PaymentsData> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Get invoices for company
  const { data: companyInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("company_id", companyId);

  const invoiceIds = companyInvoices?.map((i) => i.id) || [];

  if (invoiceIds.length === 0) {
    return { count: 0, total: 0, payments: [] };
  }

  // Get payments for those invoices
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount, paid_at, invoice:invoices(customer:customers(name))")
    .in("invoice_id", invoiceIds)
    .gte("paid_at", weekAgo.toISOString())
    .order("paid_at", { ascending: false });

  const paymentsList = (payments || []).map((p) => ({
    amount: p.amount,
    customerName: (p.invoice as any)?.customer?.name || "Unknown",
    date: p.paid_at,
  }));

  const total = paymentsList.reduce((sum, p) => sum + p.amount, 0);

  return {
    count: paymentsList.length,
    total,
    payments: paymentsList.slice(0, 10),
  };
}

export async function getJobsForDate(
  supabase: SupabaseClient,
  companyId: string,
  date: Date
): Promise<JobsData> {
  // Format date in local timezone (YYYY-MM-DD) to match database DATE type
  // Use local date methods to avoid UTC timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextYear = nextDay.getFullYear();
  const nextMonth = String(nextDay.getMonth() + 1).padStart(2, "0");
  const nextDayNum = String(nextDay.getDate()).padStart(2, "0");
  const nextDayStr = `${nextYear}-${nextMonth}-${nextDayNum}`;

  // Query jobs - scheduled_date is DATE type, so we compare as strings
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, title, status, scheduled_date, scheduled_time, customer:customers(name)")
    .eq("company_id", companyId)
    .not("scheduled_date", "is", null)
    .gte("scheduled_date", dateStr)
    .lt("scheduled_date", nextDayStr)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error fetching jobs for date:", error);
    return { count: 0, jobs: [] };
  }

  const jobsList = (jobs || []).map((job) => ({
    id: job.id,
    title: job.title,
    customerName: (job.customer as any)?.name || "Unknown",
    status: job.status,
    scheduledDate: job.scheduled_date,
  }));

  return {
    count: jobsList.length,
    jobs: jobsList,
  };
}

export async function getJobsInProgress(
  supabase: SupabaseClient,
  companyId: string
): Promise<JobsData> {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, customer:customers(name)")
    .eq("company_id", companyId)
    .in("status", ["in_progress", "scheduled"])
    .order("updated_at", { ascending: false });

  const jobsList = (jobs || []).map((job) => ({
    id: job.id,
    title: job.title,
    customerName: (job.customer as any)?.name || "Unknown",
    status: job.status,
  }));

  return {
    count: jobsList.length,
    jobs: jobsList.slice(0, 10),
  };
}

export async function getStuckJobs(
  supabase: SupabaseClient,
  companyId: string
): Promise<JobsData> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, updated_at, customer:customers(name)")
    .eq("company_id", companyId)
    .lt("updated_at", twoWeeksAgo.toISOString())
    .in("status", ["scheduled", "in_progress", "estimate_sent"])
    .order("updated_at", { ascending: true });

  const jobsList = (jobs || []).map((job) => ({
    id: job.id,
    title: job.title,
    customerName: (job.customer as any)?.name || "Unknown",
    status: job.status,
  }));

  return {
    count: jobsList.length,
    jobs: jobsList.slice(0, 10),
  };
}

export async function getMaterialsForDate(
  supabase: SupabaseClient,
  companyId: string,
  date: Date
): Promise<MaterialsData> {
  const dateStr = date.toISOString().split("T")[0];
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split("T")[0];

  // Get jobs for date
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, scheduled_date, customer:customers(name)")
    .eq("company_id", companyId)
    .gte("scheduled_date", dateStr)
    .lt("scheduled_date", nextDayStr);

  if (!jobs || jobs.length === 0) {
    return { materials: [] };
  }

  const jobIds = jobs.map((j) => j.id);

  // Get materials for those jobs
  const { data: materials } = await supabase
    .from("job_materials")
    .select("name, job:jobs(title, customer:customers(name))")
    .in("job_id", jobIds)
    .eq("checked", false);

  const materialsList = (materials || []).map((m) => ({
    name: m.name,
    jobTitle: (m.job as any)?.title || "Unknown",
    customerName: (m.job as any)?.customer?.name || "Unknown",
  }));

  return {
    materials: materialsList.slice(0, 20),
  };
}

export async function getJobsMissingMaterials(
  supabase: SupabaseClient,
  companyId: string
): Promise<JobsData> {
  // Get active jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, customer:customers(name)")
    .eq("company_id", companyId)
    .in("status", ["scheduled", "in_progress"]);

  if (!jobs || jobs.length === 0) {
    return { count: 0, jobs: [] };
  }

  const jobIds = jobs.map((j) => j.id);

  // Get jobs that have materials
  const { data: materials } = await supabase
    .from("job_materials")
    .select("job_id")
    .in("job_id", jobIds);

  const jobsWithMaterials = new Set((materials || []).map((m) => m.job_id));

  // Find jobs without materials
  const jobsWithoutMaterials = jobs
    .filter((job) => !jobsWithMaterials.has(job.id))
    .map((job) => ({
      id: job.id,
      title: job.title,
      customerName: (job.customer as any)?.name || "Unknown",
      status: job.status,
    }));

  return {
    count: jobsWithoutMaterials.length,
    jobs: jobsWithoutMaterials.slice(0, 10),
  };
}

export async function getFocusToday(
  supabase: SupabaseClient,
  companyId: string
): Promise<FocusData> {
  const today = new Date();
  const jobsToday = await getJobsForDate(supabase, companyId, today);
  const unpaid = await getUnpaidInvoices(supabase, companyId);

  return {
    jobsToday: jobsToday.count,
    unpaidInvoices: unpaid.count,
    unpaidTotal: unpaid.total,
  };
}

export async function getGeneralSummary(
  supabase: SupabaseClient,
  companyId: string
): Promise<{
  totalJobs: number;
  activeJobs: number;
  totalInvoiced: number;
  totalPaid: number;
  unpaidCount: number;
}> {
  const [jobs, invoices, unpaid] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status")
      .eq("company_id", companyId),
    supabase
      .from("invoices")
      .select("id, amount_total, status")
      .eq("company_id", companyId),
    getUnpaidInvoices(supabase, companyId),
  ]);

  const jobsList = jobs.data || [];
  const invoicesList = invoices.data || [];

  const activeJobs = jobsList.filter((j) =>
    ["scheduled", "in_progress"].includes(j.status)
  ).length;

  const totalInvoiced = invoicesList.reduce((sum, inv) => sum + inv.amount_total, 0);

  // Get paid invoices
  const paidInvoices = invoicesList.filter((inv) => inv.status === "paid");
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount_total, 0);

  return {
    totalJobs: jobsList.length,
    activeJobs,
    totalInvoiced,
    totalPaid,
    unpaidCount: unpaid.count,
  };
}
