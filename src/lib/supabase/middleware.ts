import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const isAppRoute = request.nextUrl.pathname.startsWith("/app");
  const isAuthRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup" ||
    request.nextUrl.pathname === "/reset-password" ||
    request.nextUrl.pathname === "/forgot-password" ||
    request.nextUrl.pathname.startsWith("/join") ||
    request.nextUrl.pathname.startsWith("/auth/confirm");

  if (!user && isAppRoute) {
    // Redirect to login if trying to access app without auth
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && !request.nextUrl.pathname.startsWith("/join")) {
    // Check if user has a company before redirecting
    if (request.nextUrl.pathname === "/signup") {
      // Allow users to stay on signup if they don't have a company yet
      return supabaseResponse;
    }
    
    // For login page, check if user has company before redirecting
    if (request.nextUrl.pathname === "/login") {
      // Try to check if user has a company (using admin client would be better, but we can't in middleware)
      // For now, allow them to stay on login page - they'll be redirected after successful login check
      return supabaseResponse;
    }
  }

  return supabaseResponse;
}

