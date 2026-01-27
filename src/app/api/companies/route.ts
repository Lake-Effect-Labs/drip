import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createAdminClient();

  try {
    // Authenticate the caller — owner_id must match the session user
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { company_name, owner_name } = body;

    // Derive owner identity from the session, never trust client-supplied owner_id
    const owner_id = user.id;
    const owner_email = user.email!;

    if (!company_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

