import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// API route to link user to company (bypasses RLS)
export async function POST(request: Request) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { company_id, user_id } = body;

    if (!company_id || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert company_users link (admin client bypasses RLS)
    const { error: linkError } = await supabase
      .from("company_users")
      .insert({
        company_id,
        user_id,
      });

    if (linkError) {
      // If already exists, that's fine
      if (linkError.code === "23505") {
        return NextResponse.json({ success: true });
      }
      console.error("Error linking user to company:", linkError);
      return NextResponse.json(
        { error: linkError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in company link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
