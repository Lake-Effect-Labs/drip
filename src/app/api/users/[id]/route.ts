import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check - verify the requester is authenticated and authorized
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Only allow users to delete themselves, or company owners to delete team members
  const adminSupabase = createAdminClient();

  // Check if requester is the same user being deleted
  const isSelfDelete = user.id === id;

  if (!isSelfDelete) {
    // Check if requester owns a company that the target user belongs to
    const { data: requesterCompanies } = await adminSupabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", user.id);

    const { data: targetMemberships } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", id);

    const ownsTargetCompany = requesterCompanies?.some(
      company => targetMemberships?.some(m => m.company_id === company.id)
    );

    if (!ownsTargetCompany) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete yourself or team members from your company" },
        { status: 403 }
      );
    }
  }

  try {
    // Check if user exists
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.getUserById(id);
    
    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user owns any companies
    const { data: ownedCompanies, error: companiesError } = await adminSupabase
      .from("companies")
      .select("id, name")
      .eq("owner_user_id", id);

    if (companiesError) {
      console.error("Error checking owned companies:", companiesError);
      return NextResponse.json(
        { error: "Database error checking company ownership" },
        { status: 500 }
      );
    }

    if (ownedCompanies && ownedCompanies.length > 0) {
      // User owns companies - can't delete them
      return NextResponse.json(
        { 
          error: `Cannot delete user: They own ${ownedCompanies.length} company/companies (${ownedCompanies.map(c => c.name).join(", ")})` 
        },
        { status: 400 }
      );
    }

    // Remove user from all company_users associations first
    const { error: removeError } = await adminSupabase
      .from("company_users")
      .delete()
      .eq("user_id", id);

    if (removeError) {
      console.error("Error removing from company_users:", removeError);
      return NextResponse.json(
        { error: "Database error removing user from companies" },
        { status: 500 }
      );
    }

    // Delete user profile
    const { error: profileError } = await adminSupabase
      .from("user_profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      console.error("Error deleting user profile:", profileError);
      // Continue anyway - profile might not exist
    }

    // Now delete the auth user
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(id);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return NextResponse.json(
        { error: `Database error deleting user: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error deleting user:", error);
    return NextResponse.json(
      { error: "Database error deleting user" },
      { status: 500 }
    );
  }
}
