import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  console.log("🔐 Auth confirm - code:", !!code, "next:", next);

  if (code) {
    const cookieStore = await cookies();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log("Exchange result - error:", error?.message, "session:", !!data?.session);

    if (!error && data.session) {
      console.log("✅ Session exchanged successfully, redirecting to:", next);
      
      // Create redirect response
      const redirectUrl = new URL(next, request.url);
      const response = NextResponse.redirect(redirectUrl);
      
      // Ensure all auth cookies are properly set in the response
      // The Supabase client should have already set them via setAll, but we ensure they're in the response
      const authCookies = cookieStore.getAll().filter(cookie => 
        cookie.name.startsWith('sb-') || cookie.name.includes('auth')
      );
      
      authCookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      });
      
      return response;
    }
    
    console.error("❌ Exchange failed:", error);
  }

  console.log("Redirecting to login");
  return NextResponse.redirect(new URL("/login?error=Invalid+reset+link", request.url));
}
