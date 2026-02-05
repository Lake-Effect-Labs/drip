import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { generateToken } from "@/lib/utils";
import { recalculateEstimateTotals } from "@/lib/estimate-helpers";
import { requireActiveSubscription } from "@/lib/subscription";

// Save estimate/payment (uses admin client to bypass RLS)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;
    const body = await request.json();
    const {
      jobPaymentLineItems,
      estimateLineItems,
      totalAmount,
      companyId,
      customerId,
      existingToken
    } = body;

    // Get job to verify company
    const { data: job } = await adminSupabase
      .from("jobs")
      .select("company_id, status")
      .eq("id", jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify user belongs to company
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", job.company_id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "Unauthorized - not a member of this company" },
        { status: 403 }
      );
    }

    const subCheck = await requireActiveSubscription(job.company_id);
    if (subCheck) return subCheck;

    // Update job payment state
    const { error: jobError } = await adminSupabase
      .from("jobs")
      .update({
        payment_state: "proposed",
        payment_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (jobError) {
      console.error("Job update error:", jobError);
      return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
    }

    // Delete old job payment line items
    const { error: deleteError } = await adminSupabase
      .from("job_payment_line_items")
      .delete()
      .eq("job_id", jobId);

    if (deleteError) {
      console.error("Delete line items error:", deleteError);
      return NextResponse.json({ error: "Failed to delete old line items" }, { status: 500 });
    }

    // Insert new job payment line items
    if (jobPaymentLineItems && jobPaymentLineItems.length > 0) {
      const { error: itemsError } = await adminSupabase
        .from("job_payment_line_items")
        .insert(jobPaymentLineItems);

      if (itemsError) {
        console.error("Items insert error:", itemsError);
        return NextResponse.json({ error: "Failed to insert line items" }, { status: 500 });
      }
    }

    // Check for existing estimate
    const { data: existingEstimates } = await adminSupabase
      .from("estimates")
      .select("id, public_token, status")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1);

    const existingEstimate = existingEstimates?.[0] || null;
    let estimateData = null;
    let estimateId = "";

    const token = existingToken || generateToken(24);

    if (existingEstimate) {
      // If estimate is accepted or denied, create a new revision
      if (existingEstimate.status === "accepted" || existingEstimate.status === "denied") {
        const newToken = generateToken(24);
        const { data, error } = await adminSupabase
          .from("estimates")
          .insert({
            company_id: companyId,
            job_id: jobId,
            customer_id: customerId,
            status: "sent",
            public_token: newToken,
          })
          .select("id, public_token")
          .single();

        if (error) {
          console.error("Error creating new estimate revision:", error);
          return NextResponse.json({ error: "Failed to create estimate revision" }, { status: 500 });
        } else {
          estimateData = data;
          estimateId = data.id;
          // Reset job approval status
          await adminSupabase
            .from("jobs")
            .update({
              payment_state: "proposed",
              payment_approved_at: null,
              status: job.status === "quoted" ? "new" : job.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        }
      } else {
        // Update existing estimate
        const { data, error } = await adminSupabase
          .from("estimates")
          .update({
            public_token: existingEstimate.public_token,
            status: "sent",
            updated_at: new Date().toISOString(),
            accepted_at: null,
            denied_at: null,
            denial_reason: null,
          })
          .eq("id", existingEstimate.id)
          .select("id, public_token")
          .single();

        if (error) {
          console.error("Error updating estimate:", error);
          return NextResponse.json({ error: "Failed to update estimate" }, { status: 500 });
        } else {
          estimateData = data;
          estimateId = existingEstimate.id;
          // Reset job approval status if previously approved
          const { data: currentJob } = await adminSupabase
            .from("jobs")
            .select("payment_state, status")
            .eq("id", jobId)
            .single();

          if (currentJob?.payment_state === "approved") {
            await adminSupabase
              .from("jobs")
              .update({
                payment_state: "proposed",
                payment_approved_at: null,
                status: currentJob.status === "quoted" ? "new" : currentJob.status,
                updated_at: new Date().toISOString(),
              })
              .eq("id", jobId);
          }
        }
      }
    } else {
      // Create new estimate
      const { data, error } = await adminSupabase
        .from("estimates")
        .insert({
          company_id: companyId,
          job_id: jobId,
          customer_id: customerId,
          status: "sent",
          public_token: token,
        })
        .select("id, public_token")
        .single();

      if (error) {
        console.error("Error creating estimate:", error);
        return NextResponse.json({ error: "Failed to create estimate" }, { status: 500 });
      } else {
        estimateData = data;
        estimateId = data.id;
      }
    }

    // Handle estimate line items
    if (estimateId && estimateLineItems && estimateLineItems.length > 0) {
      // Delete old estimate line items
      await adminSupabase
        .from("estimate_line_items")
        .delete()
        .eq("estimate_id", estimateId);

      // Add estimate_id to each line item
      const itemsWithEstimateId = estimateLineItems.map((item: any) => ({
        ...item,
        estimate_id: estimateId,
      }));

      // Insert new estimate line items
      const { error: estimateItemsError } = await adminSupabase
        .from("estimate_line_items")
        .insert(itemsWithEstimateId);

      if (estimateItemsError) {
        console.error("Estimate line items insert error:", estimateItemsError);
        return NextResponse.json({ error: "Failed to save estimate line items" }, { status: 500 });
      }

      // Recalculate estimate totals after line items change
      await recalculateEstimateTotals(adminSupabase, estimateId);
    }

    return NextResponse.json({
      success: true,
      estimate: estimateData,
      estimateId,
    });
  } catch (error) {
    console.error("Error in payment save:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
