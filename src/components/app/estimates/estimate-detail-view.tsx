"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, copyToClipboard } from "@/lib/utils";
import type { Estimate, EstimateLineItem, EstimateMaterial, Customer, Job } from "@/types/database";
import { EstimateMaterialsList } from "./estimate-materials-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  User,
  MapPin,
  FileText,
  Receipt,
  MessageSquare,
  Clock,
} from "lucide-react";

type EstimateWithDetails = Estimate & {
  line_items: EstimateLineItem[];
  materials: EstimateMaterial[];
  customer: Customer | null;
  job: Job | null;
};

interface EstimateDetailViewProps {
  estimate: EstimateWithDetails;
}

export function EstimateDetailView({ estimate: initialEstimate }: EstimateDetailViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [estimate, setEstimate] = useState(initialEstimate);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [existingInvoiceId, setExistingInvoiceId] = useState<string | null>(null);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);

  // Calculate totals
  const laborTotal = estimate.labor_total || estimate.line_items.reduce((sum, li) => sum + li.price, 0);
  const materialsTotal = estimate.materials_total || estimate.materials.reduce((sum, m) => sum + (m.line_total || 0), 0);
  const total = laborTotal + materialsTotal;

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${estimate.public_token}`;

  // Refresh estimate data to ensure we have the latest status
  async function refreshEstimate() {
    const { data: refreshedEstimate } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", estimate.id)
      .single();

    if (refreshedEstimate) {
      // Fetch line items, materials, customer, and job
      const [lineItemsResult, materialsResult, customerResult, jobResult] = await Promise.all([
        supabase.from("estimate_line_items").select("*").eq("estimate_id", estimate.id),
        supabase.from("estimate_materials").select("*").eq("estimate_id", estimate.id),
        refreshedEstimate.customer_id
          ? supabase.from("customers").select("*").eq("id", refreshedEstimate.customer_id).single()
          : Promise.resolve({ data: null }),
        refreshedEstimate.job_id
          ? supabase.from("jobs").select("*").eq("id", refreshedEstimate.job_id).single()
          : Promise.resolve({ data: null }),
      ]);

      setEstimate({
        ...refreshedEstimate,
        line_items: lineItemsResult.data || [],
        materials: materialsResult.data || [],
        customer: customerResult.data,
        job: jobResult.data,
      });
    }
  }

  // Refresh estimate when component mounts to ensure we have the latest data
  useEffect(() => {
    const estimateId = estimate.id;
    refreshEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const address = estimate.job
    ? [estimate.job.address1, estimate.job.city, estimate.job.state]
        .filter(Boolean)
        .join(", ")
    : "";

  // Check if invoice already exists for this estimate on mount
  useEffect(() => {
    async function checkExistingInvoice() {
      if (estimate.status !== "accepted") return;
      
      const { data } = await supabase
        .from("invoices")
        .select("id")
        .eq("estimate_id", estimate.id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setExistingInvoiceId(data.id);
      }
    }

    checkExistingInvoice();
  }, [estimate.id, estimate.status, supabase]);

  async function copyEstimateMessage() {
    const customerName = estimate.customer?.name || "there";
    const message = `Hey ${customerName} — here's your estimate for ${address || "your project"}: ${publicUrl}`;
    copyToClipboard(message);
    addToast("Message copied!", "success");
    
    // Mark estimate as "sent" if it's still in "draft" status
    if (estimate.status === "draft") {
      const { data: updatedEstimate, error } = await supabase
        .from("estimates")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", estimate.id)
        .select()
        .single();
      
      if (!error && updatedEstimate) {
        setEstimate((prev) => ({ ...prev, status: "sent" }));
      }
    }
  }

  function getExpirationStatus() {
    if (estimate.status === "accepted" || !estimate.expires_at) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(estimate.expires_at);
    const daysUntilExpiration = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration < 0) {
      return {
        variant: "destructive" as const,
        text: `Expired ${Math.abs(daysUntilExpiration)} day${Math.abs(daysUntilExpiration) !== 1 ? 's' : ''} ago`,
      };
    }

    if (daysUntilExpiration <= 7) {
      return {
        variant: "warning" as const,
        text: `Expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}`,
      };
    }

    return {
      variant: "secondary" as const,
      text: `Valid until ${formatDate(expiresAt)}`,
    };
  }

  function getFollowUpMessage() {
    const customerName = estimate.customer?.name || "there";
    const jobTitle = estimate.job?.title || "your project";
    const companyName = ""; // Can be added from context if needed
    
    let message = `Hi ${customerName},\n\nJust following up on the estimate I sent for ${jobTitle}.\n`;
    
    if (estimate.expires_at) {
      message += `It's set to expire on ${formatDate(estimate.expires_at)}, so I wanted to check if you had any questions.\n`;
    } else {
      message += `Let me know if you have any questions.\n`;
    }
    
    message += `\nYou can review it here: ${publicUrl}\n\n`;
    message += `Thanks${companyName ? `,\n${companyName}` : ''}`;
    
    return message;
  }

  function copyFollowUpMessage() {
    copyToClipboard(getFollowUpMessage());
    addToast("Follow-up message copied!", "success");
    setShowFollowUpDialog(false);
  }

  async function textEstimate() {
    const customerName = estimate.customer?.name || "there";
    const message = `Hey ${customerName} — here's your estimate for ${address || "your project"}: ${publicUrl}`;
    const phone = estimate.customer?.phone;
    
    // Mark estimate as "sent" if it's still in "draft" status
    if (estimate.status === "draft") {
      const { data: updatedEstimate, error } = await supabase
        .from("estimates")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", estimate.id)
        .select()
        .single();
      
      if (!error && updatedEstimate) {
        setEstimate((prev) => ({ ...prev, status: "sent" }));
      }
    }
    
    if (phone && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      // Mobile device - open SMS app
      window.location.href = `sms:${phone}${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(message)}`;
    } else {
      // Desktop - copy message
      copyToClipboard(message);
      addToast("Message copied!", "success");
    }
  }

  async function handleCreateInvoice() {
    if (!estimate.job_id || !estimate.customer_id) {
      addToast("Cannot create invoice without job and customer", "error");
      return;
    }

    // Check if estimate is accepted
    if (estimate.status !== "accepted") {
      addToast("Only accepted estimates can be converted to invoices", "error");
      return;
    }

    setCreatingInvoice(true);
    setCheckingInvoice(true);

    try {
      // First, check if an invoice already exists for this estimate
      const { data: existingInvoices, error: checkError } = await supabase
        .from("invoices")
        .select("id")
        .eq("estimate_id", estimate.id)
        .limit(1);

      if (checkError) throw checkError;

      if (existingInvoices && existingInvoices.length > 0) {
        // Invoice already exists, redirect to it
        const invoiceId = existingInvoices[0].id;
        addToast("Invoice already exists for this estimate", "success");
        router.push(`/app/invoices/${invoiceId}`);
        return;
      }

      setCheckingInvoice(false);

      // Create the invoice with estimate_id to link them
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          company_id: estimate.company_id,
          job_id: estimate.job_id,
          customer_id: estimate.customer_id,
          estimate_id: estimate.id,
          amount_total: total,
          status: "draft",
          public_token: crypto.randomUUID().replace(/-/g, '').substring(0, 24),
        })
        .select()
        .single();

      if (error) {
        // Check if it's a unique constraint violation (race condition)
        if (error.code === "23505") {
          // Another invoice was just created, fetch it and redirect
          const { data: raceInvoice } = await supabase
            .from("invoices")
            .select("id")
            .eq("estimate_id", estimate.id)
            .single();

          if (raceInvoice) {
            addToast("Invoice already exists", "success");
            router.push(`/app/invoices/${raceInvoice.id}`);
            return;
          }
        }
        throw error;
      }

      setExistingInvoiceId(invoice.id);
      addToast("Invoice created!", "success");
      router.push(`/app/invoices/${invoice.id}`);
    } catch (error) {
      console.error("Error creating invoice:", error);
      addToast("Failed to create invoice", "error");
    } finally {
      setCreatingInvoice(false);
      setCheckingInvoice(false);
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Estimate</h1>
                <Badge
                  variant={
                    estimate.status === "accepted"
                      ? "success"
                      : estimate.status === "denied"
                      ? "destructive"
                      : estimate.status === "sent"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {estimate.status}
                </Badge>
                {(() => {
                  const expirationStatus = getExpirationStatus();
                  return expirationStatus ? (
                    <Badge variant={expirationStatus.variant}>
                      <Clock className="mr-1 h-3 w-3" />
                      {expirationStatus.text}
                    </Badge>
                  ) : null;
                })()}
              </div>
              <p className="text-muted-foreground mt-1">
                Created {formatDate(estimate.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={textEstimate}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {estimate.customer?.phone && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Text Estimate' : 'Copy Message'}
              </Button>
              {estimate.status === "sent" && (
                <Button variant="outline" size="sm" onClick={() => setShowFollowUpDialog(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Follow Up
                </Button>
              )}
              {estimate.status === "accepted" && (
                <Button size="sm" onClick={handleCreateInvoice} loading={creatingInvoice}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Customer & Job Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          {estimate.customer && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Customer
              </h3>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{estimate.customer.name}</span>
              </div>
              {estimate.customer.phone && (
                <p className="text-sm text-muted-foreground mt-1">
                  {estimate.customer.phone}
                </p>
              )}
              {estimate.customer.email && (
                <p className="text-sm text-muted-foreground">
                  {estimate.customer.email}
                </p>
              )}
            </div>
          )}

          {estimate.job && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Job
              </h3>
              <Link
                href={`/app/jobs/${estimate.job.id}`}
                className="font-medium hover:underline flex items-center gap-2"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                {estimate.job.title}
              </Link>
              {address && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {address}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Denial Info */}
        {estimate.status === "denied" && estimate.denied_at && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-destructive mb-1">✗ Estimate Declined</h3>
              <p className="text-sm text-muted-foreground">
                Declined on {formatDate(estimate.denied_at)}
              </p>
            </div>
            {estimate.denial_reason && (
              <div className="bg-card p-3 rounded-lg">
                <p className="text-sm font-medium mb-1">Customer Feedback:</p>
                <p className="text-sm text-muted-foreground">{estimate.denial_reason}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/app/estimates/new?from=${estimate.id}`)}
              >
                Create Revised Estimate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyEstimateMessage}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Link to Discuss
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can create a revised estimate or reach out to the customer to discuss their concerns.
            </p>
          </div>
        )}

        {/* Line Items (Labor) */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Labor & Services</h3>
            {estimate.sqft && (
              <p className="text-sm text-muted-foreground">
                Based on {estimate.sqft.toLocaleString()} sqft
              </p>
            )}
          </div>
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
                    {(item.paint_color_name_or_code || item.sheen) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {[
                          item.paint_color_name_or_code,
                          item.sheen,
                          item.product_line,
                          item.gallons_estimate && `${item.gallons_estimate} gal`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}
                  </div>
                  <p className="font-medium">{formatCurrency(item.price)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t bg-muted/50">
            <div className="flex items-center justify-between font-medium">
              <span>Labor Subtotal</span>
              <span>{formatCurrency(laborTotal)}</span>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4">
            <EstimateMaterialsList
              estimateId={estimate.id}
              materials={estimate.materials}
              isEditable={estimate.status !== "accepted"}
              onMaterialsChange={refreshEstimate}
            />
          </div>
        </div>

        {/* Total Summary */}
        <div className="rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Labor Total:</span>
              <span className="font-medium">{formatCurrency(laborTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Materials Total:</span>
              <span className="font-medium">{formatCurrency(materialsTotal)}</span>
            </div>
            <div className="pt-2 border-t flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Public Link */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-2">Share with Customer</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Send this estimate to your customer. They can view and accept it online.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={textEstimate} className="w-full justify-start">
              <MessageSquare className="mr-2 h-4 w-4" />
              {estimate.customer?.phone && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
                ? `Text to ${estimate.customer.name}` 
                : 'Copy Message'}
            </Button>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
                {publicUrl}
              </code>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Acceptance Info & Create Invoice */}
        {estimate.status === "accepted" && estimate.accepted_at && (
          <div className="rounded-lg border border-success bg-success/10 p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-success mb-1">✓ Estimate Accepted</h3>
              <p className="text-sm text-muted-foreground">
                Accepted on {formatDate(estimate.accepted_at)}
              </p>
            </div>
            {!existingInvoiceId ? (
              <Button 
                onClick={handleCreateInvoice} 
                loading={creatingInvoice}
                disabled={checkingInvoice}
                className="w-full bg-success hover:bg-success/90 text-white text-lg py-6"
                size="lg"
              >
                <Receipt className="mr-2 h-5 w-5" />
                Create Invoice ({formatCurrency(total)})
              </Button>
            ) : (
              <Button 
                onClick={() => router.push(`/app/invoices/${existingInvoiceId}`)}
                variant="outline"
                className="w-full"
              >
                <Receipt className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Follow-up Message Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Follow-up Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy this message to text or email to your customer.
            </p>
            <Textarea 
              value={getFollowUpMessage()} 
              readOnly 
              rows={8}
              className="font-sans"
            />
            <Button 
              onClick={copyFollowUpMessage}
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

