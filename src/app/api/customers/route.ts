import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// Get customers for the authenticated user's company
export async function GET(_request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company ID
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "User not associated with a company" },
        { status: 403 }
      );
    }

    // Fetch customers for this company
    const { data: customers, error: customersError } = await adminSupabase
      .from("customers")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .order("name");

    if (customersError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error fetching customers:", customersError);
      }
      return NextResponse.json(
        { error: "Failed to fetch customers" },
        { status: 500 }
      );
    }

    return NextResponse.json(customers || []);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in customer fetch:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Create customer (uses admin client to bypass RLS)
export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      company_id,
      name,
      phone,
      email,
      address1,
      address2,
      city,
      state,
      zip,
    } = body;

    if (!company_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify user belongs to company (using admin client)
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "Unauthorized - not a member of this company" },
        { status: 403 }
      );
    }

    // Create customer (using admin client to bypass RLS)
    const { data: customer, error: customerError } = await adminSupabase
      .from("customers")
      .insert({
        company_id,
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        address1: address1 || null,
        address2: address2 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
      })
      .select()
      .single();

    if (customerError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error creating customer:", customerError);
      }
      return NextResponse.json(
        { error: "Failed to create customer" },
        { status: 500 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in customer creation:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
