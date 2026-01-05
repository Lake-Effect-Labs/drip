"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, copyToClipboard } from "@/lib/utils";
import type { Invoice, Customer, Job } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Send,
  User,
  MapPin,
  FileText,
  CreditCard,
  Banknote,
} from "lucide-react";

type InvoiceWithDetails = Invoice & {
  customer: Customer;
  job: Job;
};

interface InvoiceDetailViewProps {
  invoice: InvoiceWithDetails;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
];

export function InvoiceDetailView({ invoice: initialInvoice }: InvoiceDetailViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [invoice, setInvoice] = useState(initialInvoice);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [markingPaid, setMarkingPaid] = useState(false);

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/i/${invoice.public_token}`;
  const address = [invoice.job.address1, invoice.job.city, invoice.job.state]
    .filter(Boolean)
    .join(", ");

  async function handleGeneratePaymentLink() {
    setGeneratingLink(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/checkout`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate payment link");
      }

      const data = await response.json();
      setInvoice((prev) => ({
        ...prev,
        stripe_checkout_url: data.checkout_url,
        stripe_checkout_session_id: data.session_id,
      }));

      addToast("Payment link generated!", "success");
    } catch (error) {
      console.error("Error generating payment link:", error);
      addToast("Failed to generate payment link", "error");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleMarkSent() {
    setMarkingSent(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", invoice.id);

      if (error) throw error;

      setInvoice((prev) => ({ ...prev, status: "sent" }));
      addToast("Marked as sent!", "success");
    } catch {
      addToast("Failed to update status", "error");
    } finally {
      setMarkingSent(false);
    }
  }

  function copyInvoiceLink() {
    copyToClipboard(publicUrl);
    addToast("Link copied!", "success");
  }

  function copyInvoiceMessage() {
    const message = `Here's your payment link for ${address || "your project"}: ${publicUrl} — thank you!`;
    copyToClipboard(message);
    addToast("Message copied!", "success");
  }

  async function handleMarkPaidManually() {
    setMarkingPaid(true);
    try {
      // Update invoice to paid
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      // Create payment record
      await supabase.from("invoice_payments").insert({
        invoice_id: invoice.id,
        stripe_payment_intent_id: `manual_${paymentMethod}_${Date.now()}`,
        amount: invoice.amount_total,
        paid_at: new Date().toISOString(),
      });

      // Update job status to paid
      if (invoice.job_id) {
        await supabase
          .from("jobs")
          .update({
            status: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.job_id);
      }

      setInvoice((prev) => ({
        ...prev,
        status: "paid",
        paid_at: new Date().toISOString(),
      }));
      setMarkPaidDialogOpen(false);
      addToast(`Marked as paid via ${paymentMethod}!`, "success");
    } catch {
      addToast("Failed to mark as paid", "error");
    } finally {
      setMarkingPaid(false);
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
                <h1 className="text-2xl font-bold">Invoice</h1>
                <Badge
                  variant={
                    invoice.status === "paid"
                      ? "success"
                      : invoice.status === "sent"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {invoice.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Created {formatDate(invoice.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyInvoiceLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="outline" size="sm" onClick={copyInvoiceMessage}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Message
              </Button>
              {invoice.status === "draft" && (
                <Button size="sm" onClick={handleMarkSent} loading={markingSent}>
                  <Send className="mr-2 h-4 w-4" />
                  Mark Sent
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Customer & Job Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Customer
            </h3>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{invoice.customer.name}</span>
            </div>
            {invoice.customer.phone && (
              <p className="text-sm text-muted-foreground mt-1">
                {invoice.customer.phone}
              </p>
            )}
            {invoice.customer.email && (
              <p className="text-sm text-muted-foreground">
                {invoice.customer.email}
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Job
            </h3>
            <Link
              href={`/app/jobs/${invoice.job.id}`}
              className="font-medium hover:underline flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              {invoice.job.title}
            </Link>
            {address && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {address}
              </p>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="rounded-lg border bg-card p-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
            <p className="text-4xl font-bold">
              {formatCurrency(invoice.amount_total)}
            </p>
          </div>
        </div>

        {/* Payment Link */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold">Payment</h3>

          {invoice.status === "paid" ? (
            <div className="bg-success/10 text-success rounded-lg p-4 text-center">
              <p className="font-semibold">Paid</p>
              {invoice.paid_at && (
                <p className="text-sm">on {formatDate(invoice.paid_at)}</p>
              )}
            </div>
          ) : (
            <>
              {invoice.stripe_checkout_url ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Payment link is ready. Share it with your customer.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
                      {publicUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyInvoiceLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Generate a Stripe payment link so your customer can pay online.
                  </p>
                  <Button
                    onClick={handleGeneratePaymentLink}
                    loading={generatingLink}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Generate Payment Link
                  </Button>
                </div>
              )}

              {/* Manual payment option */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Or record a manual payment (cash, check, Venmo, etc.)
                </p>
                <Button
                  variant="outline"
                  onClick={() => setMarkPaidDialogOpen(true)}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Mark as Paid Manually
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Record a manual payment for {formatCurrency(invoice.amount_total)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMarkPaidDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleMarkPaidManually} loading={markingPaid}>
                <Banknote className="mr-2 h-4 w-4" />
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

