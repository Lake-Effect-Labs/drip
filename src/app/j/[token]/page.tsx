import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { UnifiedPublicJobView } from "@/components/public/unified-public-job-view";
import type { EstimateMaterial } from "@/types/database";

export default async function UnifiedPublicJobPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Try unified_job_token first, then fall back to other tokens for backwards compatibility
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .or(`unified_job_token.eq.${token},public_token.eq.${token},schedule_token.eq.${token},payment_token.eq.${token}`)
    .single();

  if (!job) {
    notFound();
  }

  // Determine if this is a payment token to set default tab
  const isPaymentToken = job.payment_token === token;

  // Fetch customer
  let customer = null;
  if (job.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customer_id)
      .single();
    customer = data;
  }

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("name, logo_url, contact_phone, contact_email")
    .eq("id", job.company_id)
    .single();

  // Fetch estimate
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("job_id", job.id)
    .maybeSingle();

  let lineItems: any[] = [];
  let materials: EstimateMaterial[] = [];

  if (estimate) {
    // Fetch line items from job_payment_line_items (unified system)
    const { data: paymentLineItems } = await supabase
      .from("job_payment_line_items")
      .select("*")
      .eq("job_id", job.id)
      .order("sort_order");

    if (paymentLineItems && paymentLineItems.length > 0) {
      // Convert to format expected by components
      lineItems = paymentLineItems.map(item => ({
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
      // Fall back to estimate_line_items
      const { data: oldLineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id);
      lineItems = oldLineItems || [];
    }

    // Fetch materials
    const { data: estimateMaterials } = await supabase
      .from("estimate_materials")
      .select("*")
      .eq("estimate_id", estimate.id);
    materials = estimateMaterials || [];
  }

  // Fetch invoice if exists
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("job_id", job.id)
    .maybeSingle();

  // Fetch payment line items
  const { data: paymentLineItems } = await supabase
    .from("job_payment_line_items")
    .select("id, title, price")
    .eq("job_id", job.id)
    .order("sort_order");

  const jobWithDetails = {
    ...job,
    customer,
    company: company || null,
    estimate: estimate ? {
      ...estimate,
      line_items: lineItems,
      materials,
    } : null,
    invoice: invoice || null,
    payment_line_items: paymentLineItems || [],
  } as any;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <UnifiedPublicJobView job={jobWithDetails} token={token} isPaymentToken={isPaymentToken} />
    </Suspense>
  );
}
