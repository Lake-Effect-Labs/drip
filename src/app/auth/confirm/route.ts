import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  console.log("🔐 Auth confirm - code:", !!code, "next:", next);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log("Exchange result - error:", error?.message, "session:", !!data?.session);

    if (!error && data.session) {
      console.log("✅ Redirecting to:", next);
      return NextResponse.redirect(new URL(next, request.url));
    }
    
    console.error("❌ Exchange failed:", error);
  }

  console.log("Redirecting to login");
  return NextResponse.redirect(new URL("/login?error=Invalid+reset+link", request.url));
}
