import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", invoice.customer_id)
    .single();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", invoice.job_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceWithDetails = { ...invoice, customer, job } as any;

  return <InvoiceDetailView invoice={invoiceWithDetails} />;
}

