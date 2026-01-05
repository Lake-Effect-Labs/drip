import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { company_name, owner_id, owner_email, owner_name } = body;

    if (!company_name || !owner_id || !owner_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: company_name,
        owner_user_id: owner_id,
      })
      .select()
      .single();

    if (companyError) {
      console.error("Error creating company:", companyError);
      return NextResponse.json(
        { error: companyError.message },
        { status: 500 }
      );
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert({
        id: owner_id,
        email: owner_email,
        full_name: owner_name || null,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
    }

    // Add user to company
    const { error: memberError } = await supabase
      .from("company_users")
      .insert({
        company_id: company.id,
        user_id: owner_id,
      });

    if (memberError) {
      console.error("Error adding user to company:", memberError);
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    // Create default estimating config
    await supabase.from("estimating_config").insert({
      company_id: company.id,
    });

    return NextResponse.json({ company_id: company.id });
  } catch (error) {
    console.error("Error in company creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

