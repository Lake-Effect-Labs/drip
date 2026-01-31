import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

// Whitelist of allowed redirect paths to prevent open redirect attacks
const ALLOWED_REDIRECTS = ["/app", "/reset-password", "/join"];

function isAllowedRedirect(path: string): boolean {
  // Only allow internal paths that start with allowed prefixes
  return ALLOWED_REDIRECTS.some(allowed => path === allowed || path.startsWith(allowed + "/") || path.startsWith(allowed + "?"));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/app";
  // Type param is available for future use (e.g., 'recovery', 'signup')
  const _type = searchParams.get("type");

  // Validate redirect path - default to /app if not allowed
  const next = isAllowedRedirect(rawNext) ? rawNext : "/app";

  if (code) {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        // Create redirect URL
        const redirectUrl = new URL(next, request.url);

        // Add success parameter for password reset flows
        if (next.includes("reset-password")) {
          redirectUrl.searchParams.set("session", "active");
        }

        return NextResponse.redirect(redirectUrl);
      }

      // Provide more specific error messages
      if (error?.message?.includes("expired")) {
        return NextResponse.redirect(
          new URL("/login?error=Link+expired.+Please+request+a+new+one.", request.url)
        );
      }
    } catch {
      // Code exchange failed
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+link", request.url)
  );
}
