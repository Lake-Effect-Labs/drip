"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start checkout");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Your trial has ended</CardTitle>
          <CardDescription>
            Subscribe to keep using Matte for your painting business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <span className="text-4xl font-bold">$25</span>
            <span className="text-muted-foreground">/month</span>
          </div>

          <ul className="space-y-2">
            {[
              "Unlimited jobs and estimates",
              "Customer management",
              "Photo documentation",
              "Payment proposals",
              "Schedule management",
              "Message templates",
              "Team member access",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {loading ? "Redirecting to checkout..." : "Subscribe Now"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime. Powered by Stripe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
