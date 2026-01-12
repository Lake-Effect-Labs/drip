// Data aggregation queries for Matte
// Each function returns only the data needed for responses

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  materials: Array<{
    name: string;
    jobTitle?: string;
    customerName?: string;
    paintColor?: string;
    sheen?: string;
    productLine?: string;
    gallons?: number | null;
    checked?: boolean;
    notes?: string | null;
  }>;
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
  // Normalize the target date to YYYY-MM-DD format
  // Use UTC to avoid timezone issues - get the date components in local time but format as UTC date string
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();
  
  // Create a date string in YYYY-MM-DD format
  const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

  // Fetch all jobs with scheduled dates for this company
  const { data: allJobs, error } = await supabase
    .from("jobs")
    .select("id, title, status, scheduled_date, scheduled_time, customer:customers(name)")
    .eq("company_id", companyId)
    .not("scheduled_date", "is", null);

  if (error) {
    console.error("Error fetching jobs for date:", error, "Target date:", targetDateStr);
    return { count: 0, jobs: [] };
  }

  // Filter jobs where scheduled_date matches the target date
  // scheduled_date is a DATE type, so it should be in YYYY-MM-DD format
  // But handle both DATE (YYYY-MM-DD) and TIMESTAMP (YYYY-MM-DDTHH:mm:ss) formats
  const matchingJobs = (allJobs || []).filter((job) => {
    if (!job.scheduled_date) return false;
    
    // Extract date part - handle both formats
    let jobDateStr: string;
    if (job.scheduled_date.includes("T")) {
      // It's a timestamp, extract date part
      jobDateStr = job.scheduled_date.split("T")[0];
    } else {
      // It's already a date string
      jobDateStr = job.scheduled_date;
    }
    
    // Normalize both dates for comparison (remove any trailing time/zone info)
    const normalizedJobDate = jobDateStr.trim();
    const normalizedTargetDate = targetDateStr.trim();
    
    const matches = normalizedJobDate === normalizedTargetDate;
    
    // Always log in development to debug
    if (process.env.NODE_ENV === "development" && allJobs && allJobs.length < 10) {
      console.log(`Comparing: "${normalizedJobDate}" === "${normalizedTargetDate}" = ${matches}`);
    }
    
    return matches;
  });

  // Sort by scheduled_date then scheduled_time
  matchingJobs.sort((a, b) => {
    if (a.scheduled_date !== b.scheduled_date) {
      return (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
    }
    const timeA = a.scheduled_time || "00:00";
    const timeB = b.scheduled_time || "00:00";
    return timeA.localeCompare(timeB);
  });

  // Always log for debugging
  console.log("getJobsForDate - Target date:", targetDateStr);
  console.log("getJobsForDate - All jobs with dates:", allJobs?.length || 0);
  console.log("getJobsForDate - Matching jobs:", matchingJobs.length);
  if (allJobs && allJobs.length > 0) {
    console.log("getJobsForDate - All job scheduled dates:", allJobs.map(j => ({
      id: j.id,
      title: j.title,
      scheduled_date: j.scheduled_date,
      datePart: j.scheduled_date?.split("T")[0],
      matches: j.scheduled_date?.split("T")[0] === targetDateStr
    })));
  } else {
    console.log("getJobsForDate - No jobs found with scheduled_date");
  }

  const jobsList = matchingJobs.map((job) => ({
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

// New flexible query functions for entity-based queries

export async function getJobsByNameOrCustomer(
  supabase: SupabaseClient,
  companyId: string,
  searchTerm: string
): Promise<JobsData> {
  // Clean up search term - remove common words
  const cleanedTerm = searchTerm.toLowerCase().trim();
  
  // If search term is too generic, return empty
  if (cleanedTerm === 'my' || cleanedTerm === 'all' || cleanedTerm.length < 2) {
    return { count: 0, jobs: [] };
  }
  
  // Search by job title or customer name (case-insensitive, partial match)
  // Split search term into words and search for any word matching
  const words = cleanedTerm.split(/\s+/).filter(w => w.length > 1);
  
  let query = supabase
    .from("jobs")
    .select("id, title, status, scheduled_date, customer:customers(name)")
    .eq("company_id", companyId);
  
  // Build OR conditions for each word
  if (words.length > 0) {
    const conditions = words.map(word => 
      `title.ilike.%${word}%,customer.name.ilike.%${word}%`
    ).join(',');
    query = query.or(conditions);
  } else {
    query = query.or(`title.ilike.%${cleanedTerm}%,customer.name.ilike.%${cleanedTerm}%`);
  }

  const { data: jobs } = await query;

  const jobsList = (jobs || []).map((job) => ({
    id: job.id,
    title: job.title,
    customerName: (job.customer as any)?.name || "Unknown",
    status: job.status,
    scheduledDate: job.scheduled_date,
  }));

  return {
    count: jobsList.length,
    jobs: jobsList.slice(0, 10),
  };
}

interface EstimateData {
  count: number;
  total: number;
  estimates: Array<{
    id: string;
    status: string;
    sqft: number | null;
    acceptedAt: string | null;
    lineItems: Array<{ name: string; price: number; paintColor?: string; sheen?: string }>;
    total: number;
  }>;
}

export async function getEstimatesForJob(
  supabase: SupabaseClient,
  companyId: string,
  jobId: string
): Promise<EstimateData> {
  const { data: estimates } = await supabase
    .from("estimates")
    .select("id, status, sqft, accepted_at, line_items:estimate_line_items(name, price, paint_color_name_or_code, sheen)")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  const estimatesList = (estimates || []).map((est) => {
    const lineItems = (est.line_items as any[]) || [];
    const total = lineItems.reduce((sum, item) => sum + (item.price || 0), 0);

    return {
      id: est.id,
      status: est.status,
      sqft: est.sqft,
      acceptedAt: est.accepted_at,
      lineItems: lineItems.slice(0, 10).map((item) => ({
        name: item.name,
        price: item.price,
        paintColor: item.paint_color_name_or_code,
        sheen: item.sheen,
      })),
      total,
    };
  });

  const total = estimatesList.reduce((sum, est) => sum + (est.total || 0), 0);

  return {
    count: estimatesList.length,
    total,
    estimates: estimatesList as any,
  };
}

export async function getMaterialsForJob(
  supabase: SupabaseClient,
  companyId: string,
  jobId: string
): Promise<MaterialsData> {
  // Get materials from job_materials table
  const { data: jobMaterials } = await supabase
    .from("job_materials")
    .select("name, checked, notes, job:jobs(title, customer:customers(name))")
    .eq("job_id", jobId);

  // Also get paint info from estimates if available
  const { data: estimates } = await supabase
    .from("estimates")
    .select("line_items:estimate_line_items(name, paint_color_name_or_code, sheen, product_line, gallons_estimate)")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .eq("status", "accepted");

  const materials: any[] = [];

  // Add job materials
  if (jobMaterials && jobMaterials.length > 0) {
    const job = (jobMaterials[0].job as any);
    materials.push(...jobMaterials.map((m) => ({
      name: m.name,
      jobTitle: job?.title || "Unknown",
      customerName: job?.customer?.name || "Unknown",
      checked: m.checked,
      notes: m.notes,
    })));
  }

  // Add paint from estimate line items
  if (estimates && estimates.length > 0) {
    for (const estimate of estimates) {
      const lineItems = (estimate.line_items as any[]) || [];
      for (const item of lineItems) {
        if (item.paint_color_name_or_code) {
          materials.push({
            name: item.name,
            paintColor: item.paint_color_name_or_code,
            sheen: item.sheen,
            productLine: item.product_line,
            gallons: item.gallons_estimate,
          });
        }
      }
    }
  }

  return {
    materials: materials.slice(0, 20),
  };
}

interface InvoiceData {
  count: number;
  total: number;
  invoices: Array<{ id: string; customerName: string; jobTitle: string; amount: number; status: string; created: string }>;
}

export async function getInvoicesForDateRange(
  supabase: SupabaseClient,
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<InvoiceData> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, amount_total, status, created_at, customer:customers(name), job:jobs(title)")
    .eq("company_id", companyId)
    .gte("created_at", startDate.toISOString())
    .lt("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  const invoicesList = (invoices || []).map((inv) => ({
    id: inv.id,
    customerName: (inv.customer as any)?.name || "Unknown",
    jobTitle: (inv.job as any)?.title || "Unknown",
    amount: inv.amount_total,
    status: inv.status,
    created: inv.created_at,
  }));

  const total = invoicesList.reduce((sum, inv) => sum + inv.amount, 0);

  return {
    count: invoicesList.length,
    total,
    invoices: invoicesList.slice(0, 10),
  };
}

interface CustomerData {
  customers: Array<{ name: string; unpaidCount: number; unpaidTotal: number }>;
}

export async function getCustomersWithUnpaidInvoices(
  supabase: SupabaseClient,
  companyId: string
): Promise<CustomerData> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, amount_total, customer:customers(name)")
    .eq("company_id", companyId)
    .neq("status", "paid")
    .order("created_at", { ascending: false });

  // Group by customer
  const customerMap = new Map<string, { name: string; unpaidCount: number; unpaidTotal: number }>();

  for (const invoice of invoices || []) {
    const customerId = invoice.customer_id;
    const customerName = (invoice.customer as any)?.name || "Unknown";
    const existing = customerMap.get(customerId) || { name: customerName, unpaidCount: 0, unpaidTotal: 0 };
    existing.unpaidCount += 1;
    existing.unpaidTotal += invoice.amount_total;
    customerMap.set(customerId, existing);
  }

  const customers = Array.from(customerMap.values()).slice(0, 10);

  return { customers };
}

interface RelationshipQueryData {
  count: number;
  jobs: Array<{
    id: string;
    title: string;
    customerName: string;
    estimateStatus: string;
    acceptedAt: string | null;
  }>;
}

export async function getJobsWithAcceptedEstimatesButNoInvoice(
  supabase: SupabaseClient,
  companyId: string
): Promise<RelationshipQueryData> {
  // Get all jobs with accepted estimates
  const { data: estimates } = await supabase
    .from("estimates")
    .select("job_id, status, accepted_at, job:jobs(id, title, customer:customers(name))")
    .eq("company_id", companyId)
    .eq("status", "accepted");

  if (!estimates || estimates.length === 0) {
    return { count: 0, jobs: [] };
  }

  const jobIds = estimates.map((e) => e.job_id).filter((id) => id !== null) as string[];

  // Get invoices for these jobs
  const { data: invoices } = await supabase
    .from("invoices")
    .select("job_id")
    .eq("company_id", companyId)
    .in("job_id", jobIds);

  const jobsWithInvoices = new Set((invoices || []).map((inv) => inv.job_id));

  // Filter estimates for jobs without invoices
  const jobsWithoutInvoices = estimates
    .filter((est) => est.job_id && !jobsWithInvoices.has(est.job_id))
    .map((est) => {
      const job = est.job as any;
      return {
        id: est.job_id!,
        title: job?.title || "Unknown",
        customerName: job?.customer?.name || "Unknown",
        estimateStatus: est.status,
        acceptedAt: est.accepted_at,
      };
    });

  return {
    count: jobsWithoutInvoices.length,
    jobs: jobsWithoutInvoices.slice(0, 10),
  };
}
