import { createClient, createAdminClient } from "@/lib/supabase/server";
import { SettingsViewLite } from "@/components/app/settings/settings-view-lite";

// Drip-lite: Simplified settings - just company name and estimating rate
export default async function SettingsPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company user (use admin client to avoid RLS issues)
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!companyUser) return null;

  // Get company (use admin client)
  const { data: company } = await adminSupabase
    .from("companies")
    .select("*")
    .eq("id", companyUser.company_id)
    .maybeSingle();

  if (!company) return null;

  // Get estimating config (use admin client)
  const { data: config } = await adminSupabase
    .from("estimating_config")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  return (
    <SettingsViewLite
      company={company}
      config={config}
    />
  );
}
