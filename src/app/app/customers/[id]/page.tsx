import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerDetailView } from "@/components/app/customers/customer-detail-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get company ID
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) {
    redirect("/signup");
  }

  // Get customer
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyUser.company_id)
    .single();

  if (error || !customer) {
    notFound();
  }

  // Get customer's jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  // Get customer's invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  return (
    <CustomerDetailView
      customer={customer}
      jobs={jobs || []}
      invoices={invoices || []}
      companyId={companyUser.company_id}
    />
  );
}

