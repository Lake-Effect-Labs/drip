import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getJobsWithCustomers, getTeamMembers } from "@/lib/supabase/queries";
import { BoardView } from "@/components/app/board/board-view";

// Ensure this page is always dynamically rendered with fresh data
export const dynamic = 'force-dynamic';

export default async function BoardPage() {
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

  // Fetch company, jobs, and team members in parallel
  const [companyResult, jobs, members] = await Promise.all([
    adminSupabase
      .from("companies")
      .select("subscription_status")
      .eq("id", companyUser.company_id)
      .single(),
    getJobsWithCustomers(adminSupabase, companyUser.company_id),
    getTeamMembers(adminSupabase, companyUser.company_id),
  ]);

  const company = companyResult.data;

  // Determine if user is at trial limit (trialing/canceled + 1 or more jobs)
  const isTrialing = company?.subscription_status === "trialing" || company?.subscription_status === "canceled";
  const isAtTrialLimit = isTrialing && jobs.length >= 1;

  return (
    <div className="h-full">
      <BoardView
        initialJobs={jobs}
        teamMembers={members}
        currentUserId={user.id}
        companyId={companyUser.company_id}
        subscriptionStatus={company?.subscription_status || "trialing"}
        isAtTrialLimit={isAtTrialLimit}
      />
    </div>
  );
}

