"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  // Pre-fill email if coming from password reset
  useEffect(() => {
    if (typeof window !== "undefined") {
      const resetEmail = sessionStorage.getItem("resetEmail");
      if (resetEmail) {
        setEmail(resetEmail);
        sessionStorage.removeItem("resetEmail");
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any existing session first to avoid conflicts
      await supabase.auth.signOut({ scope: 'local' });
      
      // Small delay to ensure session is cleared
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trim whitespace from email and password (but don't trim password to avoid issues)
      const trimmedEmail = email.trim().toLowerCase();
      const cleanPassword = password; // Don't trim password - use exactly what user entered

      if (!trimmedEmail || !cleanPassword) {
        addToast("Please enter both email and password", "error");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: cleanPassword,
      });

      if (error) {
        // Provide more helpful error messages
        if (error.message.includes("Invalid login credentials") || 
            error.message.includes("invalid") ||
            error.status === 400) {
          addToast(
            "Invalid email or password. If you just reset your password, make sure you're using the NEW password. If you've forgotten your password, click 'Forgot password?' below.",
            "error"
          );
        } else if (error.message.includes("Email not confirmed")) {
          addToast("Please confirm your email address before signing in. Check your inbox for a confirmation email.", "error");
        } else {
          addToast(`Error: ${error.message}`, "error");
        }
        setLoading(false);
        return;
      }

      if (!data.user || !data.session) {
        addToast("Failed to sign in. Please try again.", "error");
        setLoading(false);
        return;
      }

      // After successful login, just redirect to app
      // The app layout will handle checking for company and redirecting if needed
      // This avoids RLS issues with fresh session
      router.push("/app");
      router.refresh();
    } catch {
      addToast("An unexpected error occurred. Please try again.", "error");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Matte account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground underline hover:no-underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-foreground underline hover:no-underline">
              Sign up
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Having trouble signing in?{" "}
            <Link href="/forgot-password" className="text-primary underline hover:no-underline font-medium">
              Reset your password
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

