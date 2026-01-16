"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { 
  Briefcase, 
  DollarSign, 
  Package, 
  Clock,
  ArrowRight,
  AlertTriangle
} from "lucide-react";

interface DashboardData {
  activeJobs: number;
  outstandingPayments: number;
  lowInventoryCount: number;
  lowInventoryItems: Array<{
    id: string;
    name: string;
    on_hand: number;
    reorder_at: number;
    unit: string;
  }>;
  todayHours: number;
  weekHours: number;
  hasTimeTracking: boolean;
}

interface DashboardViewProps {
  data: DashboardData;
}

export function DashboardView({ data }: DashboardViewProps) {
  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Quick overview of your business</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Jobs
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeJobs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled or in progress
            </p>
          </CardContent>
        </Card>

        {/* Outstanding Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Payments
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.outstandingPayments)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payment requests pending
            </p>
          </CardContent>
        </Card>

        {/* Low Inventory */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Inventory
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.lowInventoryCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Items need reordering
            </p>
          </CardContent>
        </Card>

        {/* Time Tracking */}
        {data.hasTimeTracking ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hours This Week
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.weekHours}h</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.todayHours}h today
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="opacity-50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Time Tracking
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                No time entries yet
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Inventory Items */}
        {data.lowInventoryCount > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Low Inventory Items</CardTitle>
                <Link 
                  href="/app/inventory"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {data.lowInventoryItems.length > 0 ? (
                <div className="space-y-3">
                  {data.lowInventoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.on_hand} {item.unit} on hand • Reorder at {item.reorder_at}
                          </p>
                        </div>
                      </div>
                      <Badge variant="warning">Low</Badge>
                    </div>
                  ))}
                  {data.lowInventoryCount > data.lowInventoryItems.length && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{data.lowInventoryCount - data.lowInventoryItems.length} more items
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All inventory levels are good
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
