"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, DollarSign, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

interface Affiliate {
  codeId: string;
  code: string;
  creatorName: string;
  creatorEmail: string;
  unpaid: number;
  paid: number;
  unpaidCount: number;
  paidCount: number;
  referralIds: string[];
}

interface CommissionsData {
  affiliates: Affiliate[];
  totals: { unpaid: number; paid: number };
}

export default function CommissionsPage() {
  const [data, setData] = useState<CommissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/commissions");
      if (res.status === 403) {
        setError("You do not have admin access.");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markPaid = async (affiliate: Affiliate) => {
    if (affiliate.referralIds.length === 0) return;
    setPaying(affiliate.codeId);
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralIds: affiliate.referralIds }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to mark as paid");
      } else {
        await fetchData();
      }
    } catch {
      setError("Failed to mark as paid");
    } finally {
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/app/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Commission Payouts</h1>
          <p className="text-muted-foreground">
            Track and process affiliate commission payments
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Unpaid</p>
                  <p className="text-2xl font-bold">${data.totals.unpaid.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold">${data.totals.paid.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Affiliate list */}
      {data && data.affiliates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No affiliate conversions yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.affiliates.map((affiliate) => (
            <Card key={affiliate.codeId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{affiliate.creatorName}</CardTitle>
                    <CardDescription>{affiliate.creatorEmail} &middot; Code: {affiliate.code}</CardDescription>
                  </div>
                  {affiliate.unpaidCount > 0 && (
                    <Button
                      size="sm"
                      onClick={() => markPaid(affiliate)}
                      disabled={paying === affiliate.codeId}
                    >
                      {paying === affiliate.codeId ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      Mark All Paid
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Unpaid: </span>
                    <Badge variant={affiliate.unpaidCount > 0 ? "warning" : "secondary"}>
                      ${affiliate.unpaid.toFixed(2)} ({affiliate.unpaidCount})
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid: </span>
                    <Badge variant="success">
                      ${affiliate.paid.toFixed(2)} ({affiliate.paidCount})
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
