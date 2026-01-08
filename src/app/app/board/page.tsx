import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getJobsWithCustomers, getTeamMembers } from "@/lib/supabase/queries";
import { BoardView } from "@/components/app/board/board-view";

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

  // Fetch jobs with customers (use admin client)
  const jobs = await getJobsWithCustomers(adminSupabase, companyUser.company_id);

  // Fetch team members (use admin client)
  const members = await getTeamMembers(adminSupabase, companyUser.company_id);

  return (
    <div className="h-full">
      <BoardView
        initialJobs={jobs}
        teamMembers={members}
        currentUserId={user.id}
        companyId={companyUser.company_id}
      />
    </div>
  );
}

