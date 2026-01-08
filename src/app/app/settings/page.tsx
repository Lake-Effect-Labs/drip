import { createClient } from "@/lib/supabase/server";
import { SettingsViewLite } from "@/components/app/settings/settings-view-lite";

// Drip-lite: Simplified settings - just company name and estimating rate
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

  // Get estimating config
  const { data: config } = await supabase
    .from("estimating_config")
    .select("*")
    .eq("company_id", company.id)
    .single();

  return (
    <SettingsViewLite
      company={company}
      config={config}
    />
  );
}
