"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Job, Customer, Company } from "@drip/core/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paintbrush, MapPin, User, CheckCircle, DollarSign, CreditCard, Wallet, FileText, Smartphone } from "lucide-react";
import { PaintChipAnimator } from "@/components/public/paint-chip-animator";
import { useRouter } from "next/navigation";

type JobWithDetails = Job & {
  customer: Customer | null;
  company: (Pick<Company, "name"> & {
    logo_url?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  }) | null;
  payment_line_items: Array<{
    id: string;
    title: string;
    price: number; // in cents
  }>;
};

interface PublicPaymentViewProps {
  job: JobWithDetails;
  token: string;
}

export function PublicPaymentView({ job, token }: PublicPaymentViewProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [processingStripe, setProcessingStripe] = useState(false);
  const [confirmed, setConfirmed] = useState(job.payment_state === "paid");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // Check URL params for Stripe success/cancel
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true" && !confirmed) {
        // Payment succeeded via Stripe - mark as confirmed
        setConfirmed(true);
        // Clean URL
        window.history.replaceState({}, "", `/p/${token}`);
      }
    }
  }, [token, confirmed]);

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  const totalAmount = job.payment_amount || 
    (job.payment_line_items?.reduce((sum, item) => sum + item.price, 0) || 0);

  // Get available payment methods (default to cash, check, venmo, stripe if not set)
  const availableMethods = job.payment_methods || ["cash", "check", "venmo", "stripe"];

  async function handleMarkPaid(method: string) {
    setConfirming(true);
    setSelectedMethod(method);
    try {
      const response = await fetch(`/api/payments/${token}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark payment as paid");
      }

      setConfirmed(true);
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      alert("Failed to mark payment as paid. Please try again.");
    } finally {
      setConfirming(false);
      setSelectedMethod(null);
    }
  }

  async function handleStripePayment() {
    setProcessingStripe(true);
    try {
      const response = await fetch(`/api/payments/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment session");
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating Stripe checkout:", error);
      alert(error instanceof Error ? error.message : "Failed to process payment. Please try again.");
      setProcessingStripe(false);
    }
  }

  function getPaymentMethodIcon(method: string) {
    switch (method) {
      case "stripe":
        return <CreditCard className="h-5 w-5" />;
      case "cash":
        return <DollarSign className="h-5 w-5" />;
      case "check":
        return <FileText className="h-5 w-5" />;
      case "venmo":
        return <Smartphone className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  }

  function getPaymentMethodLabel(method: string) {
    switch (method) {
      case "stripe":
        return "Pay Online with Card";
      case "cash":
        return "I Paid with Cash";
      case "check":
        return "I Paid with Check";
      case "venmo":
        return "I Paid via Venmo";
      default:
        return `I Paid via ${method}`;
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <div className="fixed inset-0 pointer-events-none z-10">
          <PaintChipAnimator />
        </div>
        <Card className="w-full max-w-md text-center relative z-20">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for your payment of {formatCurrency(totalAmount)}.
            </p>
            <div className="text-sm text-muted-foreground">
              {job.company?.name} has been notified.
            </div>
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
          {job.company?.logo_url ? (
            <img 
              src={job.company.logo_url} 
              alt={job.company?.name || "Company Logo"}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <span className="font-bold">{job.company?.name}</span>
            <p className="text-xs text-muted-foreground">Invoice</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">Invoice</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {job.payment_approved_at && `Approved ${formatDate(job.payment_approved_at)}`}
                </p>
              </div>
              <Badge variant="secondary">Due</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{job.customer?.name}</span>
            </div>
            {address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amount */}
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Amount Due</p>
              <p className="text-5xl font-bold">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        {job.payment_line_items && job.payment_line_items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.payment_line_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.title}</span>
                    <span className="font-medium">{formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Job Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{job.title}</p>
            {address && (
              <p className="text-sm text-muted-foreground mt-1">{address}</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableMethods.includes("stripe") && (
              <Button
                onClick={handleStripePayment}
                disabled={processingStripe || confirming}
                className="w-full"
                size="lg"
              >
                {processingStripe ? (
                  <>
                    <CreditCard className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Online with Card
                  </>
                )}
              </Button>
            )}

            {availableMethods.filter(m => m !== "stripe").map((method) => (
              <Button
                key={method}
                onClick={() => handleMarkPaid(method)}
                disabled={confirming || processingStripe}
                variant={method === "stripe" ? "default" : "outline"}
                className="w-full"
                size="lg"
              >
                {confirming && selectedMethod === method ? (
                  <>
                    {getPaymentMethodIcon(method)}
                    <span className="ml-2">Confirming...</span>
                  </>
                ) : (
                  <>
                    {getPaymentMethodIcon(method)}
                    <span className="ml-2">{getPaymentMethodLabel(method)}</span>
                  </>
                )}
              </Button>
            ))}

            {availableMethods.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No payment methods configured. Please contact {job.company?.name || "us"} for payment instructions.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer with contact info */}
        {(job.company?.contact_phone || job.company?.contact_email) && (
          <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{job.company?.name}</p>
            {job.company?.contact_phone && (
              <p>{job.company.contact_phone}</p>
            )}
            {job.company?.contact_email && (
              <p>{job.company.contact_email}</p>
            )}
          </div>
        )}
      </main>

      <div className="fixed inset-0 pointer-events-none z-10">
        <PaintChipAnimator />
      </div>
    </div>
  );
}
