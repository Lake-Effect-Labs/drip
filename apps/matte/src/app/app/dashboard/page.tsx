import { createClient, createAdminClient } from "@drip/core/database/server";
import { DashboardView } from "@/components/app/dashboard/dashboard-view";
import { getDashboardData } from "@drip/core/database/queries";

export default async function DashboardPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID (use admin client to avoid RLS issues)
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!companyUser) return null;

  // Fetch dashboard data
  const dashboardData = await getDashboardData(adminSupabase, companyUser.company_id);

  return <DashboardView data={dashboardData} />;
}
