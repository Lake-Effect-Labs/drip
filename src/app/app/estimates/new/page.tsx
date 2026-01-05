import { createClient } from "@/lib/supabase/server";
import { EstimateBuilder } from "@/components/app/estimates/estimate-builder";

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID and config
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) return null;

  // Get estimating config
  const { data: config } = await supabase
    .from("estimating_config")
    .select("*")
    .eq("company_id", companyUser.company_id)
    .single();

  // Get job if jobId provided
  let job = null;
  let customer = null;
  if (params.jobId) {
    const { data: jobData } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", params.jobId)
      .eq("company_id", companyUser.company_id)
      .single();
    
    if (jobData) {
      // Get customer if exists
      if (jobData.customer_id) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("*")
          .eq("id", jobData.customer_id)
          .single();
        customer = customerData;
      }
      job = { ...jobData, customer };
    }
  }

  // Get existing customers for dropdown
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyUser.company_id)
    .order("name");

  return (
    <EstimateBuilder
      companyId={companyUser.company_id}
      config={config}
      job={job}
      customer={customer}
      customers={customers || []}
    />
  );
}

