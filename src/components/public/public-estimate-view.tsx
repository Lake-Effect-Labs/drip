"use client";

import { useState, useEffect } from "react";
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
  company: (Pick<Company, "name"> & { logo_url?: string | null }) | null;
};

interface PublicEstimateViewProps {
  estimate: EstimateWithDetails;
  token: string;
}

export function PublicEstimateView({ estimate: initialEstimate, token }: PublicEstimateViewProps) {
  // Constants for consistent rendering
  const ESTIMATE_DETAILS_TITLE = "Estimate Details";
  
  const [estimate, setEstimate] = useState(initialEstimate);
  const [accepting, setAccepting] = useState(false);
  const [denying, setDenying] = useState(false);
  const [accepted, setAccepted] = useState(initialEstimate.status === "accepted");
  const [denied, setDenied] = useState(initialEstimate.status === "denied");
  const [error, setError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [showSignoff, setShowSignoff] = useState(
    initialEstimate.requires_signoff && !initialEstimate.signoff_completed_at
  );

  function handleSignoffComplete() {
    setShowSignoff(false);
    setEstimate((prev) => ({
      ...prev,
      signoff_completed_at: new Date().toISOString(),
    }));
  }

  // Calculate totals - use estimate state for reactive rendering
  const laborTotal = estimate.labor_total || (estimate.line_items?.length > 0
    ? estimate.line_items.reduce((sum, li) => sum + li.price, 0)
    : 0);
  const total = laborTotal;

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

      const data = await response.json();
      
      // Immediately reload page to show unified view (stays on same URL)
      // Server-side code will detect accepted status and show UnifiedPublicJobView
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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

  // If estimate is already accepted, server-side should have shown unified view
  // If we're still here, reload to get the unified view
  useEffect(() => {
    if (initialEstimate.status === "accepted" && initialEstimate.job_id) {
      window.location.reload();
    }
  }, [initialEstimate.status, initialEstimate.job_id]);
  
  // Don't render anything if estimate is accepted - let server-side handle it
  if (initialEstimate.status === "accepted" && initialEstimate.job_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <PaintChipAnimator />
        <Card className="w-full max-w-md text-center relative z-20">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Estimate Accepted!</h1>
            <p className="text-muted-foreground mb-6">Loading your job details...</p>
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

        {/* Line Items with Materials */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold leading-none tracking-tight text-lg">
              {ESTIMATE_DETAILS_TITLE}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {((estimate.line_items || [])).map((item) => {
                const hasPaintDetails = item.product_line || item.paint_color_name_or_code || item.sheen || item.gallons_estimate;

                // Parse notes from description field (format: "BRAND:brand|PRODUCT_LINE:line|NOTES:notes")
                let lineItemNotes: string | null = null;
                if (item.description) {
                  const notesMatch = item.description.match(/NOTES:([^|]+)/);
                  if (notesMatch) {
                    lineItemNotes = notesMatch[1];
                  }
                }

                // Find materials for this line item (match by ID or by area name)
                // Use more flexible matching to catch variations like "Ceilings" vs "Ceiling"
                const itemNameLower = item.name?.toLowerCase() || '';
                const itemMaterials = (estimate.materials || [])?.filter(
                  (m: EstimateMaterial) => {
                    // Direct ID match (most reliable)
                    if (m.estimate_line_item_id === item.id) return true;

                    // Area description match (normalize both sides)
                    const areaDescLower = m.area_description?.toLowerCase() || '';
                    if (areaDescLower && itemNameLower) {
                      // Check if either contains the other (handles "Ceilings" vs "Ceiling")
                      if (areaDescLower.includes(itemNameLower) || itemNameLower.includes(areaDescLower)) {
                        return true;
                      }
                      // Also check for partial matches (e.g., "Interior Walls" contains "Walls")
                      const itemWords = itemNameLower.split(/\s+/);
                      const areaWords = areaDescLower.split(/\s+/);
                      // If any significant word matches, consider it a match
                      if (itemWords.some(word => word.length > 3 && areaWords.includes(word))) {
                        return true;
                      }
                    }
                    return false;
                  }
                ) || [];
                
                return (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="font-medium">{item.name}</p>
                          {item.sqft && (
                            <span className="text-sm text-muted-foreground">
                              {item.sqft} sqft
                              {item.rate_per_sqft && ` @ ${formatCurrency(item.rate_per_sqft)}/sqft`}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="font-medium ml-4 shrink-0">{formatCurrency(item.price)}</p>
                    </div>
                    
                    {/* Materials for this area */}
                    {itemMaterials.length > 0 && (
                      <div className="ml-0 mt-3 space-y-2 border-l-2 border-muted pl-3">
                        {itemMaterials.map((material: EstimateMaterial) => (
                          <div key={material.id} className="text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 text-muted-foreground">
                                {material.paint_product && (
                                  <div className="font-medium text-foreground">
                                    {material.paint_product}
                                  </div>
                                )}
                                {!material.paint_product && material.product_line && (
                                  <div className="font-medium text-foreground">
                                    {material.product_line}
                                  </div>
                                )}
                                {!material.paint_product && !material.product_line && (
                                  <div className="font-medium text-foreground">
                                    {material.name}
                                  </div>
                                )}
                                <div>
                                  {material.color_name && <span>{material.color_name}</span>}
                                  {material.color_code && <span className="ml-1 text-xs">({material.color_code})</span>}
                                  {material.sheen && (
                                    <span className="ml-1">- {material.sheen}</span>
                                  )}
                                </div>
                                {/* Show notes from material or line item */}
                                {(material.notes || lineItemNotes) && (
                                  <div className="mt-1 text-xs italic text-muted-foreground">
                                    {material.notes || lineItemNotes}
                                  </div>
                                )}
                              </div>
                              {material.quantity_gallons && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {material.quantity_gallons} {material.quantity_gallons === 1 ? 'gallon' : 'gallons'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Show notes if no materials but notes exist */}
                    {itemMaterials.length === 0 && lineItemNotes && (
                      <div className="mt-2 text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                        {lineItemNotes}
                      </div>
                    )}
                    
                    {/* Legacy paint details if no materials */}
                    {itemMaterials.length === 0 && hasPaintDetails && (
                      <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
                        {(item.product_line || item.paint_color_name_or_code || item.sheen) && (
                          <div>
                            {item.product_line && <span>{item.product_line} </span>}
                            {item.paint_color_name_or_code && <span>{item.paint_color_name_or_code} </span>}
                            {item.sheen && <span>- {item.sheen}</span>}
                          </div>
                        )}
                        {item.gallons_estimate && (
                          <div>{item.gallons_estimate} gallons</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Total Summary */}
        <Card>
          <CardContent className="p-6 pt-6">
            <div className="flex items-center justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatCurrency(laborTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Signoff or Accept/Deny Buttons */}
        {showSignoff ? (
          <EstimateSignoff
            estimate={estimate}
            token={token}
            onSignoffComplete={handleSignoffComplete}
            companyLogo={estimate.company?.logo_url}
            companyName={estimate.company?.name}
          />
        ) : (
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 gap-3">
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

      {!accepted && !denied && <PaintChipAnimator />}
    </div>
  );
}

