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
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        addToast("Invalid or expired reset link. Please request a new password reset.", "error");
        setTimeout(() => router.push("/forgot-password"), 2000);
        return;
      }

      setValidSession(true);
    }

    checkSession();
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

      // Get fresh session to ensure we have the latest
      const { data: { session: currentSession }, error: sessionCheckError } = await supabase.auth.getSession();
      
      if (sessionCheckError || !currentSession) {
        console.error("No valid session found:", sessionCheckError);
        addToast("Your reset session has expired. Please request a new password reset.", "error");
        setLoading(false);
        return;
      }

      const userEmail = currentSession.user.email;
      console.log("🔑 Updating password for user:", userEmail);
      console.log("Session details:", {
        email: currentSession.user.email,
        id: currentSession.user.id,
        recovery: !!currentSession.user.recovery_sent_at,
        app_metadata: currentSession.user.app_metadata,
        user_metadata: currentSession.user.user_metadata,
      });

      // Verify this is a recovery session (password reset session)
      // Recovery sessions are created when exchangeCodeForSession is called with a password reset code
      // The session should allow password updates via updateUser
      console.log("Session type check - user ID:", currentSession.user.id);

      // Update the password using the recovery session
      // Don't trim - use exactly what the user entered
      const newPassword = password;
      console.log("📝 Password length:", newPassword.length);

      if (newPassword.length < 6) {
        addToast("Password must be at least 6 characters", "error");
        setLoading(false);
        return;
      }

      console.log("🚀 Calling updateUser with password...");
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("❌ Password update error:", updateError);
        console.error("Error name:", updateError.name);
        console.error("Error message:", updateError.message);
        console.error("Error status:", (updateError as any).status);
        console.error("Full error:", JSON.stringify(updateError, null, 2));
        addToast(`Failed to update password: ${updateError.message}. Please try again or request a new reset link.`, "error");
        setLoading(false);
        return;
      }

      if (!updateData || !updateData.user) {
        console.error("❌ Password update returned no user data");
        console.error("Update data:", updateData);
        addToast("Password update failed - no user data returned. Please try again.", "error");
        setLoading(false);
        return;
      }

      console.log("✅ Password updated successfully!");
      console.log("Updated user email:", updateData.user.email);
      console.log("Updated user ID:", updateData.user.id);
      console.log("Updated at:", updateData.user.updated_at);
      
      // Wait a moment to ensure password update has fully propagated on the server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh the session to ensure it reflects the password update
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error("Session refresh error:", refreshError);
        // Even if refresh fails, password was updated, so continue
      }
      
      setSuccess(true);
      addToast("Password reset successfully! Redirecting to sign in...", "success");
      
      // Store email for pre-fill
      if (typeof window !== "undefined" && userEmail) {
        sessionStorage.setItem("resetEmail", userEmail);
      }
      
      // Wait a bit more to ensure password is fully saved before signing out
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Sign out the recovery session and redirect to login
      // The recovery session should be cleared so user can sign in with new password
      await supabase.auth.signOut();
      
      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1000);
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
