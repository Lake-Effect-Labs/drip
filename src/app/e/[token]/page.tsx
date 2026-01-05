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

  // Fetch estimate by public token
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("public_token", token)
    .single();

  if (!estimate) {
    notFound();
  }

  // Fetch related data
  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimate.id);

  const { data: customer } = estimate.customer_id
    ? await supabase.from("customers").select("*").eq("id", estimate.customer_id).single()
    : { data: null };

  const { data: job } = estimate.job_id
    ? await supabase.from("jobs").select("*").eq("id", estimate.job_id).single()
    : { data: null };

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", estimate.company_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimateWithDetails = {
    ...estimate,
    line_items: lineItems || [],
    customer,
    job,
    company,
  } as any;

  return <PublicEstimateView estimate={estimateWithDetails} token={token} />;
}
