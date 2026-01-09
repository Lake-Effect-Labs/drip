import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CrewView } from "@/components/app/crew/crew-view";

export default async function CrewPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get company
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id, companies!inner(id, name, owner_user_id)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!companyUser) {
    redirect("/signup");
  }

  const company = (companyUser as any).companies;
  const isOwner = company.owner_user_id === user.id;

  // Redirect non-owners away from crew page
  if (!isOwner) {
    redirect("/app/board");
  }

  // Get all team members
  const { data: companyUsers } = await adminSupabase
    .from("company_users")
    .select("user_id, created_at")
    .eq("company_id", companyUser.company_id)
    .order("created_at", { ascending: true });

  // Get user details from auth
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

  return (
    <CrewView
      companyId={companyUser.company_id}
      companyOwnerId={company.owner_user_id}
      currentUserId={user.id}
      isOwner={isOwner}
      teamMembers={members}
    />
  );
}
