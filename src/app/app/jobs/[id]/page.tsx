import { notFound } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getTeamMembers } from "@/lib/supabase/queries";
import { JobDetailView } from "@/components/app/jobs/job-detail-view";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID (use admin client to avoid RLS issues)
  const { data: companyUser } = await adminSupabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!companyUser) return null;

  // Fetch job (use admin client)
  const { data: job } = await adminSupabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyUser.company_id)
    .maybeSingle();

  if (!job) {
    notFound();
  }

  // Fetch customer if exists (use admin client)
  let customer = null;
  if (job.customer_id) {
    const { data } = await adminSupabase
      .from("customers")
      .select("*")
      .eq("id", job.customer_id)
      .maybeSingle();
    customer = data;
  }

  const jobWithCustomer = { ...job, customer };

  // Fetch estimates for this job (use admin client)
  const { data: estimatesData } = await adminSupabase
    .from("estimates")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Fetch line items and materials for estimates (use admin client)
  const estimates = await Promise.all(
    (estimatesData || []).map(async (est) => {
      const [lineItemsResult, materialsResult] = await Promise.all([
        adminSupabase
          .from("estimate_line_items")
          .select("*")
          .eq("estimate_id", est.id),
        adminSupabase
          .from("estimate_materials")
          .select("*")
          .eq("estimate_id", est.id),
      ]);
      return { 
        ...est, 
        line_items: lineItemsResult.data || [],
        materials: materialsResult.data || [],
      };
    })
  );

  // Fetch invoices for this job (use admin client)
  const { data: invoices } = await adminSupabase
    .from("invoices")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Fetch materials for this job (use admin client)
  const { data: materials } = await adminSupabase
    .from("job_materials")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  // Fetch team members (use admin client)
  const members = await getTeamMembers(adminSupabase, companyUser.company_id);

  // Fetch estimating config, payment line items, and pickup locations in parallel
  const [estimatingConfigResult, paymentLineItemsResult, pickupLocationsResult] = await Promise.all([
    adminSupabase
      .from("estimating_config")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .single(),
    adminSupabase
      .from("job_payment_line_items")
      .select("id, title, price")
      .eq("job_id", id)
      .order("sort_order"),
    adminSupabase
      .from("pickup_locations")
      .select("id, name")
      .eq("company_id", companyUser.company_id)
      .order("name"),
  ]);

  const estimatingConfig = estimatingConfigResult.data;
  const paymentLineItems = paymentLineItemsResult.data || [];
  const pickupLocations = pickupLocationsResult.data || [];

  return (
    <JobDetailView
      job={jobWithCustomer}
      estimates={estimates}
      invoices={invoices || []}
      materials={materials || []}
      teamMembers={members}
      companyId={companyUser.company_id}
      estimatingConfig={estimatingConfig}
      paymentLineItems={paymentLineItems}
      pickupLocations={pickupLocations}
    />
  );
}

