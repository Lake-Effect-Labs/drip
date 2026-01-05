import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's company membership
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) {
    // User has no company - shouldn't happen normally
    redirect("/signup");
  }

  // Get company details
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, theme_id")
    .eq("id", companyUser.company_id)
    .single();

  if (!company) {
    redirect("/signup");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <AppShell
      user={{
        id: user.id,
        email: user.email!,
        fullName: profile?.full_name || user.email!,
      }}
      company={{
        id: company.id,
        name: company.name,
        themeId: company.theme_id,
      }}
    >
      {children}
    </AppShell>
  );
}

