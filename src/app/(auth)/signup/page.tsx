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

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  // Check if user already has a company and redirect them
  useEffect(() => {
    async function checkCompany() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (companyUser) {
          router.push("/app");
        }
      }
    }
    checkCompany();
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if user already exists
      const { data: { user: existingUser } } = await supabase.auth.getUser();

      let userId: string;
      let needsEmailConfirmation = false;

      if (existingUser) {
        // User already logged in, use existing user
        userId = existingUser.id;
      } else {
        // Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app`,
          },
        });

        if (authError) {
          addToast(authError.message, "error");
          setLoading(false);
          return;
        }

        if (!authData.user) {
          addToast("Failed to create account", "error");
          setLoading(false);
          return;
        }

        userId = authData.user.id;

        // Check if email confirmation is required
        if (authData.session === null && authData.user.identities && authData.user.identities.length === 0) {
          // Email confirmation is required
          addToast("Please check your email to confirm your account before continuing.", "success");
          needsEmailConfirmation = true;
        } else if (!authData.session) {
          // No session but not clear if email confirmation required
          // Wait for session to be established
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            // Still no session, likely needs email confirmation
            addToast("Please check your email to confirm your account.", "success");
            setLoading(false);
            return;
          }
        }
      }

      // If email confirmation needed, don't proceed with company creation
      if (needsEmailConfirmation) {
        setLoading(false);
        return;
      }

      // Check if company already exists for this user
      const { data: existingCompanyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingCompanyUser) {
        // Already has company, go to app
        addToast("Account already set up! Redirecting...", "success");
        setLoading(false);
        router.push("/app");
        return;
      }

      // Create the company and associate user
      const companyResponse = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          owner_id: userId,
          owner_email: email,
          owner_name: fullName,
        }),
      });

      if (!companyResponse.ok) {
        let errorMessage = "Failed to create company";
        try {
          const data = await companyResponse.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Response is not JSON, use default message
        }
        addToast(errorMessage, "error");
        setLoading(false);
        return;
      }

      addToast("Account created! Redirecting...", "success");
      router.push("/app");
    } catch (error) {
      console.error("Signup error:", error);
      addToast("An unexpected error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start your free trial of Matte</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Your name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Smith Painting Co."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
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
            <Label htmlFor="password">Password</Label>
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
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline hover:no-underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

