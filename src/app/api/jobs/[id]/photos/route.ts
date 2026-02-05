import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/subscription";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];

// GET /api/jobs/[id]/photos - List photos for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: jobId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to a company
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    // Verify job belongs to user's company
    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("company_id", companyUser.company_id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get photos for the job
    const { data: photos, error } = await supabase
      .from("job_photos")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching photos:", error);
      return NextResponse.json(
        { error: "Failed to fetch photos" },
        { status: 500 }
      );
    }

    return NextResponse.json(photos || []);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/jobs/[id]/photos - Upload a photo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: jobId } = await params;

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

    const subCheck = await requireActiveSubscription(companyUser.company_id);
    if (subCheck) return subCheck;

    // Verify job exists and belongs to company
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, company_id")
      .eq("id", jobId)
      .eq("company_id", companyUser.company_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const tag = (formData.get("tag") as string) || "other";
    const caption = (formData.get("caption") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, HEIC" },
        { status: 400 }
      );
    }

    // Generate unique ID for photo
    const photoId = crypto.randomUUID();
    const fileExt = file.name.split(".").pop() || "jpg";
    const storagePath = `${companyUser.company_id}/${jobId}/${photoId}.${fileExt}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload photo" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("job-photos").getPublicUrl(storagePath);

    // Create database record
    const { data: photo, error: dbError } = await supabase
      .from("job_photos")
      .insert({
        id: photoId,
        job_id: jobId,
        company_id: companyUser.company_id,
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        tag: tag as "before" | "after" | "other",
        caption: caption,
        uploaded_by_user_id: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Try to cleanup uploaded file
      await supabase.storage.from("job-photos").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to save photo metadata" },
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
