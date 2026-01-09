import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PublicScheduleView } from "@/components/public/public-schedule-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScheduleConfirmationPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch job with customer info
  const { data: job, error } = await supabase
    .from("jobs")
    .select(`
      *,
      customer:customers(*)
    `)
    .eq("id", id)
    .single();

  if (error || !job) {
    notFound();
  }

  return <PublicScheduleView job={job} jobId={id} />;
}
