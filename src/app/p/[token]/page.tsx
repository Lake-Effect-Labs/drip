import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PublicPaymentView } from "@/components/public/public-payment-view";

export default async function PublicPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Fetch job by payment_token
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("payment_token", token)
    .single();

  if (!job) {
    notFound();
  }

  // Fetch related data
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", job.customer_id)
    .single();

  const { data: company } = await supabase
    .from("companies")
    .select("name, logo_url, contact_phone, contact_email")
    .eq("id", job.company_id)
    .single();

  // Fetch payment line items
  const { data: lineItems } = await supabase
    .from("job_payment_line_items")
    .select("id, title, price")
    .eq("job_id", job.id)
    .order("sort_order");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobWithDetails = {
    ...job,
    customer,
    company,
    payment_line_items: lineItems || [],
  } as any;

  return <PublicPaymentView job={jobWithDetails} token={token} />;
}
