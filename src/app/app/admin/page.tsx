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

  // Fetch all creator codes and affiliate profiles upfront
  const [
    { data: allProfiles },
    { data: creatorCodes },
  ] = await Promise.all([
    adminSupabase
      .from("user_profiles")
      .select("id, email, full_name, is_affiliate"),
    adminSupabase
      .from("creator_codes")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  // Build lookup maps
  const profileMap = new Map((allProfiles || []).map((p) => [p.id, p]));
  const codeByUserId = new Map((creatorCodes || []).map((c) => [c.user_id, c]));

  // For affiliates with codes, compute active subscriber counts
  const affiliateCodes = (creatorCodes || []).filter((c) => c.user_id);
  const activeSubCounts = new Map<string, number>();
  const referredSubscribers = new Map<string, { companyId: string; convertedAt: string }[]>();

  for (const code of affiliateCodes) {
    const { data: convertedReferrals } = await adminSupabase
      .from("referrals")
      .select("subscriber_company_id, converted_at")
      .eq("creator_code_id", code.id)
      .not("converted_at", "is", null);

    let activeCount = 0;
    const subs: { companyId: string; convertedAt: string }[] = [];

    if (convertedReferrals) {
      for (const ref of convertedReferrals) {
        if (ref.subscriber_company_id) {
          const { data: comp } = await adminSupabase
            .from("companies")
            .select("subscription_status")
            .eq("id", ref.subscriber_company_id)
            .maybeSingle();

          if ((comp as any)?.subscription_status === "active") {
            activeCount++;
          }
          subs.push({
            companyId: ref.subscriber_company_id,
            convertedAt: ref.converted_at!,
          });
        }
      }
    }

    activeSubCounts.set(code.user_id!, activeCount);
    referredSubscribers.set(code.user_id!, subs);
  }

  // Build unified company data with affiliate info merged
  const companyData = [];
  for (const company of companies || []) {
    const { count: jobCount } = await adminSupabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);

    const { count: crewCount } = await adminSupabase
      .from("company_users")
      .select("user_id", { count: "exact", head: true })
      .eq("company_id", company.id);

    const ownerProfile = profileMap.get(company.owner_user_id);
    const isAffiliate = ownerProfile?.is_affiliate ?? false;
    const code = codeByUserId.get(company.owner_user_id);

    // Calculate months paying
    const createdDate = new Date(company.created_at);
    const now = new Date();
    const monthsPaying = (company as any).subscription_status === "active"
      ? Math.max(1, Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 0;

    // Get referred subscriber details for this affiliate
    const referredSubs = referredSubscribers.get(company.owner_user_id) || [];
    // Enrich with company names
    const enrichedSubs = [];
    for (const sub of referredSubs) {
      const refCompany = (companies || []).find((c) => c.id === sub.companyId);
      const refProfile = refCompany ? profileMap.get(refCompany.owner_user_id) : null;
      const refStatus = (refCompany as any)?.subscription_status || "unknown";
      const convertedDate = new Date(sub.convertedAt);
      const subMonths = refStatus === "active"
        ? Math.max(1, Math.floor((now.getTime() - convertedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : 0;

      enrichedSubs.push({
        companyName: refCompany?.name || "Unknown",
        ownerEmail: refProfile?.email || "unknown",
        subscriptionStatus: refStatus,
        monthsPaying: subMonths,
        convertedAt: sub.convertedAt,
      });
    }

    companyData.push({
      id: company.id,
      name: company.name,
      ownerUserId: company.owner_user_id,
      ownerEmail: ownerProfile?.email || "unknown",
      ownerName: ownerProfile?.full_name || ownerProfile?.email || "unknown",
      subscriptionStatus: (company as any).subscription_status || "trialing",
      jobCount: jobCount || 0,
      crewCount: crewCount || 0,
      createdAt: company.created_at,
      monthsPaying,
      isAffiliate,
      affiliate: isAffiliate && code
        ? {
            code: code.code,
            totalReferrals: code.total_referrals,
            totalConversions: code.total_conversions,
            activeSubscriberCount: activeSubCounts.get(company.owner_user_id) || 0,
            referredSubscribers: enrichedSubs,
          }
        : null,
    });
  }

  return <AdminView companies={companyData} />;
}
