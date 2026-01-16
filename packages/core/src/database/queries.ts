import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Get all team members for a company
 */
export async function getTeamMembers(
  supabase: SupabaseClient<Database>,
  companyId: string
) {
  // Get company users
  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("user_id")
    .eq("company_id", companyId);

  if (!companyUsers || companyUsers.length === 0) {
    return [];
  }

  // Get user profiles
  const userIds = companyUsers.map((cu) => cu.user_id);
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  return (
    profiles?.map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name || p.email,
    })) || []
  );
}

/**
 * Get all jobs with their associated customers for a company
 */
export async function getJobsWithCustomers(
  supabase: SupabaseClient<Database>,
  companyId: string
) {
  // Get jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (!jobs || jobs.length === 0) {
    return [];
  }

  // Get unique customer IDs
  const customerIds = [...new Set(jobs.filter((j) => j.customer_id).map((j) => j.customer_id!))];

  // Get customers
  const { data: customers } = customerIds.length > 0
    ? await supabase
        .from("customers")
        .select("*")
        .in("id", customerIds)
    : { data: [] };

  const customerMap = new Map(customers?.map((c) => [c.id, c]) || []);

  return jobs.map((job) => ({
    ...job,
    customer: job.customer_id ? customerMap.get(job.customer_id) || null : null,
  }));
}

/**
 * Get all scheduled jobs with their customers for a company
 */
export async function getScheduledJobs(
  supabase: SupabaseClient<Database>,
  companyId: string
) {
  // Get scheduled jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true });

  if (!jobs || jobs.length === 0) {
    return [];
  }

  // Get unique customer IDs
  const customerIds = [...new Set(jobs.filter((j) => j.customer_id).map((j) => j.customer_id!))];

  // Get customers
  const { data: customers } = customerIds.length > 0
    ? await supabase
        .from("customers")
        .select("*")
        .in("id", customerIds)
    : { data: [] };

  const customerMap = new Map(customers?.map((c) => [c.id, c]) || []);

  return jobs.map((job) => ({
    ...job,
    customer: job.customer_id ? customerMap.get(job.customer_id) || null : null,
  }));
}

/**
 * Get dashboard data for a company
 * Includes active jobs, outstanding payments, low inventory, and time tracking
 */
export async function getDashboardData(
  supabase: SupabaseClient<Database>,
  companyId: string
) {
  // Fetch all data in parallel
  const [jobsResult, inventoryResult, timeEntriesResult] = await Promise.all([
    // Active jobs and outstanding payments
    supabase
      .from("jobs")
      .select("id, status, payment_state, payment_amount")
      .eq("company_id", companyId),

    // Low inventory items
    supabase
      .from("inventory_items")
      .select("id, name, on_hand, reorder_at, unit")
      .eq("company_id", companyId),

    // Time entries for today and this week
    supabase
      .from("time_entries")
      .select("duration_seconds, started_at")
      .eq("company_id", companyId),
  ]);

  const jobs = jobsResult.data || [];
  const inventoryItems = inventoryResult.data || [];
  const timeEntries = timeEntriesResult.data || [];

  // Calculate active jobs count
  const activeJobs = jobs.filter((j) =>
    ["scheduled", "in_progress"].includes(j.status)
  ).length;

  // Calculate outstanding payments (jobs with payment_state = "due")
  const outstandingPayments = jobs
    .filter((j) => j.payment_state === "due" && j.payment_amount)
    .reduce((sum, j) => sum + (j.payment_amount || 0), 0);

  // Find low inventory items (on_hand <= reorder_at)
  const lowInventoryItems = inventoryItems.filter(
    (item) => item.on_hand <= item.reorder_at && item.reorder_at > 0
  );

  // Calculate time tracking summary
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of week (Sunday)

  const todayEntries = timeEntries.filter((entry) => {
    const entryDate = new Date(entry.started_at);
    return entryDate >= startOfToday && entry.duration_seconds;
  });

  const weekEntries = timeEntries.filter((entry) => {
    const entryDate = new Date(entry.started_at);
    return entryDate >= startOfWeek && entry.duration_seconds;
  });

  const todayHours = todayEntries.reduce((sum, entry) =>
    sum + (entry.duration_seconds || 0), 0
  ) / 3600;

  const weekHours = weekEntries.reduce((sum, entry) =>
    sum + (entry.duration_seconds || 0), 0
  ) / 3600;

  return {
    activeJobs,
    outstandingPayments,
    lowInventoryCount: lowInventoryItems.length,
    lowInventoryItems: lowInventoryItems.slice(0, 5), // Limit to 5 for display
    todayHours: Math.round(todayHours * 10) / 10, // Round to 1 decimal
    weekHours: Math.round(weekHours * 10) / 10,
    hasTimeTracking: timeEntries.length > 0,
  };
}
