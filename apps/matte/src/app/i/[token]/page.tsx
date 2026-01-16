import { notFound } from "next/navigation";
import { createAdminClient } from "@drip/core/database/server";
import { PublicInvoiceView } from "@/components/public/public-invoice-view";

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Fetch invoice by public token
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .single();

  if (!invoice) {
    notFound();
  }

  // Fetch related data
  let customer = null;
  if (invoice.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .single();
    customer = data;
  }

  let job = null;
  if (invoice.job_id) {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", invoice.job_id)
      .single();
    job = data;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", invoice.company_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceWithDetails = {
    ...invoice,
    customer,
    job,
    company,
  } as any;

  return <PublicInvoiceView invoice={invoiceWithDetails} />;
}
