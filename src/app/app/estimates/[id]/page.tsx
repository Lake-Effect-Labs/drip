import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EstimateDetailView } from "@/components/app/estimates/estimate-detail-view";

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) return null;

  // Fetch estimate
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyUser.company_id)
    .single();

  if (!estimate) {
    notFound();
  }

  // Fetch line items
  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", id);

  // Fetch materials
  const { data: materials } = await supabase
    .from("estimate_materials")
    .select("*")
    .eq("estimate_id", id);

  // Fetch customer if exists
  let customer = null;
  if (estimate.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", estimate.customer_id)
      .single();
    customer = data;
  }

  // Fetch job if exists
  let job = null;
  if (estimate.job_id) {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", estimate.job_id)
      .single();
    job = data;
  }

  const estimateWithDetails = {
    ...estimate,
    line_items: lineItems || [],
    materials: materials || [],
    customer,
    job,
  };

  return <EstimateDetailView estimate={estimateWithDetails} />;
}

