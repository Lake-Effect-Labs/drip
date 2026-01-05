import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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

