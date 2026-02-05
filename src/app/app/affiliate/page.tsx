"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Users, DollarSign, TrendingUp, Link } from "lucide-react";

interface AffiliateData {
  isAffiliate: boolean;
  profile?: { email: string; fullName: string };
  creatorCode?: {
    id: string;
    code: string;
    discountPercent: number;
    commissionPercent: number;
    totalReferrals: number;
    totalConversions: number;
    activeSubscriberCount: number;
    pendingPayout: number;
    isActive: boolean;
    createdAt: string;
  };
  recentReferrals?: {
    converted_at: string | null;
    created_at: string;
  }[];
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate/me");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load affiliate data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createCode = async () => {
    if (!newCode.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create code");
      } else {
        await fetchData();
        setNewCode("");
      }
    } catch {
      setError("Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (!data?.creatorCode) return;
    const url = `${window.location.origin}/?ref=${data.creatorCode.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (!data?.isAffiliate) {
    return (
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Program</CardTitle>
            <CardDescription>
              You are not currently enrolled in the affiliate program. Contact an admin to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const code = data.creatorCode;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
        <p className="text-muted-foreground">
          Track your referrals and commissions
        </p>
      </div>

      {!code ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Your Referral Code</CardTitle>
            <CardDescription>
              Choose a unique code that your referrals will use at signup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. PAINTPRO"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <Button onClick={createCode} disabled={creating || !newCode.trim()}>
                {creating ? "Creating..." : "Create Code"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Referrals</p>
                    <p className="text-2xl font-bold">{code.totalReferrals}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="text-2xl font-bold">{code.totalConversions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Subscribers</p>
                    <p className="text-2xl font-bold">{code.activeSubscriberCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payout</p>
                    <p className="text-2xl font-bold">${code.pendingPayout.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referral link card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Your Referral Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={code.isActive ? "success" : "destructive"}>
                  {code.isActive ? "Active" : "Inactive"}
                </Badge>
                <span className="text-lg font-mono font-bold">{code.code}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {code.commissionPercent}% commission per sale
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${code.code}`}
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={copyLink} className="shrink-0">
                  {copied ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent referrals */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Referrals</CardTitle>
              <CardDescription>Last 10 referral visits</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentReferrals && data.recentReferrals.length > 0 ? (
                <div className="space-y-2">
                  {data.recentReferrals.map((ref, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <span className="text-sm text-muted-foreground">
                        {new Date(ref.created_at).toLocaleDateString()}
                      </span>
                      <Badge variant={ref.converted_at ? "success" : "secondary"}>
                        {ref.converted_at ? "Converted" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No referrals yet. Share your link to get started!
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {error && !code && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
