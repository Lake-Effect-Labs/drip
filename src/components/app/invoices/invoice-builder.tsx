"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, generateToken } from "@/lib/utils";
import type { Job, Customer, Estimate, EstimateLineItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };
type EstimateWithLineItems = Estimate & { line_items: EstimateLineItem[] };

interface InvoiceBuilderProps {
  companyId: string;
  job: JobWithCustomer;
  estimate: EstimateWithLineItems | null;
}

export function InvoiceBuilder({
  companyId,
  job,
  estimate,
}: InvoiceBuilderProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);

  // Calculate total from estimate or allow manual entry
  const estimateTotal = estimate
    ? estimate.line_items.reduce((sum, li) => sum + li.price, 0)
    : 0;

  const [amount, setAmount] = useState(
    estimateTotal ? (estimateTotal / 100).toFixed(2) : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      addToast("Please enter a valid amount", "error");
      return;
    }

    if (!job.customer_id) {
      addToast("Job must have a customer to create invoice", "error");
      return;
    }

    setLoading(true);

    try {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId,
          job_id: job.id,
          customer_id: job.customer_id,
          amount_total: amountCents,
          status: "draft",
          public_token: generateToken(24),
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
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-lg mx-auto p-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold">New Invoice</h1>
          <p className="text-muted-foreground mt-1">For: {job.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4 space-y-6">
        {/* Job Info */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-2">Job Details</h3>
          <p className="text-sm">{job.title}</p>
          {job.customer && (
            <p className="text-sm text-muted-foreground">
              Customer: {job.customer.name}
            </p>
          )}
          {job.address1 && (
            <p className="text-sm text-muted-foreground">
              {[job.address1, job.city, job.state].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold">Invoice Amount</h3>
          {estimate && (
            <p className="text-sm text-muted-foreground">
              Based on accepted estimate: {formatCurrency(estimateTotal)}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                className="pl-7"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}

