"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
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

      // Join company via invite
      const response = await fetch(`/api/invites/${token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: authData.user.id,
          email,
          full_name: fullName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        addToast(data.error || "Failed to join company", "error");
        return;
      }

      addToast("Welcome to the team!", "success");
      router.push("/app");
      router.refresh();
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
        <CardDescription>Create your account to join the team</CardDescription>
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
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Join team
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

