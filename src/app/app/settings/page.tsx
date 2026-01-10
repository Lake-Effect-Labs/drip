import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/app/settings/settings-view";

export default async function SettingsPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get company user (use admin client to avoid RLS issues)
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!companyUser) {
    redirect("/signup");
  }

  // Get company separately
  const { data: companyData } = await adminSupabase
    .from("companies")
    .select("id, name, theme_id, owner_user_id, created_at")
    .eq("id", companyUser.company_id)
    .maybeSingle();

  if (!companyData) {
    redirect("/signup");
  }

  const company = companyData;
  const isOwner = company.owner_user_id === user.id;

  // Redirect non-owners away from settings
  if (!isOwner) {
    redirect("/app/board");
  }

  // Get estimating config (use admin client)
  const { data: config } = await adminSupabase
    .from("estimating_config")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  // Get team members
  const { data: companyUsers } = await adminSupabase
    .from("company_users")
    .select("user_id, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: true });

  const members = [];
  if (companyUsers) {
    for (const cu of companyUsers) {
      const { data: authUser } = await adminSupabase.auth.admin.getUserById(cu.user_id);
      if (authUser.user) {
        members.push({
          id: cu.user_id,
          email: authUser.user.email || "",
          fullName: authUser.user.user_metadata?.full_name || authUser.user.email || "Unknown",
          joinedAt: cu.created_at,
        });
      }
    }
  }

  // Get invite links
  const { data: inviteLinks } = await adminSupabase
    .from("invite_links")
    .select("*")
    .eq("company_id", company.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Get pickup locations
  const { data: pickupLocations } = await adminSupabase
    .from("pickup_locations")
    .select("*")
    .eq("company_id", company.id)
    .order("name", { ascending: true });

  return (
    <SettingsView
      company={company}
      isOwner={isOwner}
      currentUserId={user.id}
      currentUserEmail={user.email || ""}
      config={config}
      teamMembers={members}
      inviteLinks={inviteLinks || []}
      pickupLocations={pickupLocations || []}
    />
  );
}
