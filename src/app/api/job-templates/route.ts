import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/job-templates - List templates for company
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    // Get templates with materials and estimate items
    const { data: templates, error } = await supabase
      .from("job_templates")
      .select(
        `
        *,
        template_materials (*),
        template_estimate_items (*)
      `
      )
      .eq("company_id", companyUser.company_id)
      .order("name", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json(templates || []);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/job-templates - Create template from job
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      job_id,
      name,
      description,
      include_notes,
      include_materials,
      include_estimate_structure,
    } = body;

    if (!job_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: job_id, name" },
        { status: 400 }
      );
    }

    // Get the job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .eq("company_id", companyUser.company_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Check template count limit (50 per company)
    const { count } = await supabase
      .from("job_templates")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyUser.company_id);

    if (count && count >= 50) {
      return NextResponse.json(
        { error: "Template limit reached (50 per company)" },
        { status: 400 }
      );
    }

    // Create the template
    const { data: template, error: templateError } = await supabase
      .from("job_templates")
      .insert({
        company_id: companyUser.company_id,
        name: name.trim(),
        description: description || null,
        notes: include_notes ? job.notes : null,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (templateError) {
      // Handle unique constraint violation
      if (templateError.code === "23505") {
        return NextResponse.json(
          { error: "A template with this name already exists" },
          { status: 400 }
        );
      }
      console.error("Error creating template:", templateError);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    // Copy materials if requested
    if (include_materials) {
      const { data: materials } = await supabase
        .from("job_materials")
        .select("*")
        .eq("job_id", job_id);

      if (materials && materials.length > 0) {
        const templateMaterials = materials.map((m, index) => ({
          template_id: template.id,
          name: m.name,
          quantity: m.notes || null,
          notes: null,
          sort_order: index,
        }));

        await supabase.from("template_materials").insert(templateMaterials);
      }
    }

    // Copy estimate structure if requested
    if (include_estimate_structure) {
      const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_line_items (*)")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (estimates && estimates.length > 0 && estimates[0].estimate_line_items && Array.isArray(estimates[0].estimate_line_items)) {
        const lineItems = estimates[0].estimate_line_items;
        const templateEstimateItems = lineItems.map((li: any, index: number) => ({
          template_id: template.id,
          service_type: li.service_type,
          name: li.name,
          description: li.description,
          sort_order: index,
        }));

        await supabase
          .from("template_estimate_items")
          .insert(templateEstimateItems);
      }
    }

    // Fetch the complete template with relations
    const { data: completeTemplate } = await supabase
      .from("job_templates")
      .select(
        `
        *,
        template_materials (*),
        template_estimate_items (*)
      `
      )
      .eq("id", template.id)
      .single();

    return NextResponse.json(completeTemplate);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
