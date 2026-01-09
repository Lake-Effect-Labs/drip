"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, copyToClipboard } from "@/lib/utils";
import type { Estimate, EstimateLineItem, Customer, Job } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  User,
  MapPin,
  FileText,
  Receipt,
  MessageSquare,
} from "lucide-react";

type EstimateWithDetails = Estimate & {
  line_items: EstimateLineItem[];
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

  const total = estimate.line_items.reduce((sum, li) => sum + li.price, 0);
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${estimate.public_token}`;

  const address = estimate.job
    ? [estimate.job.address1, estimate.job.city, estimate.job.state]
        .filter(Boolean)
        .join(", ")
    : "";

  function copyEstimateMessage() {
    const customerName = estimate.customer?.name || "there";
    const message = `Hey ${customerName} — here's your estimate for ${address || "your project"}: ${publicUrl}`;
    copyToClipboard(message);
    addToast("Message copied!", "success");
  }

  function textEstimate() {
    const customerName = estimate.customer?.name || "there";
    const message = `Hey ${customerName} — here's your estimate for ${address || "your project"}: ${publicUrl}`;
    const phone = estimate.customer?.phone;
    
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

    setCreatingInvoice(true);
    try {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          company_id: estimate.company_id,
          job_id: estimate.job_id,
          customer_id: estimate.customer_id,
          amount_total: total,
          status: "draft",
          public_token: crypto.randomUUID().replace(/-/g, '').substring(0, 24),
        })
        .select()
        .single();

      if (error) throw error;

      addToast("Invoice created!", "success");
      router.push(`/app/invoices/${invoice.id}`);
    } catch (error) {
      console.error("Error creating invoice:", error);
      addToast("Failed to create invoice", "error");
    } finally {
      setCreatingInvoice(false);
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
                      : estimate.status === "sent"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {estimate.status}
                </Badge>
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

        {/* Line Items */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Line Items</h3>
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
            <div className="flex items-center justify-between text-lg font-semibold">
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
              <h3 className="font-semibold text-success mb-1">Estimate Accepted</h3>
              <p className="text-sm text-muted-foreground">
                Accepted on {formatDate(estimate.accepted_at)}
              </p>
            </div>
            <Button onClick={handleCreateInvoice} loading={creatingInvoice} className="w-full">
              <Receipt className="mr-2 h-4 w-4" />
              Create Invoice from This Estimate
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

