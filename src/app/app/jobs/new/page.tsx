"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NewJobDialog } from "@/components/app/board/new-job-dialog";
import type { Job, Customer } from "@/types/database";

type JobWithCustomer = Job & { customer: Customer | null };

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");
  const supabase = createClient();
  
  const [companyId, setCompanyId] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; email: string; fullName: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Get company ID
      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!companyUser) {
        router.push("/app");
        return;
      }

      setCompanyId(companyUser.company_id);

      // Get team members
      const { data: members } = await supabase
        .from("company_users")
        .select(`
          user_id,
          user_profiles!inner (
            id,
            email,
            full_name
          )
        `)
        .eq("company_id", companyUser.company_id);

      if (members) {
        setTeamMembers(
          members
            .filter((m: any) => m.user_profiles)
            .map((m: any) => ({
              id: m.user_profiles.id,
              email: m.user_profiles.email || "",
              fullName: m.user_profiles.full_name || "Unknown",
            }))
        );
      }

      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  function handleJobCreated(job: JobWithCustomer) {
    router.push(`/app/jobs/${job.id}`);
  }

  function handleClose() {
    router.back();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <NewJobDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      companyId={companyId}
      teamMembers={teamMembers}
      onJobCreated={handleJobCreated}
      initialCustomerId={customerId}
    />
  );
}
