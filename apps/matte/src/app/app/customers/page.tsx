import { redirect } from "next/navigation";
import { createClient } from "@drip/core/database/server";
import { CustomersView } from "@/components/app/customers/customers-view";

export default async function CustomersPage() {
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

  // Get customers with tags
  const { data: customers } = await supabase
    .from("customers")
    .select(`
      *,
      tags:customer_tags(tag)
    `)
    .eq("company_id", companyUser.company_id)
    .order("name");

  // Get job counts per customer
  const { data: jobCounts } = await supabase
    .from("jobs")
    .select("customer_id")
    .eq("company_id", companyUser.company_id)
    .not("customer_id", "is", null);

  // Count jobs per customer
  const customerJobCounts: Record<string, number> = {};
  (jobCounts || []).forEach((job) => {
    if (job.customer_id) {
      customerJobCounts[job.customer_id] = (customerJobCounts[job.customer_id] || 0) + 1;
    }
  });

  return (
    <CustomersView
      initialCustomers={customers || []}
      customerJobCounts={customerJobCounts}
      companyId={companyUser.company_id}
    />
  );
}

