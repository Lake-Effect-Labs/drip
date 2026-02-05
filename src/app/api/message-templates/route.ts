import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET - List all message templates for the user's company
export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    const { data: templates, error } = await adminSupabase
      .from("message_templates")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(templates || []);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// PUT - Update a message template
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    const body = await request.json();
    const { id, name, body: templateBody, type, subject } = body;

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify template belongs to user's company
    const { data: existing } = await adminSupabase
      .from("message_templates")
      .select("id, company_id")
      .eq("id", id)
      .eq("company_id", companyUser.company_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Extract variables from the body text
    const variables = (templateBody || "").match(/\{\{(\w+)\}\}/g)?.map(
      (v: string) => v.replace(/\{\{|\}\}/g, "")
    ) || [];

    const { data: updated, error } = await adminSupabase
      .from("message_templates")
      .update({
        name: name || undefined,
        body: templateBody || undefined,
        type: type || undefined,
        subject: subject !== undefined ? subject : undefined,
        variables,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// POST - Create a new custom template
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, body: templateBody, type } = body;

    if (!name || !templateBody) {
      return NextResponse.json(
        { error: "Name and body are required" },
        { status: 400 }
      );
    }

    const variables = (templateBody || "").match(/\{\{(\w+)\}\}/g)?.map(
      (v: string) => v.replace(/\{\{|\}\}/g, "")
    ) || [];

    const { data: created, error } = await adminSupabase
      .from("message_templates")
      .insert({
        company_id: companyUser.company_id,
        name,
        body: templateBody,
        type: type || "sms",
        subject: null,
        variables,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
