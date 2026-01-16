import { notFound } from "next/navigation";
import { createAdminClient } from "@drip/core/database/server";
import { PublicScheduleView } from "@/components/public/public-schedule-view";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ScheduleConfirmationPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Fetch job by schedule_token
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("schedule_token", token)
    .single();

  if (jobError || !job) {
    notFound();
  }

  // Fetch customer separately if exists
  let customer = null;
  if (job.customer_id) {
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("id", job.customer_id)
      .maybeSingle();
    customer = customerData;
  }

  // Fetch company info
  const { data: company } = await supabase
    .from("companies")
    .select("name, logo_url")
    .eq("id", job.company_id)
    .maybeSingle();

  const jobWithCustomer = {
    ...job,
    customer,
    company: company || null,
  };

  return <PublicScheduleView job={jobWithCustomer} token={token} />;
}
