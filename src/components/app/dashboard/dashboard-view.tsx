"use client";

import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { 
  Briefcase, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  FileText,
  Receipt,
  CheckCircle,
  Clock
} from "lucide-react";
import { JOB_STATUS_LABELS } from "@/lib/utils";

interface DashboardViewProps {
  totalJobs: number;
  totalRevenue: number;
  jobsThisWeek: number;
  jobsByStatus: Record<string, number>;
}

export function DashboardView({
  totalJobs,
  totalRevenue,
  jobsThisWeek,
  jobsByStatus,
}: DashboardViewProps) {
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your business</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{totalJobs}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

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
      </div>
    </div>
  );
}
