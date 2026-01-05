import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamMembers } from "@/lib/supabase/queries";
import { JobDetailView } from "@/components/app/jobs/job-detail-view";

export default async function JobPage({
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

  // Fetch job
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyUser.company_id)
    .single();

  if (!job) {
    notFound();
  }

  // Fetch customer if exists
  let customer = null;
  if (job.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customer_id)
      .single();
    customer = data;
  }

  const jobWithCustomer = { ...job, customer };

  // Fetch estimates for this job
  const { data: estimatesData } = await supabase
    .from("estimates")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Fetch line items for estimates
  const estimates = await Promise.all(
    (estimatesData || []).map(async (est) => {
      const { data: lineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", est.id);
      return { ...est, line_items: lineItems || [] };
    })
  );

  // Fetch invoices for this job
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Fetch materials for this job
  const { data: materials } = await supabase
    .from("job_materials")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  // Fetch team members
  const members = await getTeamMembers(supabase, companyUser.company_id);

  return (
    <JobDetailView
      job={jobWithCustomer}
      estimates={estimates}
      invoices={invoices || []}
      materials={materials || []}
      teamMembers={members}
      companyId={companyUser.company_id}
    />
  );
}

