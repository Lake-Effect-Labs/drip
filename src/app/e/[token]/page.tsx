import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PublicEstimateView } from "@/components/public/public-estimate-view";
import type { EstimateMaterial } from "@/types/database";

export default async function PublicEstimatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // First try to find by estimate token (old system, for backwards compatibility)
  // When there are multiple estimates with the same token (revisions), get the most recent "sent" one
  // This ensures clients see the latest revision that needs approval, not an old accepted one
  const { data: estimates } = await supabase
    .from("estimates")
    .select("*")
    .eq("public_token", token)
    .order("created_at", { ascending: false });
  
  // Get the most recent "sent" estimate, or fall back to the most recent one
  const estimate = estimates?.find(e => e.status === "sent") || estimates?.[0];

  if (estimate) {
    // If estimate has a job_id, ALWAYS show unified view (not just after acceptance)
    // This provides a persistent link with all tabs (Estimate, Schedule, Progress, Payment)
    if (estimate.job_id) {
      const { data: job } = await supabase
        .from("jobs")
        .select("*, customer:customers(*), company:companies(name, logo_url, contact_phone, contact_email)")
        .eq("id", estimate.job_id)
        .single();

      if (job) {
        // Ensure unified_job_token exists
        if (!job.unified_job_token) {
          const { generateToken } = await import("@/lib/utils");
          const unifiedToken = generateToken(32);
          await supabase
            .from("jobs")
            .update({ unified_job_token: unifiedToken })
            .eq("id", job.id);
          job.unified_job_token = unifiedToken;
        }

        // Fetch payment line items
        const { data: paymentLineItems } = await supabase
          .from("job_payment_line_items")
          .select("*")
          .eq("job_id", job.id)
          .order("sort_order");

        // Convert payment line items to estimate line items format
        const lineItems = (paymentLineItems || []).map(item => ({
          id: item.id,
          name: item.title,
          price: item.price,
          description: null,
          sqft: null,
          rate_per_sqft: null,
          paint_color_name_or_code: null,
          sheen: null,
          product_line: null,
          gallons_estimate: null,
        }));

        // Fetch materials
        const { data: materials } = await supabase
          .from("estimate_materials")
          .select("*")
          .eq("estimate_id", estimate.id);

        const jobWithDetails = {
          ...job,
          estimate: {
            ...estimate,
            line_items: lineItems,
            materials: materials || [],
          },
        };

        const { UnifiedPublicJobView } = await import("@/components/public/unified-public-job-view");
        return <UnifiedPublicJobView job={jobWithDetails as any} token={token} />;
      }
    }

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
        sqft: null,
        rate_per_sqft: null,
        paint_color_name_or_code: null,
        sheen: null,
        product_line: null,
        gallons_estimate: null,
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
        .select("*, customer:customers(*), company:companies(name, logo_url, contact_phone, contact_email)")
        .eq("id", estimate.job_id)
        .single();
      job = data;
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name, logo_url")
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
    .select("*, customer:customers(*), company:companies(name, logo_url)")
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

  // Fetch estimate to get materials
  const { data: jobEstimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("job_id", jobWithEstimate.id)
    .single();

  let materials: EstimateMaterial[] = [];
  if (jobEstimate) {
    const { data: estimateMaterials } = await supabase
      .from("estimate_materials")
      .select("*")
      .eq("estimate_id", jobEstimate.id);
    materials = estimateMaterials || [];
  }

  // Convert payment line items to the format expected by PublicEstimateView
  const lineItems = (paymentLineItems || []).map(item => ({
    id: item.id,
    name: item.title,
    price: item.price,
    description: null,
    sqft: null,
    rate_per_sqft: null,
    paint_color_name_or_code: null,
    sheen: null,
    product_line: null,
    gallons_estimate: null,
  }));

  const jobWithDetails = {
    ...jobWithEstimate,
    ...jobEstimate,
    line_items: lineItems,
    materials: materials,
    customer: jobWithEstimate.customer,
    job: {
      address1: jobWithEstimate.address1,
      city: jobWithEstimate.city,
      state: jobWithEstimate.state,
      zip: jobWithEstimate.zip,
    },
    company: jobWithEstimate.company,
  };

  return <PublicEstimateView estimate={jobWithDetails as any} token={token} />;
}
