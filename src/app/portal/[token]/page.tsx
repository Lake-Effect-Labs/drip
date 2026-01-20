import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { UnifiedPublicJobView } from "@/components/public/unified-public-job-view";

// Ensure this page is always dynamically rendered with fresh data
export const dynamic = 'force-dynamic';

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // First try to find by estimate token
  const { data: tokenEstimate, error: estimateError } = await supabase
    .from("estimates")
    .select("*")
    .eq("public_token", token)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (estimateError) {
    console.error("Error fetching estimate:", estimateError);
  }

  // If we found an estimate with this token and it has a job_id,
  // look for the LATEST "sent" estimate for that job (handles revisions with different tokens)
  let estimate = tokenEstimate;
  if (tokenEstimate?.job_id) {
    const { data: jobEstimates } = await supabase
      .from("estimates")
      .select("*")
      .eq("job_id", tokenEstimate.job_id)
      .order("created_at", { ascending: false });

    // Prefer the most recent "sent" estimate, otherwise fall back to the token estimate
    const latestSentEstimate = jobEstimates?.find(e => e.status === "sent");
    if (latestSentEstimate) {
      estimate = latestSentEstimate;
    } else {
      // If no "sent" estimate, use the most recent one (could be the denied one)
      estimate = jobEstimates?.[0] || tokenEstimate;
    }
  }

  // If we have an estimate with a job_id, load the full job details
  if (estimate?.job_id) {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*, customer:customers(*), company:companies(*)")
      .eq("id", estimate.job_id)
      .single();

    if (jobError) {
      console.error("Error fetching job:", jobError);
    }

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

      // Fetch estimate line items (these have paint details and link to materials)
      const { data: estimateLineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id)
        .order("created_at");

      // Use estimate line items which have proper IDs for material matching
      const lineItems = (estimateLineItems || []).map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
        sqft: item.sqft,
        rate_per_sqft: item.rate_per_sqft,
        paint_color_name_or_code: item.paint_color_name_or_code,
        sheen: item.sheen,
        product_line: item.product_line,
        gallons_estimate: item.gallons_estimate,
      }));

      // Fetch materials
      const { data: materials } = await supabase
        .from("estimate_materials")
        .select("*")
        .eq("estimate_id", estimate.id);

      // Fetch photos
      const { data: photos } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false });

      const jobWithDetails = {
        ...job,
        estimate: {
          ...estimate,
          line_items: lineItems,
          materials: materials || [],
        },
        photos: photos || [],
      };

      return <UnifiedPublicJobView job={jobWithDetails as any} token={token} />;
    }
  }

  // Try to find job by unified_job_token
  const { data: jobByToken, error: jobByTokenError } = await supabase
    .from("jobs")
    .select("*, customer:customers(*), company:companies(*)")
    .eq("unified_job_token", token)
    .single();

  if (jobByTokenError && jobByTokenError.code !== "PGRST116") {
    // PGRST116 is "no rows returned" which is expected if token doesn't match
    console.error("Error fetching job by token:", jobByTokenError);
  }

  if (jobByToken) {
    // Fetch the latest estimate for this job
    const { data: latestEstimate } = await supabase
      .from("estimates")
      .select("*")
      .eq("job_id", jobByToken.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch estimate line items if we have an estimate
    let lineItems: any[] = [];
    let materials: any[] = [];
    if (latestEstimate) {
      const { data: estimateLineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", latestEstimate.id)
        .order("created_at");

      lineItems = (estimateLineItems || []).map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
        sqft: item.sqft,
        rate_per_sqft: item.rate_per_sqft,
        paint_color_name_or_code: item.paint_color_name_or_code,
        sheen: item.sheen,
        product_line: item.product_line,
        gallons_estimate: item.gallons_estimate,
      }));

      const { data: estimateMaterials } = await supabase
        .from("estimate_materials")
        .select("*")
        .eq("estimate_id", latestEstimate.id);
      materials = estimateMaterials || [];
    }

    // Fetch photos
    const { data: photos } = await supabase
      .from("job_photos")
      .select("*")
      .eq("job_id", jobByToken.id)
      .order("created_at", { ascending: false });

    const jobWithDetails = {
      ...jobByToken,
      estimate: latestEstimate ? {
        ...latestEstimate,
        line_items: lineItems,
        materials: materials,
      } : null,
      photos: photos || [],
    };

    return <UnifiedPublicJobView job={jobWithDetails as any} token={token} />;
  }

  // If no estimate or job found, show not found
  notFound();
}
