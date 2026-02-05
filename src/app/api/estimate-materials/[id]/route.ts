import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { InsertTables } from "@/types/database";
import { recalculateEstimateTotals } from "@/lib/estimate-helpers";

/**
 * GET /api/estimate-materials/[id]
 * Lists all materials for an estimate
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: estimateId } = await params;

    // Verify user belongs to a company
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json(
        { error: "No company found" },
        { status: 404 }
      );
    }

    // Verify user has access to this estimate (explicit company check)
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, company_id")
      .eq("id", estimateId)
      .eq("company_id", companyUser.company_id)
      .single();

    if (estimateError || !estimate) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 }
      );
    }

    // Fetch materials
    const { data: materials, error: materialsError } = await supabase
      .from("estimate_materials")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("created_at", { ascending: true });

    if (materialsError) {
      throw materialsError;
    }

    // Calculate totals
    const materialsTotal = materials?.reduce(
      (sum, m) => sum + (m.line_total || 0),
      0
    ) || 0;

    const totalGallons = materials?.reduce(
      (sum, m) => sum + (m.quantity_gallons || 0),
      0
    ) || 0;

    return NextResponse.json({
      materials: materials || [],
      materialsTotal,
      totalGallons,
    });
  } catch (error) {
    console.error("Error fetching estimate materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/estimate-materials/[id]
 * Creates a new material for an estimate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: estimateId } = await params;
    const body = await request.json();

    // Verify user has access to this estimate
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, company_id, status")
      .eq("id", estimateId)
      .single();

    if (estimateError || !estimate) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 }
      );
    }

    // Prevent modifications to accepted or denied estimates
    if (estimate.status === "accepted") {
      return NextResponse.json(
        { error: "Cannot modify an accepted estimate. Create a new estimate instead." },
        { status: 403 }
      );
    }
    if (estimate.status === "denied") {
      return NextResponse.json(
        { error: "Cannot modify a denied estimate. Revert it to draft first." },
        { status: 403 }
      );
    }

    // Calculate line total from quantity and cost
    const quantityGallons = body.quantity_gallons || 0;
    const costPerGallon = body.cost_per_gallon || 0;
    const lineTotal = Math.round(quantityGallons * costPerGallon * 100);

    // Insert material
    const materialData: InsertTables<"estimate_materials"> = {
      estimate_id: estimateId,
      name: body.name,
      paint_product: body.paint_product || null,
      product_line: body.product_line || null,
      color_name: body.color_name || null,
      color_code: body.color_code || null,
      sheen: body.sheen || null,
      area_description: body.area_description || null,
      quantity_gallons: quantityGallons,
      cost_per_gallon: costPerGallon,
      line_total: lineTotal,
      estimate_line_item_id: body.estimate_line_item_id || null,
      vendor_sku: body.vendor_sku || null,
      notes: body.notes || null,
      is_auto_generated: false, // Manually created
    };

    const { data: material, error: insertError } = await supabase
      .from("estimate_materials")
      .insert(materialData)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Recalculate estimate totals
    await recalculateEstimateTotals(supabase, estimateId);

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    console.error("Error creating estimate material:", error);
    return NextResponse.json(
      { error: "Failed to create material" },
      { status: 500 }
    );
  }
}
