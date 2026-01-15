import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  const type = searchParams.get("type"); // Can be 'recovery', 'signup', 'invite', etc.

  console.log("🔐 Auth confirm - code:", !!code, "next:", next, "type:", type);

  if (code) {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      console.log("Exchange result - error:", error?.message, "session:", !!data?.session, "user:", data?.user?.email);

      if (!error && data.session) {
        console.log("✅ Session exchanged successfully for user:", data.user?.email);
        console.log("Session type:", data.session.user?.app_metadata);

        // Create redirect URL
        const redirectUrl = new URL(next, request.url);

        // Add success parameter for password reset flows
        if (next.includes("reset-password")) {
          redirectUrl.searchParams.set("session", "active");
        }

        const response = NextResponse.redirect(redirectUrl);

        // The Supabase client has already set cookies via the cookie handler
        // but we'll ensure they're properly set in the response
        console.log("✅ Redirecting to:", redirectUrl.toString());

        return response;
      }

      console.error("❌ Exchange failed:", error);

      // Provide more specific error messages
      if (error?.message?.includes("expired")) {
        return NextResponse.redirect(
          new URL("/login?error=Link+expired.+Please+request+a+new+one.", request.url)
        );
      }
    } catch (err) {
      console.error("❌ Unexpected error during code exchange:", err);
    }
  }

  console.log("No code or exchange failed, redirecting to login");
  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+link", request.url)
  );
}
