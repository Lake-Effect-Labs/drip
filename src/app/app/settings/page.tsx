import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/app/settings/settings-view";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company user
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) return null;

  // Get company
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyUser.company_id)
    .single();

  if (!company) return null;

  const isOwner = company.owner_user_id === user.id;

  // Get estimating config
  const { data: config } = await supabase
    .from("estimating_config")
    .select("*")
    .eq("company_id", company.id)
    .single();

  // Get team members (company_users)
  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("user_id, created_at")
    .eq("company_id", company.id);

  // Get user profiles for team members
  const userIds = companyUsers?.map((cu) => cu.user_id) || [];
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("user_profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
  const members = companyUsers?.map((cu) => {
    const profile = profileMap.get(cu.user_id);
    return {
      id: cu.user_id,
      email: profile?.email || "",
      fullName: profile?.full_name || "",
      joinedAt: cu.created_at,
    };
  }) || [];

  // Get invite links
  const { data: inviteLinks } = await supabase
    .from("invite_links")
    .select("*")
    .eq("company_id", company.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Get pickup locations
  const { data: locations } = await supabase
    .from("pickup_locations")
    .select("*")
    .eq("company_id", company.id)
    .order("name");

  return (
    <SettingsView
      company={company}
      isOwner={isOwner}
      currentUserId={user.id}
      config={config}
      teamMembers={members}
      inviteLinks={inviteLinks || []}
      pickupLocations={locations || []}
    />
  );
}

