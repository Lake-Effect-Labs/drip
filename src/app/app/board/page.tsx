import { createClient } from "@/lib/supabase/server";
import { getJobsWithCustomers, getTeamMembers } from "@/lib/supabase/queries";
import { BoardView } from "@/components/app/board/board-view";

export default async function BoardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) return null;

  // Fetch jobs with customers
  const jobs = await getJobsWithCustomers(supabase, companyUser.company_id);

  // Fetch team members
  const members = await getTeamMembers(supabase, companyUser.company_id);

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

