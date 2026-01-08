"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, Customer, Job, Company } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplet, MapPin, User } from "lucide-react";

type InvoiceWithDetails = Invoice & {
  customer: Customer;
  job: Job;
  company: Pick<Company, "name"> | null;
};

interface PublicInvoiceViewProps {
  invoice: InvoiceWithDetails;
}

export function PublicInvoiceView({ invoice }: PublicInvoiceViewProps) {
  const address = [invoice.job.address1, invoice.job.city, invoice.job.state, invoice.job.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
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

        {/* Payment Status */}
        {invoice.status === "paid" && invoice.paid_at && (
          <Card>
            <CardContent className="py-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Payment Status</p>
                <p className="text-lg font-semibold text-success">Paid</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Paid on {formatDate(invoice.paid_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

