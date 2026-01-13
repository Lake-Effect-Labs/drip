"use client";

import { useState } from "react";
import { EstimateWithLineItems } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EstimateSignoffProps {
  estimate: EstimateWithLineItems;
  token: string;
  onSignoffComplete: () => void;
}

export function EstimateSignoff({ estimate, token, onSignoffComplete }: EstimateSignoffProps) {
  const [customerName, setCustomerName] = useState("");
  const [acknowledgedScope, setAcknowledgedScope] = useState(false);
  const [acknowledgedMaterials, setAcknowledgedMaterials] = useState(false);
  const [acknowledgedAreas, setAcknowledgedAreas] = useState(false);
  const [acknowledgedTerms, setAcknowledgedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate scope summary
  const scopeItems = estimate.line_items.map((item) => {
    const parts = [item.name];
    if (item.description) parts.push(item.description);
    return parts.join(" - ");
  });

  // Generate materials summary
  const materialsItems = estimate.materials?.map((material) => {
    const parts = [];
    if (material.paint_product) parts.push(material.paint_product);
    if (material.product_line) parts.push(material.product_line);
    if (material.color_name) parts.push(material.color_name);
    if (material.color_code) parts.push(`(${material.color_code})`);
    if (material.sheen) parts.push(`- ${material.sheen}`);
    if (material.quantity_gallons) parts.push(`${material.quantity_gallons} gal`);
    return parts.join(" ");
  }) || [];

  // Generate areas summary
  const uniqueAreas = new Set(
    estimate.materials?.map((m) => m.area_description).filter((a) => a) || []
  );
  const areasArray = Array.from(uniqueAreas);

  const canSubmit =
    customerName.trim() &&
    acknowledgedScope &&
    acknowledgedMaterials &&
    acknowledgedAreas &&
    acknowledgedTerms;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) {
      setError("Please complete all required fields and acknowledgments");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/estimates/${token}/signoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: customerName,
          acknowledged_scope: acknowledgedScope,
          acknowledged_materials: acknowledgedMaterials,
          acknowledged_areas: acknowledgedAreas,
          acknowledged_terms: acknowledgedTerms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit signoff");
      }

      onSignoffComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Agreement Required</CardTitle>
          <CardDescription>
            Please review the following details and provide your acknowledgment before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scope of Work */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Scope of Work</h3>
            <div className="bg-muted p-3 rounded-lg space-y-1">
              {scopeItems.length > 0 ? (
                scopeItems.map((item, index) => (
                  <div key={index} className="text-sm">
                    • {item}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No scope items specified</p>
              )}
            </div>
          </div>

          {/* Materials */}
          {materialsItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Paint Products & Materials</h3>
              <div className="bg-muted p-3 rounded-lg space-y-1">
                {materialsItems.map((item, index) => (
                  <div key={index} className="text-sm">
                    • {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Areas */}
          {areasArray.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Areas Included</h3>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">{areasArray.join(", ")}</p>
              </div>
            </div>
          )}

          {/* Acknowledgments */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Acknowledgments</h3>

            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="ack-scope"
                  checked={acknowledgedScope}
                  onChange={(e) => setAcknowledgedScope(e.target.checked)}
                />
                <Label htmlFor="ack-scope" className="text-sm leading-tight cursor-pointer">
                  I acknowledge and agree to the scope of work as described above
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="ack-materials"
                  checked={acknowledgedMaterials}
                  onChange={(e) => setAcknowledgedMaterials(e.target.checked)}
                />
                <Label htmlFor="ack-materials" className="text-sm leading-tight cursor-pointer">
                  I acknowledge the paint products and materials that will be used
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="ack-areas"
                  checked={acknowledgedAreas}
                  onChange={(e) => setAcknowledgedAreas(e.target.checked)}
                />
                <Label htmlFor="ack-areas" className="text-sm leading-tight cursor-pointer">
                  I acknowledge the areas to be painted as specified
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="ack-terms"
                  checked={acknowledgedTerms}
                  onChange={(e) => setAcknowledgedTerms(e.target.checked)}
                />
                <Label htmlFor="ack-terms" className="text-sm leading-tight cursor-pointer">
                  I understand that this agreement is binding and agree to the terms of this estimate
                </Label>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="customer-name">Your Full Name *</Label>
              <Input
                id="customer-name"
                type="text"
                placeholder="Enter your full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Agreement"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground text-center">
        By submitting this agreement, you confirm that you have reviewed and agreed to all the details above.
        Your IP address and timestamp will be recorded for verification purposes.
      </div>
    </div>
  );
}
