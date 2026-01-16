import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@drip/core/database/server";

// DELETE /api/jobs/[id]/photos/[photoId] - Delete a photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: jobId, photoId } = await params;

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

    // Get the photo to verify ownership and get storage path
    const { data: photo, error: photoError } = await supabase
      .from("job_photos")
      .select("*")
      .eq("id", photoId)
      .eq("job_id", jobId)
      .eq("company_id", companyUser.company_id)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("job-photos")
      .remove([photo.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue anyway, database record should be deleted
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("job_photos")
      .delete()
      .eq("id", photoId);

    if (dbError) {
      console.error("Database delete error:", dbError);
      return NextResponse.json(
        { error: "Failed to delete photo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/jobs/[id]/photos/[photoId] - Update photo tag/caption
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: jobId, photoId } = await params;

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
    const { tag, caption } = body;

    // Update the photo
    const { data: photo, error } = await supabase
      .from("job_photos")
      .update({
        tag: tag || undefined,
        caption: caption !== undefined ? caption : undefined,
      })
      .eq("id", photoId)
      .eq("job_id", jobId)
      .eq("company_id", companyUser.company_id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: "Failed to update photo" },
        { status: 500 }
      );
    }

    return NextResponse.json(photo);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
