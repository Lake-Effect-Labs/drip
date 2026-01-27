import { createAdminClient } from "@/lib/supabase/server";
import { EstimateLineItem, EstimateMaterial, InsertTables } from "@/types/database";

// Default cost per gallon if not found in inventory
const DEFAULT_COST_PER_GALLON = 45.0;

/**
 * Auto-generates estimate materials from line items
 * Creates paint materials based on paint details in line items
 */
export async function generateEstimateMaterials(estimateId: string): Promise<EstimateMaterial[]> {
  const supabase = createAdminClient();

  // Get all line items for this estimate
  const { data: lineItems, error: lineItemsError } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimateId);

  if (lineItemsError) {
    throw new Error(`Failed to fetch line items: ${lineItemsError.message}`);
  }

  if (!lineItems || lineItems.length === 0) {
    return [];
  }

  // Generate materials from line items with paint details
  const materialsToInsert: InsertTables<"estimate_materials">[] = [];

  // Known product lines that should be prefixed with brand
  const KNOWN_PRODUCT_LINES = ["Duration", "Emerald", "SuperPaint", "ProClassic", "Cashmere", "Harmony", "Captivate"];
  
  for (const item of lineItems) {
    // Create materials for items with paint details (brand, product line, color, or sheen)
    // Even if gallons_estimate is not set, we should still create a material entry
    const hasPaintDetails = item.product_line || item.paint_color_name_or_code || item.sheen || 
                           (item.description && (item.description.includes('BRAND:') || item.description.includes('PRODUCT_LINE:')));
    
    if (hasPaintDetails) {
      // Parse color code from paint_color_name_or_code (e.g., "SW 7029" or "Agreeable Gray")
      const colorCode = item.paint_color_name_or_code?.match(/[A-Z]{1,3}\s*\d+/i)?.[0] || null;
      const colorName = colorCode
        ? item.paint_color_name_or_code?.replace(colorCode, "").trim() || null
        : item.paint_color_name_or_code;

      // No cost calculation - materials are for informational purposes only
      const costPerGallon = null;
      const lineTotal = null;

      // Parse brand, product line, and notes from description if available
      let brand: string | null = null;
      let productLine: string | null = item.product_line || null;
      let notes: string | null = null;
      
      if (item.description) {
        const brandMatch = item.description.match(/BRAND:([^|]+)/);
        const productLineMatch = item.description.match(/PRODUCT_LINE:([^|]+)/);
        const notesMatch = item.description.match(/NOTES:([^|]+)/);
        if (brandMatch) brand = brandMatch[1];
        if (productLineMatch) productLine = productLineMatch[1];
        if (notesMatch) notes = notesMatch[1];
      }

      // Determine paint_product: combine brand + product line if both exist
      let paintProduct: string | null = null;
      if (productLine) {
        // If product_line is a known product line, prepend brand (default to "Sherwin Williams" if no brand)
        if (KNOWN_PRODUCT_LINES.includes(productLine)) {
          paintProduct = brand ? `${brand} ${productLine}` : `Sherwin Williams ${productLine}`;
        } else {
          // If product_line is a brand name (like "Sherwin-Williams"), use it as-is
          paintProduct = productLine;
        }
      } else if (brand) {
        paintProduct = brand;
      }

      // Create descriptive material name
      const paintProductName = paintProduct || productLine || 'Paint';
      const materialName = `${paintProductName} - ${item.name}`;

      materialsToInsert.push({
        estimate_id: estimateId,
        estimate_line_item_id: item.id,
        name: materialName,
        paint_product: paintProduct,
        product_line: productLine, // Store just the product line, not the brand
        color_name: colorName,
        color_code: colorCode,
        sheen: item.sheen,
        area_description: item.name, // e.g., "Interior Walls", "Ceilings"
        quantity_gallons: item.gallons_estimate || null, // Allow null if not specified
        cost_per_gallon: costPerGallon,
        line_total: lineTotal,
        vendor_sku: item.vendor_sku,
        notes: notes, // Store notes from line item
        is_auto_generated: true,
      });
    }
  }

  if (materialsToInsert.length === 0) {
    return [];
  }

  // Insert materials
  const { data: insertedMaterials, error: insertError } = await supabase
    .from("estimate_materials")
    .insert(materialsToInsert)
    .select();

  if (insertError) {
    throw new Error(`Failed to insert materials: ${insertError.message}`);
  }

  return insertedMaterials || [];
}

/**
 * Regenerates estimate materials by deleting auto-generated ones and creating new ones
 */
export async function regenerateEstimateMaterials(estimateId: string): Promise<EstimateMaterial[]> {
  const supabase = createAdminClient();

  // Delete all auto-generated materials for this estimate
  const { error: deleteError } = await supabase
    .from("estimate_materials")
    .delete()
    .eq("estimate_id", estimateId)
    .eq("is_auto_generated", true);

  if (deleteError) {
    throw new Error(`Failed to delete auto-generated materials: ${deleteError.message}`);
  }

  // Generate new materials
  return generateEstimateMaterials(estimateId);
}

/**
 * Gets materials breakdown for an estimate
 */
export async function getEstimateMaterialsBreakdown(estimateId: string) {
  const supabase = createAdminClient();

  const { data: materials, error } = await supabase
    .from("estimate_materials")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch materials: ${error.message}`);
  }

  const materialsTotal = materials?.reduce((sum, m) => sum + (m.line_total || 0), 0) || 0;

  return {
    materials: materials || [],
    materialsTotal, // in cents
  };
}

/**
 * Calculates the total gallons needed for an estimate
 */
export function calculateTotalGallons(materials: EstimateMaterial[]): number {
  return materials.reduce((sum, m) => sum + (m.quantity_gallons || 0), 0);
}

/**
 * Groups materials by paint product for better display
 */
export function groupMaterialsByProduct(materials: EstimateMaterial[]) {
  const grouped = new Map<string, EstimateMaterial[]>();

  for (const material of materials) {
    const key = material.paint_product || "Other Materials";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(material);
  }

  return Array.from(grouped.entries()).map(([product, items]) => ({
    product,
    materials: items,
    totalGallons: calculateTotalGallons(items),
    totalCost: items.reduce((sum, m) => sum + (m.line_total || 0), 0),
  }));
}

// Marker used to identify job materials that were auto-generated from an estimate
const AUTO_MATERIAL_MARKER = "[From Estimate]";

/**
 * Syncs estimate materials to job materials checklist.
 * Auto-generated job materials are identified by having "[From Estimate]" in their notes.
 * When called, it removes old auto-generated materials and creates new ones from the estimate.
 */
export async function syncEstimateMaterialsToJob(estimateId: string, jobId: string): Promise<void> {
  const supabase = createAdminClient();

  // Fetch estimate materials
  const { data: estimateMaterials, error: fetchError } = await supabase
    .from("estimate_materials")
    .select("*")
    .eq("estimate_id", estimateId);

  if (fetchError) {
    throw new Error(`Failed to fetch estimate materials: ${fetchError.message}`);
  }

  // Delete existing auto-generated job materials (those with the marker in notes)
  const { error: deleteError } = await supabase
    .from("job_materials")
    .delete()
    .eq("job_id", jobId)
    .like("notes", `%${AUTO_MATERIAL_MARKER}%`);

  if (deleteError) {
    throw new Error(`Failed to delete old auto-generated job materials: ${deleteError.message}`);
  }

  // If no estimate materials, we're done
  if (!estimateMaterials || estimateMaterials.length === 0) {
    return;
  }

  // Build job materials from estimate materials
  const jobMaterialsToInsert = estimateMaterials.map((em) => {
    // Build a descriptive name for the job material
    const nameParts: string[] = [];

    if (em.paint_product) {
      nameParts.push(em.paint_product);
    }

    if (em.color_name || em.color_code) {
      const colorPart = [em.color_name, em.color_code].filter(Boolean).join(" ");
      nameParts.push(colorPart);
    }

    if (em.sheen) {
      nameParts.push(em.sheen);
    }

    // If we have specific parts, use them; otherwise fall back to the material name
    const name = nameParts.length > 0
      ? nameParts.join(" - ")
      : em.name;

    // Build notes with area description and the marker
    const notesParts: string[] = [];
    if (em.area_description) {
      notesParts.push(`For: ${em.area_description}`);
    }
    if (em.notes) {
      notesParts.push(em.notes);
    }
    notesParts.push(AUTO_MATERIAL_MARKER);

    return {
      job_id: jobId,
      name,
      checked: false,
      vendor_sku: em.vendor_sku,
      notes: notesParts.join(" | "),
      quantity_decimal: em.quantity_gallons,
      unit: em.quantity_gallons ? "gallons" : null,
      cost_per_unit: em.cost_per_gallon,
    };
  });

  // Insert new job materials
  const { error: insertError } = await supabase
    .from("job_materials")
    .insert(jobMaterialsToInsert);

  if (insertError) {
    throw new Error(`Failed to insert job materials: ${insertError.message}`);
  }
}
