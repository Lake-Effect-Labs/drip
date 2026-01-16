import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@drip/core/database/server";
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

  // Get user's company membership - use admin client to bypass RLS
  const adminSupabase = createAdminClient();
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // If no company_users record, check for orphaned company and auto-link
  if (!companyUser) {
    const { data: orphanedCompany } = await adminSupabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (orphanedCompany) {
      // Auto-link the user to their company
      await adminSupabase.from("company_users").insert({
        company_id: orphanedCompany.id,
        user_id: user.id,
      });
      
      // Re-fetch with the new link
      const { data: linkedCompanyUser } = await adminSupabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (!linkedCompanyUser) {
        redirect("/signup");
      }
      
      // Use the linked company
      const { data: company } = await adminSupabase
        .from("companies")
        .select("id, name, theme_id, owner_user_id, created_at")
        .eq("id", linkedCompanyUser.company_id)
        .maybeSingle();

      if (!company) {
        redirect("/signup");
      }

      // Check if user is owner
      const isOwner = company.owner_user_id === user.id;

      // Get user profile
      const { data: profile } = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

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
          isOwner={isOwner}
        >
          {children}
        </AppShell>
      );
    }

    // No company found at all
    redirect("/signup");
  }

  // Get company details (use admin client to avoid RLS issues)
  const { data: company } = await adminSupabase
    .from("companies")
    .select("id, name, theme_id, owner_user_id, created_at")
    .eq("id", companyUser.company_id)
    .maybeSingle();

  if (!company) {
    redirect("/signup");
  }

  // Check if user is owner
  const isOwner = company.owner_user_id === user.id;

  // Get user profile (use admin client)
  const { data: profile } = await adminSupabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

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
      isOwner={isOwner}
    >
      {children}
    </AppShell>
  );
}

