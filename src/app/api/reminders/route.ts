import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET - Fetch follow-up reminders for stale estimates
// Returns estimates that were sent > 2 days ago and haven't been accepted or denied
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Get user's company
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json({ reminders: [] });
    }

    // Find stale estimates: sent > 2 days ago, still in "sent" status
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: staleEstimates, error } = await adminSupabase
      .from("estimates")
      .select(`
        id,
        job_id,
        sent_at,
        status,
        created_at,
        jobs!inner (
          id,
          title,
          customer_id,
          customers (
            name,
            phone,
            email
          )
        )
      `)
      .eq("company_id", companyUser.company_id)
      .eq("status", "sent")
      .lt("sent_at", twoDaysAgo.toISOString())
      .order("sent_at", { ascending: true });

    if (error) {
      console.error("Error fetching stale estimates:", error);
      return NextResponse.json({ reminders: [] });
    }

    // Check which reminders the user has dismissed
    const { data: dismissals } = await adminSupabase
      .from("nudge_dismissals")
      .select("nudge_type")
      .eq("user_id", user.id)
      .eq("company_id", companyUser.company_id)
      .like("nudge_type", "followup_%");

    const dismissedIds = new Set(
      (dismissals || []).map((d) => d.nudge_type.replace("followup_", ""))
    );

    const reminders = (staleEstimates || [])
      .filter((est) => !dismissedIds.has(est.id))
      .map((est) => {
        const job = est.jobs as any;
        const customer = job?.customers;
        const sentDate = new Date(est.sent_at!);
        const now = new Date();
        const daysAgo = Math.floor(
          (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: est.id,
          jobId: est.job_id,
          jobTitle: job?.title || "Untitled Job",
          customerName: customer?.name || "Unknown Customer",
          customerPhone: customer?.phone || null,
          customerEmail: customer?.email || null,
          sentAt: est.sent_at,
          daysAgo,
        };
      });

    return NextResponse.json({ reminders });
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Dismiss a follow-up reminder
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { estimateId } = body;

    if (!estimateId) {
      return NextResponse.json(
        { error: "estimateId is required" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "No company found" },
        { status: 404 }
      );
    }

    // Store dismissal using existing nudge_dismissals table
    await adminSupabase.from("nudge_dismissals").insert({
      user_id: user.id,
      company_id: companyUser.company_id,
      nudge_type: `followup_${estimateId}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing reminder:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
