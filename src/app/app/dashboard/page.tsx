import { createClient, createAdminClient } from "@/lib/supabase/server";
import { DashboardView } from "@/components/app/dashboard/dashboard-view";

export default async function DashboardPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!companyUser) return null;

  // Get job stats
  const { data: jobs } = await adminSupabase
    .from("jobs")
    .select("id, status, created_at, customer_id")
    .eq("company_id", companyUser.company_id);

  // Get invoice stats
  const { data: invoices } = await adminSupabase
    .from("invoices")
    .select("amount_total, status, created_at")
    .eq("company_id", companyUser.company_id);

  // Calculate stats
  const totalJobs = jobs?.length || 0;
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.amount_total || 0), 0) || 0;
  
  // Jobs this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const jobsThisWeek = jobs?.filter(
    job => new Date(job.created_at) >= weekAgo
  ).length || 0;

  // Jobs by status
  const jobsByStatus = (jobs || []).reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardView
      totalJobs={totalJobs}
      totalRevenue={totalRevenue}
      jobsThisWeek={jobsThisWeek}
      jobsByStatus={jobsByStatus}
    />
  );
}
