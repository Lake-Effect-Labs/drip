"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@drip/core/database/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { AlertCircle, Loader2 } from "lucide-react";

interface InviteInfo {
  company_name: string;
  expires_at: string;
  valid: boolean;
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(true);
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    async function checkInvite() {
      try {
        const response = await fetch(`/api/invites/${token}`);
        const data = await response.json();
        
        if (!response.ok) {
          setInviteInfo({ company_name: "", expires_at: "", valid: false });
          return;
        }
        
        setInviteInfo(data);
      } catch {
        setInviteInfo({ company_name: "", expires_at: "", valid: false });
      } finally {
        setInviteLoading(false);
      }
    }

    checkInvite();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let userId: string;
      let userEmail: string;
      let userName: string | null = null;

      if (isSignUp) {
        // Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/join/${token}`,
          },
        });

        if (authError) {
          addToast(authError.message, "error");
          return;
        }

        if (!authData.user) {
          addToast("Failed to create account", "error");
          return;
        }

        userId = authData.user.id;
        userEmail = email;
        userName = fullName;

        // Check if email confirmation is required
        if (authData.session === null && authData.user.identities && authData.user.identities.length === 0) {
          // Email confirmation is required
          addToast("Please check your email to confirm your account. Click the link in the email to continue joining the team.", "success");
          setLoading(false);
          return;
        } else if (!authData.session) {
          // No session but not clear if email confirmation required
          // Wait for session to be established
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            // Still no session, likely needs email confirmation
            addToast("Please check your email to confirm your account, then use this link again to join the team.", "success");
            setLoading(false);
            return;
          }
        }
      } else {
        // Sign in existing user
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          addToast(authError.message, "error");
          return;
        }

        if (!authData.user) {
          addToast("Failed to sign in", "error");
          return;
        }

        userId = authData.user.id;
        userEmail = authData.user.email || email;
        userName = authData.user.user_metadata?.full_name || null;
      }

      // Join company via invite
      const response = await fetch(`/api/invites/${token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          email: userEmail,
          full_name: userName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        addToast(data.error || "Failed to join company", "error");
        return;
      }

      addToast("Welcome to the team!", "success");
      router.push("/app");
    } catch {
      addToast("An unexpected error occurred", "error");
    } finally {
      setLoading(false);
    }
  }

  if (inviteLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Invalid or expired invite</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This invite link is no longer valid. Please ask your team for a new invite.
            </p>
            <Link href="/login">
              <Button variant="outline">Go to login</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Join {inviteInfo.company_name}</CardTitle>
        <CardDescription>
          {isSignUp ? "Create your account to join the team" : "Sign in to join the team"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
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
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@email.com"
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
              minLength={isSignUp ? 6 : undefined}
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            {isSignUp ? "Create account & join" : "Sign in & join"}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

