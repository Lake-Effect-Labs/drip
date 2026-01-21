import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/estimates/[token]/signoff
 * Submits customer signoff/agreement for an estimate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { token } = await params;
    const body = await request.json();

    const {
      customer_name,
      acknowledged_scope = false,
      acknowledged_materials = false,
      acknowledged_areas = false,
      acknowledged_terms = false,
    } = body;

    // Validate required fields
    if (!customer_name || !customer_name.trim()) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    // Validate all acknowledgments are checked
    if (
      !acknowledged_scope ||
      !acknowledged_materials ||
      !acknowledged_areas ||
      !acknowledged_terms
    ) {
      return NextResponse.json(
        { error: "All acknowledgments must be checked" },
        { status: 400 }
      );
    }

    // Fetch estimate
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

    // Fetch line items
    const { data: line_items } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimate.id);

    // Fetch materials
    const { data: materials } = await supabase
      .from("estimate_materials")
      .select("*")
      .eq("estimate_id", estimate.id);

    // Check if signoff is required
    if (!estimate.requires_signoff) {
      return NextResponse.json(
        { error: "Signoff is not required for this estimate" },
        { status: 400 }
      );
    }

    // Check if already signed off
    if (estimate.signoff_completed_at) {
      return NextResponse.json(
        { error: "Estimate has already been signed off" },
        { status: 400 }
      );
    }

    // Generate scope summary from line items
    const scopeSummary = line_items
      ?.map((item) => {
        const parts = [item.name, item.description].filter(Boolean);
        return parts.join(" - ");
      })
      .join("; ") || "No scope items specified";

    // Generate materials summary
    const materialsSummary = materials
      ?.map((material) => {
        const parts = [];
        if (material.paint_product) parts.push(material.paint_product);
        if (material.product_line) parts.push(material.product_line);
        if (material.color_name) parts.push(material.color_name);
        if (material.color_code) parts.push(`(${material.color_code})`);
        if (material.sheen) parts.push(`- ${material.sheen}`);
        if (material.quantity_gallons) parts.push(`${material.quantity_gallons} gal`);
        return parts.join(" ");
      })
      .join("; ") || "No materials specified";

    // Generate areas summary from materials
    const uniqueAreas = new Set(
      materials
        ?.map((m) => m.area_description)
        .filter((a) => a)
    );
    const areasSummary = uniqueAreas.size > 0
      ? Array.from(uniqueAreas).join(", ")
      : "No specific areas listed";

    // Capture IP address and user agent
    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Insert signoff record
    const { data: signoff, error: signoffError } = await supabase
      .from("estimate_signoffs")
      .insert({
        estimate_id: estimate.id,
        customer_name: customer_name.trim(),
        ip_address: ipAddress,
        user_agent: userAgent,
        acknowledged_scope,
        acknowledged_materials,
        acknowledged_areas,
        acknowledged_terms,
        scope_summary: scopeSummary,
        materials_summary: materialsSummary,
        areas_summary: areasSummary,
        signed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (signoffError) {
      console.error("Error creating signoff:", signoffError);
      throw signoffError;
    }

    // Update estimate with signoff completion
    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        signoff_completed_at: new Date().toISOString(),
        signoff_customer_name: customer_name.trim(),
        signoff_ip_address: ipAddress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);

    if (updateError) {
      console.error("Error updating estimate:", updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      signoff,
      message: "Signoff completed successfully",
    });
  } catch (error) {
    console.error("Error processing signoff:", error);
    return NextResponse.json(
      { error: "Failed to process signoff" },
      { status: 500 }
    );
  }
}
