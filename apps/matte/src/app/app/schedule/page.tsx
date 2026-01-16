import { createClient, createAdminClient } from "@drip/core/database/server";
import { getScheduledJobs, getTeamMembers } from "@drip/core/database/queries";
import { ScheduleView } from "@/components/app/schedule/schedule-view";

export default async function SchedulePage() {
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

  // Fetch scheduled jobs
  const jobs = await getScheduledJobs(adminSupabase, companyUser.company_id);

  // Fetch team members
  const members = await getTeamMembers(adminSupabase, companyUser.company_id);

  return (
    <ScheduleView
      initialJobs={jobs}
      teamMembers={members}
      currentUserId={user.id}
    />
  );
}
