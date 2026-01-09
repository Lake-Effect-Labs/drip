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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    // Handle password reset from URL hash fragments
    async function handlePasswordReset() {
      // Supabase automatically processes hash fragments on page load
      // Wait a bit for Supabase to process the hash and establish session
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        addToast("Invalid or expired reset link", "error");
        setTimeout(() => router.push("/forgot-password"), 2000);
        return;
      }

      if (!session) {
        // Try refreshing the session in case it's still being established
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        
        if (!refreshedSession) {
          addToast("Invalid or expired reset link. Please request a new password reset.", "error");
          setTimeout(() => router.push("/forgot-password"), 2000);
          return;
        }
      }

      setValidSession(true);
    }

    handlePasswordReset();
  }, [router, addToast, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      addToast("Passwords don't match", "error");
      return;
    }

    if (password.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return;
    }

    setLoading(true);

    try {
      // Verify we have a valid session before updating password
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        addToast("Your reset link has expired. Please request a new one.", "error");
        setTimeout(() => router.push("/forgot-password"), 2000);
        setLoading(false);
        return;
      }

      if (!session) {
        addToast("Your reset link has expired. Please request a new one.", "error");
        setTimeout(() => router.push("/forgot-password"), 2000);
        setLoading(false);
        return;
      }

      console.log("Updating password for user:", session.user.email);

      // Update the password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        addToast(updateError.message || "Failed to update password. Please try again.", "error");
        setLoading(false);
        return;
      }

      console.log("Password updated successfully");

      // Wait a moment to ensure the password is saved
      await new Promise(resolve => setTimeout(resolve, 500));

      // Sign out the recovery session
      await supabase.auth.signOut();
      
      setSuccess(true);
      addToast("Password reset successfully! You can now sign in with your new password.", "success");
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error("Unexpected error:", err);
      addToast("An unexpected error occurred. Please try again.", "error");
      setLoading(false);
    }
  }

  if (!validSession) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verifying reset link...</CardTitle>
          <CardDescription>
            Please wait while we verify your reset link
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Password reset!</CardTitle>
          <CardDescription>
            Your password has been successfully reset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Redirecting to sign in...
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="w-full"
          >
            Go to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>
          Enter your new password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Reset password
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-foreground underline hover:no-underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
