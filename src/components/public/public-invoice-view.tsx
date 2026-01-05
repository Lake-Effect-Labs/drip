"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, Customer, Job, Company } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplet, CheckCircle, MapPin, User, CreditCard, XCircle } from "lucide-react";

type InvoiceWithDetails = Invoice & {
  customer: Customer;
  job: Job;
  company: Pick<Company, "name"> | null;
};

interface PublicInvoiceViewProps {
  invoice: InvoiceWithDetails;
  success?: boolean;
  canceled?: boolean;
}

export function PublicInvoiceView({
  invoice,
  success,
  canceled,
}: PublicInvoiceViewProps) {
  const [paying, setPaying] = useState(false);

  const address = [invoice.job.address1, invoice.job.city, invoice.job.state, invoice.job.zip]
    .filter(Boolean)
    .join(", ");

  // If payment was successful, show success state
  if (success || invoice.status === "paid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Complete!</h1>
            <p className="text-muted-foreground mb-4">
              Thank you for your payment. {invoice.company?.name} has been notified.
            </p>
            <div className="bg-muted rounded-lg p-4 text-left">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-semibold">
                  {formatCurrency(invoice.amount_total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>
                  {formatDate(invoice.paid_at || new Date().toISOString())}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If payment was canceled
  if (canceled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Canceled</h1>
            <p className="text-muted-foreground mb-6">
              Your payment was not completed. You can try again below.
            </p>
            {invoice.stripe_checkout_url && (
              <a href={invoice.stripe_checkout_url}>
                <Button size="lg" className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function handlePay() {
    if (invoice.stripe_checkout_url) {
      setPaying(true);
      window.location.href = invoice.stripe_checkout_url;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
            <Droplet className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold">{invoice.company?.name}</span>
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
                  Created {formatDate(invoice.created_at)}
                </p>
              </div>
              <Badge variant="secondary">{invoice.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{invoice.customer.name}</span>
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
                {formatCurrency(invoice.amount_total)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{invoice.job.title}</p>
            {address && (
              <p className="text-sm text-muted-foreground mt-1">{address}</p>
            )}
          </CardContent>
        </Card>

        {/* Pay Button */}
        {invoice.stripe_checkout_url ? (
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handlePay}
              loading={paying}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Pay {formatCurrency(invoice.amount_total)}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Secure payment powered by Stripe
            </p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <p>Payment link is being generated. Please refresh the page.</p>
          </div>
        )}
      </main>
    </div>
  );
}

