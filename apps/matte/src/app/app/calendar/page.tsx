import { createClient } from "@drip/core/database/server";
import { getScheduledJobs, getTeamMembers } from "@drip/core/database/queries";
import { CalendarView } from "@/components/app/calendar/calendar-view";

export default async function CalendarPage() {
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

  // Fetch scheduled jobs
  const jobs = await getScheduledJobs(supabase, companyUser.company_id);

  // Fetch team members
  const members = await getTeamMembers(supabase, companyUser.company_id);

  return (
    <CalendarView
      initialJobs={jobs}
      teamMembers={members}
      currentUserId={user.id}
    />
  );
}

