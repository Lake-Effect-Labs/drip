"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  Building,
  Users,
  Gift,
  Search,
  Loader2,
  UserPlus,
  UserMinus,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyData {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  subscriptionStatus: string;
  jobCount: number;
  crewCount: number;
  createdAt: string;
}

interface AffiliateData {
  id: string;
  email: string;
  fullName: string | null;
  creatorCode: {
    id: string;
    code: string;
    totalReferrals: number;
    totalConversions: number;
    isActive: boolean;
  } | null;
  activeSubscriberCount: number;
}

interface AdminViewProps {
  companies: CompanyData[];
  affiliates: AffiliateData[];
}

export function AdminView({ companies, affiliates: initialAffiliates }: AdminViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [companySearch, setCompanySearch] = useState("");
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [toggleEmail, setToggleEmail] = useState("");
  const [toggling, setToggling] = useState(false);
  const [affiliates, setAffiliates] = useState(initialAffiliates);

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
      c.ownerEmail.toLowerCase().includes(companySearch.toLowerCase())
  );

  const filteredAffiliates = affiliates.filter(
    (a) =>
      a.email.toLowerCase().includes(affiliateSearch.toLowerCase()) ||
      (a.fullName || "").toLowerCase().includes(affiliateSearch.toLowerCase()) ||
      (a.creatorCode?.code || "").toLowerCase().includes(affiliateSearch.toLowerCase())
  );

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Active</span>;
      case "past_due":
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Past Due</span>;
      case "canceled":
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">Canceled</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Trial</span>;
    }
  }

  async function handleToggleAffiliate(e: React.FormEvent) {
    e.preventDefault();
    if (!toggleEmail.trim()) return;

    setToggling(true);
    try {
      const response = await fetch("/api/admin/toggle-affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toggleEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle affiliate");
      }

      addToast(
        data.isAffiliate
          ? `${toggleEmail} is now an affiliate`
          : `${toggleEmail} is no longer an affiliate`,
        "success"
      );
      setToggleEmail("");
      router.refresh();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to toggle affiliate",
        "error"
      );
    } finally {
      setToggling(false);
    }
  }

  // Summary stats
  const activeCount = companies.filter((c) => c.subscriptionStatus === "active").length;
  const trialCount = companies.filter((c) => c.subscriptionStatus !== "active" && c.subscriptionStatus !== "canceled").length;
  const totalJobs = companies.reduce((sum, c) => sum + c.jobCount, 0);

  // Payout calculation: $5 per active subscriber per affiliate
  const PAYOUT_PER_SUBSCRIBER = 5;

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-primary">{companies.length}</p>
            <p className="text-sm text-muted-foreground">Total Companies</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{activeCount}</p>
            <p className="text-sm text-muted-foreground">Paying</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{trialCount}</p>
            <p className="text-sm text-muted-foreground">Trial</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold">{totalJobs}</p>
            <p className="text-sm text-muted-foreground">Total Jobs</p>
          </div>
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList>
            <TabsTrigger value="customers">
              <Building className="mr-1.5 h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="affiliates">
              <Gift className="mr-1.5 h-4 w-4" />
              Affiliates
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers" className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or email..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Company</th>
                      <th className="text-left p-3 font-medium">Owner</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-center p-3 font-medium">Jobs</th>
                      <th className="text-center p-3 font-medium">Crew</th>
                      <th className="text-left p-3 font-medium">Signed Up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{company.name}</td>
                        <td className="p-3">
                          <div className="text-sm">{company.ownerName}</div>
                          <div className="text-xs text-muted-foreground">{company.ownerEmail}</div>
                        </td>
                        <td className="p-3 text-center">{getStatusBadge(company.subscriptionStatus)}</td>
                        <td className="p-3 text-center">{company.jobCount}</td>
                        <td className="p-3 text-center">{company.crewCount}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {new Date(company.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No companies found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Affiliates Tab */}
          <TabsContent value="affiliates" className="mt-6 space-y-6">
            {/* Toggle Affiliate */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">Toggle Affiliate Status</h3>
              <p className="text-sm text-muted-foreground">
                Enter a user&apos;s email to make them an affiliate or remove affiliate status.
              </p>
              <form onSubmit={handleToggleAffiliate} className="flex gap-2">
                <Input
                  placeholder="user@example.com"
                  value={toggleEmail}
                  onChange={(e) => setToggleEmail(e.target.value)}
                  type="email"
                  className="max-w-sm"
                />
                <Button type="submit" disabled={toggling || !toggleEmail.trim()}>
                  {toggling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Toggle Affiliate"
                  )}
                </Button>
              </form>
            </div>

            {/* Affiliate List */}
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search affiliates..."
                value={affiliateSearch}
                onChange={(e) => setAffiliateSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Affiliate</th>
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-center p-3 font-medium">Clicks</th>
                      <th className="text-center p-3 font-medium">Conversions</th>
                      <th className="text-center p-3 font-medium">Active Subs</th>
                      <th className="text-right p-3 font-medium">Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAffiliates.map((affiliate) => (
                      <tr key={affiliate.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{affiliate.fullName || affiliate.email}</div>
                          <div className="text-xs text-muted-foreground">{affiliate.email}</div>
                        </td>
                        <td className="p-3">
                          {affiliate.creatorCode ? (
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {affiliate.creatorCode.code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">No code yet</span>
                          )}
                        </td>
                        <td className="p-3 text-center">{affiliate.creatorCode?.totalReferrals || 0}</td>
                        <td className="p-3 text-center">{affiliate.creatorCode?.totalConversions || 0}</td>
                        <td className="p-3 text-center font-medium">{affiliate.activeSubscriberCount}</td>
                        <td className="p-3 text-right font-medium text-green-600">
                          ${(affiliate.activeSubscriberCount * PAYOUT_PER_SUBSCRIBER).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {filteredAffiliates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No affiliates yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payout Summary */}
            {filteredAffiliates.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="font-medium mb-2">Monthly Payout Summary</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  $5/month per active subscriber referred by each affiliate.
                </p>
                <div className="text-2xl font-bold text-green-600">
                  Total: ${filteredAffiliates.reduce((sum, a) => sum + a.activeSubscriberCount * PAYOUT_PER_SUBSCRIBER, 0).toFixed(2)}/month
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
