"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrency,
  generateToken,
  SERVICE_TYPES,
  SERVICE_LABELS,
} from "@/lib/utils";
import type { Job, Customer, EstimatingConfig } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };

interface LineItem {
  id: string;
  service_key: string;
  service_type: "sqft" | "flat";
  name: string;
  description: string;
  price: number;
  paint_color_name_or_code: string;
  sheen: string;
  product_line: string;
  gallons_estimate: string;
}

interface EstimateBuilderProps {
  companyId: string;
  config: EstimatingConfig | null;
  job: JobWithCustomer | null;
  customer: Customer | null;
  customers: Customer[];
}

const SHEENS = ["Flat", "Matte", "Eggshell", "Satin", "Semi-Gloss", "High-Gloss"];

export function EstimateBuilder({
  companyId,
  config,
  job,
  customer: initialCustomer,
  customers,
}: EstimateBuilderProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [useSqftPricing, setUseSqftPricing] = useState(false);
  const [sqft, setSqft] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      service_key: "other",
      service_type: "flat",
      name: "",
      description: "",
      price: 0,
      paint_color_name_or_code: "",
      sheen: "Eggshell",
      product_line: "",
      gallons_estimate: "",
    },
  ]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialCustomer?.id || ""
  );

  // New customer form
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  const rates = {
    walls: config?.walls_rate_per_sqft || 2.0,
    ceilings: config?.ceilings_rate_per_sqft || 0.5,
    trim: config?.trim_rate_per_sqft || 0.75,
  };

  // Auto-add sqft services when sqft changes (only if using sqft pricing)
  useEffect(() => {
    if (!useSqftPricing) return;
    
    const sqftNum = parseFloat(sqft);
    if (!sqftNum || sqftNum <= 0) return;

    setLineItems((prev) => {
      const updated = [...prev];

      // Add or update sqft services
      SERVICE_TYPES.sqft.forEach((serviceKey) => {
        const existingIndex = updated.findIndex(
          (li) => li.service_key === serviceKey
        );
        const rate =
          serviceKey === "interior_walls"
            ? rates.walls
            : serviceKey === "ceilings"
            ? rates.ceilings
            : rates.trim;
        const price = Math.round(sqftNum * rate * 100);

        const defaultSheen = 
          serviceKey === "interior_walls" ? "Eggshell" :
          serviceKey === "trim_doors" ? "Satin" :
          "Eggshell";

        if (existingIndex >= 0) {
          updated[existingIndex].price = price;
        } else {
          updated.push({
            id: crypto.randomUUID(),
            service_key: serviceKey,
            service_type: "sqft",
            name: SERVICE_LABELS[serviceKey],
            description: "",
            price,
            paint_color_name_or_code: "",
            sheen: defaultSheen,
            product_line: "",
            gallons_estimate: "",
          });
        }
      });

      return updated;
    });
  }, [useSqftPricing, sqft, rates.walls, rates.ceilings, rates.trim]);

  function addLineItem() {
    const isPaintService = true; // Default to paint service
    const defaultSheen = "Eggshell";
    
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        service_key: "other",
        service_type: "flat",
        name: "",
        description: "",
        price: 0,
        paint_color_name_or_code: "",
        sheen: defaultSheen,
        product_line: "",
        gallons_estimate: "",
      },
    ]);
  }

  function getDefaultSheen(serviceName: string): string {
    const lowerName = serviceName.toLowerCase();
    if (lowerName.includes("wall") || lowerName.includes("interior")) return "Eggshell";
    if (lowerName.includes("trim") || lowerName.includes("door")) return "Satin";
    if (lowerName.includes("cabinet")) return "Semi-Gloss";
    return "Eggshell";
  }

  function isPaintRelatedService(serviceName: string): boolean {
    const lowerName = serviceName.toLowerCase();
    const nonPaintKeywords = ["prep", "repair", "patch", "sand", "demo", "removal"];
    return !nonPaintKeywords.some(keyword => lowerName.includes(keyword));
  }

  function updateLineItem(id: string, updates: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, ...updates } : li))
    );
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  const total = lineItems.reduce((sum, li) => sum + li.price, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lineItems.length === 0) {
      addToast("Add at least one line item", "error");
      return;
    }

    setLoading(true);

    try {
      let customerId = selectedCustomerId;

      // Create new customer if needed
      if (!customerId && newCustomerName.trim()) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            company_id: companyId,
            name: newCustomerName.trim(),
            phone: newCustomerPhone || null,
            email: newCustomerEmail || null,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create estimate
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          company_id: companyId,
          job_id: job?.id || null,
          customer_id: customerId || null,
          sqft: sqft ? parseFloat(sqft) : null,
          status: "draft",
          public_token: generateToken(24),
        })
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Create line items
      const { error: itemsError } = await supabase
        .from("estimate_line_items")
        .insert(
          lineItems.map((li) => ({
            estimate_id: estimate.id,
            service_key: li.service_key,
            service_type: li.service_type,
            name: li.name,
            description: li.description || null,
            price: li.price,
            paint_color_name_or_code: li.paint_color_name_or_code || null,
            sheen: li.sheen || null,
            product_line: li.product_line || null,
            gallons_estimate: li.gallons_estimate
              ? parseFloat(li.gallons_estimate)
              : null,
          }))
        );

      if (itemsError) throw itemsError;

      // Update job status if linked
      if (job && job.status === "new") {
        await supabase
          .from("jobs")
          .update({ status: "quoted", updated_at: new Date().toISOString() })
          .eq("id", job.id);
      }

      addToast("Estimate created!", "success");
      router.push(`/app/estimates/${estimate.id}`);
    } catch (error) {
      console.error("Error creating estimate:", error);
      addToast("Failed to create estimate", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto p-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold">New Estimate</h1>
          {job && (
            <p className="text-muted-foreground mt-1">For: {job.title}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Customer Selection */}
        {!initialCustomer && (
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <h3 className="font-semibold">Customer</h3>
            <div className="space-y-2">
              <Label>Select existing customer</Label>
              <Select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">-- Select or create new --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {!selectedCustomerId && (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">Or create new:</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    placeholder="Name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pricing Method */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useSqftPricing"
              checked={useSqftPricing}
              onChange={(e) => {
                setUseSqftPricing(e.target.checked);
                if (!e.target.checked) {
                  setSqft("");
                  setLineItems([{
                    id: crypto.randomUUID(),
                    service_key: "other",
                    service_type: "flat",
                    name: "",
                    description: "",
                    price: 0,
                    paint_color_name_or_code: "",
                    sheen: "Eggshell",
                    product_line: "",
                    gallons_estimate: "",
                  }]);
                }
              }}
              className="h-4 w-4"
            />
            <label htmlFor="useSqftPricing" className="font-semibold cursor-pointer">
              Use square footage pricing
            </label>
          </div>
          
          {useSqftPricing && (
            <>
              <p className="text-sm text-muted-foreground">
                Enter sqft to auto-calculate prices for walls, ceilings, and trim.
              </p>
              <div className="max-w-xs">
                <Input
                  type="number"
                  placeholder="e.g., 2000"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                />
              </div>
              {sqft && (
                <div className="text-sm text-muted-foreground">
                  Rates: Walls ${rates.walls}/sqft • Ceilings ${rates.ceilings}/sqft
                  • Trim ${rates.trim}/sqft
                </div>
              )}
            </>
          )}
        </div>

        {/* Line Items */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold">Line Items</h3>

          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No line items yet. Click "Add Line Item" below to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Service Name</Label>
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              updateLineItem(item.id, { name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Price</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              className="pl-7"
                              value={(item.price / 100).toFixed(2)}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  price: Math.round(
                                    parseFloat(e.target.value || "0") * 100
                                  ),
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(item.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Additional details..."
                        />
                      </div>

                      {/* Paint details - shown by default for paint services */}
                      {isPaintRelatedService(item.name) && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Color</Label>
                            <Input
                              placeholder="SW 7029"
                              value={item.paint_color_name_or_code}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  paint_color_name_or_code: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Sheen</Label>
                            <Select
                              value={item.sheen}
                              onChange={(e) =>
                                updateLineItem(item.id, { sheen: e.target.value })
                              }
                            >
                              {SHEENS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Product Line</Label>
                            <Input
                              placeholder="Duration"
                              value={item.product_line}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  product_line: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Gallons Est.</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={item.gallons_estimate}
                              onChange={(e) =>
                                updateLineItem(item.id, {
                                  gallons_estimate: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add line item button */}
          <Button
            type="button"
            variant="outline"
            onClick={addLineItem}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Line Item
          </Button>
        </div>

        {/* Total */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Estimate
          </Button>
        </div>
      </form>
    </div>
  );
}

