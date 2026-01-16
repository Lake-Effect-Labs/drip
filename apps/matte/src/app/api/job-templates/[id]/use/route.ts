import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@drip/core/database/server";

// POST /api/job-templates/[id]/use - Create job from template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: templateId } = await params;

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
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { error: "Missing required field: job_id" },
        { status: 400 }
      );
    }

    // Get the template with materials
    const { data: template, error: templateError } = await supabase
      .from("job_templates")
      .select(
        `
        *,
        template_materials (*)
      `
      )
      .eq("id", templateId)
      .eq("company_id", companyUser.company_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
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

    // Update job with template notes if template has notes
    if (template.notes) {
      await supabase
        .from("jobs")
        .update({
          notes: template.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);
    }

    // Add template materials to job
    if (template.template_materials && Array.isArray(template.template_materials) && template.template_materials.length > 0) {
      const jobMaterials = template.template_materials.map((tm: any) => ({
        job_id: job_id,
        name: tm.name,
        notes: tm.quantity || tm.notes || null,
        checked: false,
      }));

      await supabase.from("job_materials").insert(jobMaterials);
    }

    return NextResponse.json({ success: true, job_id });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
