import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: companyId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is owner of the company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("owner_user_id")
      .eq("id", companyId)
      .single();

    if (companyError || !company || company.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    // Generate unique ID for logo
    const logoId = crypto.randomUUID();
    const fileExt = file.name.split(".").pop() || "png";
    const storagePath = `${companyId}/logo/${logoId}.${fileExt}`;

    // Delete old logo if exists
    const { data: companyData, error: companyDataError } = await supabase
      .from("companies")
      .select("logo_url")
      .eq("id", companyId)
      .single();

    // Only try to delete old logo if query succeeded and logo_url exists
    if (!companyDataError && companyData?.logo_url) {
      // Extract path from URL if it's a storage URL
      const oldPath = companyData.logo_url.includes("/storage/v1/object/public/company-logos/")
        ? companyData.logo_url.split("/company-logos/")[1]
        : null;
      
      if (oldPath) {
        await supabase.storage.from("company-logos").remove([oldPath]);
      }
    }

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload logo" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("company-logos").getPublicUrl(storagePath);

    // Update company logo_url
    const { error: updateError } = await supabase
      .from("companies")
      .update({ logo_url: publicUrl })
      .eq("id", companyId);

    if (updateError) {
      console.error("Database update error:", updateError);
      // Try to cleanup uploaded file
      await supabase.storage.from("company-logos").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to update company logo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ logo_url: publicUrl });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
