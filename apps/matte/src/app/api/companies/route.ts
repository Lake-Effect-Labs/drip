import { NextResponse } from "next/server";
import { createAdminClient } from "@drip/core/database/server";

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

    // Verify user exists first (admin client can check auth.users)
    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(owner_id);
      if (authError || !authUser?.user) {
        if (process.env.NODE_ENV === "development") {
          console.error("User not found in auth.users:", authError);
        }
        return NextResponse.json(
          { error: "User account not found. If email confirmation is required, please confirm your email first." },
          { status: 400 }
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error checking user:", err);
      }
      // Continue anyway - the function will fail with a clearer error
    }

    // Use the database function for atomic creation
    const { data: companyId, error: functionError } = await supabase.rpc(
      "create_company_with_owner",
      {
        company_name,
        owner_id,
        owner_email,
        owner_name: owner_name || null,
      }
    );

    if (functionError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error creating company:", functionError);
      }
      // Check if it's a foreign key error
      if (functionError.message?.includes("foreign key constraint") || functionError.message?.includes("owner_user_id_fkey")) {
        return NextResponse.json(
          { error: "User account not found. If email confirmation is required, please confirm your email first, then try again." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create company" },
        { status: 500 }
      );
    }

    return NextResponse.json({ company_id: companyId });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in company creation:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

