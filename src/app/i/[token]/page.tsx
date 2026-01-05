import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PublicInvoiceView } from "@/components/public/public-invoice-view";

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const { token } = await params;
  const search = await searchParams;
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

  return (
    <PublicInvoiceView
      invoice={invoiceWithDetails}
      success={search.success === "true"}
      canceled={search.canceled === "true"}
    />
  );
}
