import { notFound } from "next/navigation";
import { createClient } from "@drip/core/database/server";
import { InvoiceDetailView } from "@/components/app/invoices/invoice-detail-view";

export default async function InvoicePage({
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

  // Fetch invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyUser.company_id)
    .single();

  if (!invoice) {
    notFound();
  }

  // Fetch customer and job
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceWithDetails = { ...invoice, customer, job } as any;

  return <InvoiceDetailView invoice={invoiceWithDetails} />;
}

