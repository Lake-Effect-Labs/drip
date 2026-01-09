"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Estimate, EstimateLineItem, Customer, Job, Company } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplet, CheckCircle, MapPin, User } from "lucide-react";

type EstimateWithDetails = Estimate & {
  line_items: EstimateLineItem[];
  customer: Customer | null;
  job: Job | null;
  company: Pick<Company, "name"> | null;
};

interface PublicEstimateViewProps {
  estimate: EstimateWithDetails;
  token: string;
}

export function PublicEstimateView({ estimate: initialEstimate, token }: PublicEstimateViewProps) {
  const [estimate, setEstimate] = useState(initialEstimate);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(estimate.status === "accepted");
  const [error, setError] = useState("");

  const total = estimate.line_items.reduce((sum, li) => sum + li.price, 0);
  const address = estimate.job
    ? [estimate.job.address1, estimate.job.city, estimate.job.state, estimate.job.zip]
        .filter(Boolean)
        .join(", ")
    : "";

  async function handleAccept() {
    setAccepting(true);
    setError("");

    try {
      const response = await fetch(`/api/estimates/${token}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept estimate");
      }

      setAccepted(true);
      setEstimate((prev) => ({
        ...prev,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAccepting(false);
    }
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Estimate Accepted!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for accepting this estimate. {estimate.company?.name} will be in touch soon to schedule your project.
            </p>
            <div className="text-sm text-muted-foreground">
              Accepted on {formatDate(estimate.accepted_at || new Date().toISOString())}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {(estimate.company as any)?.logo_url ? (
            <img 
              src={(estimate.company as any).logo_url} 
              alt={estimate.company?.name || "Company Logo"}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
              <Droplet className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <span className="font-bold">{estimate.company?.name}</span>
            <p className="text-xs text-muted-foreground">Estimate</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">
                  Estimate for {estimate.customer?.name || "Your Project"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Created {formatDate(estimate.created_at)}
                </p>
              </div>
              <Badge variant="secondary">{estimate.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {estimate.customer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{estimate.customer.name}</span>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Services</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {estimate.line_items.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <p className="font-medium">{formatCurrency(item.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Accept Button */}
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={handleAccept}
            loading={accepting}
          >
            Accept Estimate
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By accepting, you agree to proceed with this estimate.
            {estimate.company?.name} will contact you to schedule.
          </p>
        </div>

        {/* Footer with contact info */}
        {((estimate.company as any)?.contact_phone || (estimate.company as any)?.contact_email) && (
          <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{estimate.company?.name}</p>
            {(estimate.company as any)?.contact_phone && (
              <p>{(estimate.company as any).contact_phone}</p>
            )}
            {(estimate.company as any)?.contact_email && (
              <p>{(estimate.company as any).contact_email}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

