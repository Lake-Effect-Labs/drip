"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { 
  Briefcase, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  FileText,
  Receipt,
  CheckCircle,
  Clock,
  Download,
  Package,
} from "lucide-react";
import { JOB_STATUS_LABELS } from "@/lib/utils";

interface DashboardViewProps {
  totalJobs: number;
  totalRevenue: number;
  jobsThisWeek: number;
  jobsByStatus: Record<string, number>;
  companyId: string;
  materialCounts: Record<string, { total: number; checked: number }>;
  isOwner: boolean;
}

export function DashboardView({
  totalJobs,
  totalRevenue,
  jobsThisWeek,
  jobsByStatus,
  companyId,
  materialCounts,
  isOwner,
}: DashboardViewProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { addToast } = useToast();
  const supabase = createClient();

  async function handleExport() {
    if (!startDate || !endDate) {
      addToast("Please select both start and end dates", "error");
      return;
    }

    setExporting(true);

    try {
      // Fetch jobs with customer info
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(name, phone, email, address1, city, state, zip)
        `)
        .eq("company_id", companyId)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch invoices for these jobs
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", companyId)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (invoicesError) throw invoicesError;

      // Create CSV
      const csv = [
        [
          "Date",
          "Job Title",
          "Customer Name",
          "Customer Phone",
          "Customer Email",
          "Address",
          "Job Status",
          "Invoice Amount",
          "Invoice Status",
          "Payment Date",
        ].join(","),
        ...(jobs || []).map((job) => {
          const jobInvoices = (invoices || []).filter((inv) => inv.job_id === job.id);
          const totalInvoiced = jobInvoices.reduce((sum, inv) => sum + inv.amount_total, 0);
          const paidInvoices = jobInvoices.filter((inv) => inv.status === "paid");
          const paymentDate = paidInvoices.length > 0 
            ? paidInvoices[0].updated_at 
            : "";

          const customer = job.customer as any;
          const address = customer
            ? [customer.address1, customer.city, customer.state, customer.zip]
                .filter(Boolean)
                .join(", ")
            : "";

          return [
            formatDate(job.created_at),
            `"${job.title.replace(/"/g, '""')}"`,
            customer ? `"${customer.name.replace(/"/g, '""')}"` : "",
            customer?.phone || "",
            customer?.email || "",
            `"${address.replace(/"/g, '""')}"`,
            job.status,
            totalInvoiced.toFixed(2),
            jobInvoices.length > 0 ? jobInvoices[0].status : "none",
            paymentDate ? formatDate(paymentDate) : "",
          ].join(",");
        }),
      ].join("\n");

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jobs-export-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      addToast("Export complete!", "success");
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      addToast("Failed to export data", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your business</p>
          </div>
          {isOwner && (
            <Button onClick={() => setExportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export Jobs
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className={cn(
          "grid gap-4",
          isOwner ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3"
        )}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{totalJobs}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          {isOwner && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jobs This Week</p>
                <p className="text-2xl font-bold">{jobsThisWeek}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold">
                  {(jobsByStatus["in_progress"] || 0) + (jobsByStatus["scheduled"] || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Jobs by Status */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Jobs by Status</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(jobsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  {status === "done" || status === "paid" ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : status === "in_progress" || status === "scheduled" ? (
                    <Clock className="h-5 w-5 text-warning" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] || status}</p>
                  <p className="text-sm text-muted-foreground">{count} job{count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Materials Tracking */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Materials Needed</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Across active jobs
            </p>
          </div>
          {Object.keys(materialCounts).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No materials needed for active jobs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(materialCounts)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 10)
                .map(([name, counts]) => (
                  <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {counts.checked} of {counts.total} checked off
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium">{counts.total}×</p>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-success transition-all"
                            style={{ width: `${(counts.checked / counts.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {Object.keys(materialCounts).length > 10 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  + {Object.keys(materialCounts).length - 10} more materials
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Jobs Data</DialogTitle>
            <DialogDescription>
              Export job and invoice data for accounting purposes. Select a date range to export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Export includes:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Job details and status</li>
                <li>Customer information</li>
                <li>Invoice amounts and payment status</li>
                <li>Payment dates</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExportDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleExport} loading={exporting}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
