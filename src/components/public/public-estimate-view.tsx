"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Estimate, EstimateLineItem, EstimateMaterial, Customer, Job, Company } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Paintbrush, CheckCircle, MapPin, User } from "lucide-react";
import { PaintChipAnimator } from "@/components/public/paint-chip-animator";
import { EstimateSignoff } from "@/components/public/estimate-signoff";

type EstimateWithDetails = Estimate & {
  line_items: EstimateLineItem[];
  materials: EstimateMaterial[];
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
  const [denying, setDenying] = useState(false);
  const [accepted, setAccepted] = useState(estimate.status === "accepted");
  const [denied, setDenied] = useState(estimate.status === "denied");
  const [error, setError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [showSignoff, setShowSignoff] = useState(
    estimate.requires_signoff && !estimate.signoff_completed_at
  );

  function handleSignoffComplete() {
    setShowSignoff(false);
    setEstimate((prev) => ({
      ...prev,
      signoff_completed_at: new Date().toISOString(),
    }));
  }

  // Calculate totals
  const laborTotal = estimate.labor_total || estimate.line_items.reduce((sum, li) => sum + li.price, 0);
  const materialsTotal = estimate.materials_total || estimate.materials.reduce((sum, m) => sum + (m.line_total || 0), 0);
  const total = laborTotal + materialsTotal;

  const address = estimate.job
    ? [estimate.job.address1, estimate.job.city, estimate.job.state, estimate.job.zip]
        .filter(Boolean)
        .join(", ")
    : "";

  async function handleAccept() {
    setAccepting(true);
    setError("");
    setShowConfirmDialog(false);

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

  async function handleDeny() {
    setDenying(true);
    setError("");
    setShowDenyDialog(false);

    try {
      const response = await fetch(`/api/estimates/${token}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denialReason || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to deny estimate");
      }

      setDenied(true);
      setEstimate((prev) => ({
        ...prev,
        status: "denied",
        denied_at: new Date().toISOString(),
        denial_reason: denialReason || null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDenying(false);
    }
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <PaintChipAnimator />
        <Card className="w-full max-w-md text-center relative z-20">
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

  if (denied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <PaintChipAnimator />
        <Card className="w-full max-w-md text-center relative z-20">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Estimate Declined</h1>
            <p className="text-muted-foreground mb-4">
              Thank you for your response. {estimate.company?.name} has been notified of your decision.
            </p>
            {estimate.denial_reason && (
              <div className="text-sm text-left bg-muted p-3 rounded-lg mb-4">
                <p className="font-medium mb-1">Your feedback:</p>
                <p className="text-muted-foreground">{estimate.denial_reason}</p>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Declined on {formatDate(estimate.denied_at || new Date().toISOString())}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {estimate.company?.name} may follow up with a revised estimate.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white relative">
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
              <Paintbrush className="w-5 h-5 text-white" />
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

        {/* Line Items (Labor & Services) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Labor & Services</CardTitle>
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
            <div className="p-4 border-t bg-muted/30">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Labor Subtotal</span>
                <span>{formatCurrency(laborTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Materials */}
        {estimate.materials && estimate.materials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Materials</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {estimate.materials.map((material) => (
                  <div key={material.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{material.name}</p>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {material.area_description && (
                            <div>{material.area_description}</div>
                          )}
                          {(material.product_line || material.color_name || material.sheen) && (
                            <div>
                              {material.product_line && `${material.product_line} `}
                              {material.color_name && `${material.color_name} `}
                              {material.color_code && `(${material.color_code}) `}
                              {material.sheen && `- ${material.sheen}`}
                            </div>
                          )}
                          {material.quantity_gallons && (
                            <div>
                              {material.quantity_gallons} gallons
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="font-medium ml-4">
                        {formatCurrency(material.line_total || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t bg-muted/30">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Materials Subtotal</span>
                  <span>{formatCurrency(materialsTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total Summary */}
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Labor Total:</span>
                <span className="font-medium text-foreground">{formatCurrency(laborTotal)}</span>
              </div>
              {materialsTotal > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Materials Total:</span>
                  <span className="font-medium text-foreground">{formatCurrency(materialsTotal)}</span>
                </div>
              )}
              <div className="pt-2 border-t flex items-center justify-between text-xl font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signoff or Accept/Deny Buttons */}
        {showSignoff ? (
          <EstimateSignoff
            estimate={estimate}
            token={token}
            onSignoffComplete={handleSignoffComplete}
          />
        ) : (
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => setShowDenyDialog(true)}
              >
                Decline
              </Button>
              <Button
                size="lg"
                className="w-full"
                onClick={() => setShowConfirmDialog(true)}
              >
                Accept Estimate
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Review the {formatCurrency(total)} estimate above and choose to accept or decline.
            </p>
          </div>
        )}

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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept This Estimate?</DialogTitle>
            <DialogDescription>
              By accepting this {formatCurrency(total)} estimate, you agree to proceed with the project.
              {estimate.company?.name} will contact you to schedule the work.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              loading={accepting}
            >
              Yes, Accept Estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline This Estimate?</DialogTitle>
            <DialogDescription>
              Let {estimate.company?.name} know why you're declining. They may be able to adjust the estimate to better meet your needs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for declining (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Price is too high, timeline doesn't work, found another contractor..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Your feedback helps {estimate.company?.name} provide better service.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDenyDialog(false);
                setDenialReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeny}
              loading={denying}
            >
              Decline Estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaintChipAnimator />
    </div>
  );
}

