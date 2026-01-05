import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceBuilder } from "@/components/app/invoices/invoice-builder";

export default async function NewInvoicePage({
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

  // Get company ID
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) return null;

  // Must have a job to create invoice
  if (!params.jobId) {
    redirect("/app/board");
  }

  // Get job
  const { data: jobData } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.jobId)
    .eq("company_id", companyUser.company_id)
    .single();

  if (!jobData) {
    redirect("/app/board");
  }

  // Get customer
  let customer = null;
  if (jobData.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", jobData.customer_id)
      .single();
    customer = data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = { ...jobData, customer } as any;

  // Get accepted estimate for this job
  const { data: estimatesData } = await supabase
    .from("estimates")
    .select("*")
    .eq("job_id", params.jobId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1);

  let estimate = null;
  if (estimatesData?.[0]) {
    const { data: lineItems } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimatesData[0].id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    estimate = { ...estimatesData[0], line_items: lineItems || [] } as any;
  }

  return (
    <InvoiceBuilder
      companyId={companyUser.company_id}
      job={job}
      estimate={estimate}
    />
  );
}

