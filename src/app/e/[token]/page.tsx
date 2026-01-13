import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PublicEstimateView } from "@/components/public/public-estimate-view";

export default async function PublicEstimatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // First try to find by estimate token (old system, for backwards compatibility)
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("public_token", token)
    .single();

  if (estimate) {
    // Check if this is a unified payment estimate (has job_id and uses job_payment_line_items)
    let lineItems;

    if (estimate.job_id) {
      // Unified payment system - fetch from job_payment_line_items
      const { data: paymentLineItems } = await supabase
        .from("job_payment_line_items")
        .select("*")
        .eq("job_id", estimate.job_id)
        .order("sort_order");

      // Convert to format expected by PublicEstimateView (title -> name)
      lineItems = (paymentLineItems || []).map(item => ({
        id: item.id,
        name: item.title,
        price: item.price,
        description: null,
      }));
    } else {
      // Old system - fetch from estimate_line_items
      const { data: oldLineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id);

      lineItems = oldLineItems || [];
    }

    // Fetch materials
    const { data: materials } = await supabase
      .from("estimate_materials")
      .select("*")
      .eq("estimate_id", estimate.id);

    let customer = null;
    if (estimate.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("id", estimate.customer_id)
        .single();
      customer = data;
    }

    let job = null;
    if (estimate.job_id) {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", estimate.job_id)
        .single();
      job = data;
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", estimate.company_id)
      .single();

    const estimateWithDetails = {
      ...estimate,
      line_items: lineItems || [],
      materials: materials || [],
      customer,
      job,
      company,
    } as any;

    return <PublicEstimateView estimate={estimateWithDetails} token={token} />;
  }

  // New system - find job by estimate token or generate link for job
  // For Matte Lite, we'll use the job's public token
  const { data: jobWithEstimate } = await supabase
    .from("jobs")
    .select("*, customer:customers(*), company:companies(name)")
    .or(`id.eq.${token}`)
    .single();

  if (!jobWithEstimate) {
    notFound();
  }

  // Fetch payment line items
  const { data: paymentLineItems } = await supabase
    .from("job_payment_line_items")
    .select("*")
    .eq("job_id", jobWithEstimate.id)
    .order("sort_order");

  const jobWithDetails = {
    ...jobWithEstimate,
    payment_line_items: paymentLineItems || [],
  };

  return <PublicEstimateView estimate={jobWithDetails as any} token={token} />;
}
