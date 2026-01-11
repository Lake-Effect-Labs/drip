import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Default materials per service type
const SERVICE_MATERIALS: Record<string, string[]> = {
  interior_walls: ["Paint (gallons)", "Primer", "Rollers", "Brushes", "Tape", "Drop cloths"],
  ceilings: ["Ceiling paint", "Extension pole", "Rollers", "Tape"],
  trim_doors: ["Trim paint", "Brushes", "Sandpaper", "Tape"],
  cabinets: ["Cabinet paint", "Primer", "Brushes", "Sandpaper", "Degreaser"],
  prep_work: ["Spackle", "Sandpaper", "Caulk", "Primer"],
  repairs: ["Spackle", "Drywall patch", "Joint compound", "Sandpaper"],
  deck_fence: ["Stain/Paint", "Pressure washer", "Brushes", "Rollers"],
  touchups: ["Touch-up paint", "Small brushes", "Spackle"],
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    // Get estimate by token
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("public_token", token)
      .single();

    if (estimateError || !estimate) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 }
      );
    }

    // Check if already accepted (idempotent)
    if (estimate.status === "accepted") {
      return NextResponse.json({ success: true, message: "Already accepted" });
    }

    // Start transaction-like operations
    let jobId = estimate.job_id;
    let customerId = estimate.customer_id;

    // Get customer if exists
    let customer = null;
    if (estimate.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("id", estimate.customer_id)
        .single();
      customer = data;
    }

    // Get job if exists
    let job = null;
    if (estimate.job_id) {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", estimate.job_id)
        .single();
      job = data;
      if (job?.customer_id && !customerId) {
        customerId = job.customer_id;
      }
    }

    // Create job if doesn't exist
    if (!jobId) {
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          company_id: estimate.company_id,
          customer_id: customerId,
          title: customer?.name
            ? `${customer.name} Project`
            : "New Project",
          status: "quoted",
          address1: job?.address1 || customer?.address1,
          city: job?.city || customer?.city,
          state: job?.state || customer?.state,
          zip: job?.zip || customer?.zip,
        })
        .select()
        .single();

      if (jobError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error creating job:", jobError);
        }
        return NextResponse.json(
          { error: "Failed to create job" },
          { status: 500 }
        );
      }

      jobId = newJob.id;
    } else {
      // Update existing job status to quoted
      await supabase
        .from("jobs")
        .update({ status: "quoted", updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    // Update estimate
    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        job_id: jobId,
        customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating estimate:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to accept estimate" },
        { status: 500 }
      );
    }

    // Auto-generate materials checklist from estimate line items
    const { data: lineItems } = await supabase
      .from("estimate_line_items")
      .select("service_key, paint_color_name_or_code, sheen, product_line, gallons_estimate")
      .eq("estimate_id", estimate.id);

    let materialsCreated = 0;
    if (lineItems && lineItems.length > 0) {
      // Collect all materials from services, avoiding duplicates
      const materialsSet = new Set<string>();
      const materialsToInsert: { job_id: string; name: string; checked: boolean }[] = [];

      for (const item of lineItems) {
        // Add service-specific materials
        const serviceMaterials = SERVICE_MATERIALS[item.service_key] || [];
        for (const material of serviceMaterials) {
          if (!materialsSet.has(material)) {
            materialsSet.add(material);
            materialsToInsert.push({
              job_id: jobId,
              name: material,
              checked: false,
            });
          }
        }

        // Add paint-specific material if specified
        if (item.paint_color_name_or_code || item.product_line) {
          const paintName = [
            item.product_line,
            item.paint_color_name_or_code,
            item.sheen,
            item.gallons_estimate ? `(${item.gallons_estimate} gal)` : null,
          ]
            .filter(Boolean)
            .join(" ");

          if (paintName && !materialsSet.has(paintName)) {
            materialsSet.add(paintName);
            materialsToInsert.push({
              job_id: jobId,
              name: paintName,
              checked: false,
            });
          }
        }
      }

      // Insert materials
      if (materialsToInsert.length > 0) {
        const { error: materialsError } = await supabase
          .from("job_materials")
          .insert(materialsToInsert);

        if (materialsError) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error creating materials:", materialsError);
          }
          // Don't fail the whole request, just log the error
        } else {
          materialsCreated = materialsToInsert.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      materials_auto_generated: materialsCreated > 0,
      materials_count: materialsCreated
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error accepting estimate:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

