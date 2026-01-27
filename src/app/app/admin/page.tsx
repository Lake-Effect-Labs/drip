import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminView } from "@/components/app/admin/admin-view";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check super admin status
  const { data: profile } = await adminSupabase
    .from("user_profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    redirect("/app/board");
  }

  // Fetch all companies with subscription info
  const { data: companies } = await adminSupabase
    .from("companies")
    .select("id, name, owner_user_id, subscription_status, stripe_customer_id, created_at")
    .order("created_at", { ascending: false });

  // Build company data with counts
  const companyData = [];
  for (const company of companies || []) {
    // Get job count
    const { count: jobCount } = await adminSupabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);

    // Get crew count
    const { count: crewCount } = await adminSupabase
      .from("company_users")
      .select("user_id", { count: "exact", head: true })
      .eq("company_id", company.id);

    // Get owner email
    const { data: ownerProfile } = await adminSupabase
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", company.owner_user_id)
      .maybeSingle();

    companyData.push({
      id: company.id,
      name: company.name,
      ownerEmail: ownerProfile?.email || "unknown",
      ownerName: ownerProfile?.full_name || ownerProfile?.email || "unknown",
      subscriptionStatus: (company as any).subscription_status || "trialing",
      jobCount: jobCount || 0,
      crewCount: crewCount || 0,
      createdAt: company.created_at,
    });
  }

  // Fetch all affiliates (users with is_affiliate = true)
  const { data: affiliateProfiles } = await adminSupabase
    .from("user_profiles")
    .select("id, email, full_name, is_affiliate")
    .eq("is_affiliate", true);

  // Fetch all creator codes
  const { data: creatorCodes } = await adminSupabase
    .from("creator_codes")
    .select("*")
    .order("created_at", { ascending: false });

  // For each affiliate with a creator code, count active subscribers who used their code
  const affiliateData = [];
  for (const affiliate of affiliateProfiles || []) {
    const code = (creatorCodes || []).find((c) => c.user_id === affiliate.id);

    let activeSubscriberCount = 0;
    if (code) {
      // Count referrals that converted (have a converted_at date)
      // and whose companies still have active subscriptions
      const { data: convertedReferrals } = await adminSupabase
        .from("referrals")
        .select("subscriber_company_id")
        .eq("creator_code_id", code.id)
        .not("converted_at", "is", null);

      if (convertedReferrals) {
        for (const ref of convertedReferrals) {
          if (ref.subscriber_company_id) {
            const { data: comp } = await adminSupabase
              .from("companies")
              .select("subscription_status")
              .eq("id", ref.subscriber_company_id)
              .maybeSingle();

            if ((comp as any)?.subscription_status === "active") {
              activeSubscriberCount++;
            }
          }
        }
      }
    }

    affiliateData.push({
      id: affiliate.id,
      email: affiliate.email,
      fullName: affiliate.full_name,
      creatorCode: code
        ? {
            id: code.id,
            code: code.code,
            totalReferrals: code.total_referrals,
            totalConversions: code.total_conversions,
            isActive: code.is_active,
          }
        : null,
      activeSubscriberCount,
    });
  }

  return (
    <AdminView
      companies={companyData}
      affiliates={affiliateData}
    />
  );
}
