"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Job, Customer, Company } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paintbrush, MapPin, User, CheckCircle, DollarSign } from "lucide-react";
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
  const [confirmed, setConfirmed] = useState(job.payment_state === "paid");

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  const totalAmount = job.payment_amount || 
    (job.payment_line_items?.reduce((sum, item) => sum + item.price, 0) || 0);

  async function handleMarkPaid() {
    setConfirming(true);
    try {
      const response = await fetch(`/api/payments/${token}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

        {/* Mark as Paid Button */}
        <Card>
          <CardContent className="py-6">
            <Button
              onClick={handleMarkPaid}
              disabled={confirming}
              className="w-full"
              size="lg"
            >
              {confirming ? (
                <>
                  <DollarSign className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Payment as Complete
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Click this button to confirm you've received payment
            </p>
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
