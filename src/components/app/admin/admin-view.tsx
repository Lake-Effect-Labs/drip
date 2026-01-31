"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Search,
  Loader2,
  Gift,
  ChevronDown,
  ChevronRight,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferredSubscriber {
  companyName: string;
  ownerEmail: string;
  subscriptionStatus: string;
  monthsPaying: number;
  convertedAt: string;
}

interface CompanyData {
  id: string;
  name: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  subscriptionStatus: string;
  jobCount: number;
  crewCount: number;
  createdAt: string;
  monthsPaying: number;
  isAffiliate: boolean;
  affiliate: {
    code: string;
    totalReferrals: number;
    totalConversions: number;
    activeSubscriberCount: number;
    referredSubscribers: ReferredSubscriber[];
  } | null;
}

interface AdminViewProps {
  companies: CompanyData[];
}

const PAYOUT_PER_SUBSCRIBER = 5;

export function AdminView({ companies }: AdminViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingCodeFor, setEditingCodeFor] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerName.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = companies.filter((c) => c.subscriptionStatus === "active").length;
  const trialCount = companies.filter((c) => c.subscriptionStatus !== "active" && c.subscriptionStatus !== "canceled").length;
  const totalJobs = companies.reduce((sum, c) => sum + c.jobCount, 0);
  const _affiliateCount = companies.filter((c) => c.isAffiliate).length;
  const totalPayout = companies
    .filter((c) => c.affiliate)
    .reduce((sum, c) => sum + (c.affiliate?.activeSubscriberCount || 0) * PAYOUT_PER_SUBSCRIBER, 0);

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

  async function handlePromoteAffiliate(ownerEmail: string, companyId: string) {
    setTogglingId(companyId);
    try {
      const response = await fetch("/api/admin/toggle-affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ownerEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle affiliate");
      }

      addToast(
        data.isAffiliate
          ? `${ownerEmail} is now an affiliate`
          : `${ownerEmail} is no longer an affiliate`,
        "success"
      );
      router.refresh();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to toggle affiliate",
        "error"
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSaveCode(userId: string) {
    if (!editCodeValue.trim()) return;
    setSavingCode(true);
    try {
      const response = await fetch("/api/admin/update-affiliate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newCode: editCodeValue.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update code");
      }
      addToast(`Code updated to ${data.code}`, "success");
      setEditingCodeFor(null);
      router.refresh();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to update code",
        "error"
      );
    } finally {
      setSavingCode(false);
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="border-b bg-card p-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-primary">{companies.length}</p>
            <p className="text-sm text-muted-foreground">Companies</p>
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
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-green-600">${totalPayout}</p>
            <p className="text-sm text-muted-foreground">Payouts/mo</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Unified Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium w-8"></th>
                  <th className="text-left p-3 font-medium">Company</th>
                  <th className="text-left p-3 font-medium">Owner</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-center p-3 font-medium">Jobs</th>
                  <th className="text-center p-3 font-medium">Crew</th>
                  <th className="text-left p-3 font-medium">Signed Up</th>
                  <th className="text-right p-3 font-medium">Affiliate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((company) => {
                  const isExpanded = expandedId === company.id;
                  const hasAffiliateData = company.isAffiliate && company.affiliate;

                  return (
                    <Fragment key={company.id}>
                      <tr
                        className={cn(
                          "hover:bg-muted/30",
                          hasAffiliateData && "cursor-pointer",
                          isExpanded && "bg-muted/20"
                        )}
                        onClick={() => {
                          if (hasAffiliateData) {
                            setExpandedId(isExpanded ? null : company.id);
                          }
                        }}
                      >
                        <td className="p-3 text-muted-foreground">
                          {hasAffiliateData && (
                            isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
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
                        <td className="p-3 text-right">
                          {company.isAffiliate ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                              <Gift className="h-3 w-3" />
                              {company.affiliate?.code || "Affiliate"}
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              disabled={togglingId === company.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePromoteAffiliate(company.ownerEmail, company.id);
                              }}
                            >
                              {togglingId === company.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Promote"
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded affiliate detail */}
                      {isExpanded && hasAffiliateData && company.affiliate && (
                        <tr>
                          <td colSpan={8} className="bg-muted/10 p-0">
                            <div className="p-4 pl-12 space-y-4">
                              {/* Affiliate stats row */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-lg border bg-card p-3 text-center">
                                  <p className="text-2xl font-bold">{company.affiliate.totalReferrals}</p>
                                  <p className="text-xs text-muted-foreground">Link Clicks</p>
                                </div>
                                <div className="rounded-lg border bg-card p-3 text-center">
                                  <p className="text-2xl font-bold">{company.affiliate.totalConversions}</p>
                                  <p className="text-xs text-muted-foreground">Conversions</p>
                                </div>
                                <div className="rounded-lg border bg-card p-3 text-center">
                                  <p className="text-2xl font-bold">{company.affiliate.activeSubscriberCount}</p>
                                  <p className="text-xs text-muted-foreground">Active Subs</p>
                                </div>
                                <div className="rounded-lg border bg-card p-3 text-center">
                                  <p className="text-2xl font-bold text-green-600">
                                    ${(company.affiliate.activeSubscriberCount * PAYOUT_PER_SUBSCRIBER).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Payout/mo</p>
                                </div>
                              </div>

                              {/* Affiliate code edit */}
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">Code:</span>
                                {editingCodeFor === company.ownerUserId ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editCodeValue}
                                      onChange={(e) =>
                                        setEditCodeValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                                      }
                                      placeholder="NEWCODE"
                                      maxLength={20}
                                      className="font-mono uppercase w-40 h-8 text-sm"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs"
                                      disabled={savingCode || editCodeValue.length < 3}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveCode(company.ownerUserId);
                                      }}
                                    >
                                      {savingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCodeFor(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-primary">{company.affiliate.code}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditCodeValue(company.affiliate!.code);
                                        setEditingCodeFor(company.ownerUserId);
                                      }}
                                    >
                                      <Edit3 className="h-3 w-3 mr-1" />
                                      Change
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Referred subscribers list */}
                              {company.affiliate.referredSubscribers.length > 0 ? (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Referred Customers</h4>
                                  <div className="rounded-lg border overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="text-left p-2 font-medium">Customer</th>
                                          <th className="text-left p-2 font-medium">Email</th>
                                          <th className="text-center p-2 font-medium">Status</th>
                                          <th className="text-center p-2 font-medium">Months Paying</th>
                                          <th className="text-left p-2 font-medium">Converted</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {company.affiliate.referredSubscribers.map((sub, i) => (
                                          <tr key={i} className="hover:bg-muted/30">
                                            <td className="p-2">{sub.companyName}</td>
                                            <td className="p-2 text-muted-foreground">{sub.ownerEmail}</td>
                                            <td className="p-2 text-center">{getStatusBadge(sub.subscriptionStatus)}</td>
                                            <td className="p-2 text-center font-medium">
                                              {sub.monthsPaying > 0 ? `${sub.monthsPaying} mo` : "-"}
                                            </td>
                                            <td className="p-2 text-muted-foreground">
                                              {new Date(sub.convertedAt).toLocaleDateString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No referred customers yet.</p>
                              )}

                              {/* Remove affiliate button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-destructive"
                                disabled={togglingId === company.id}
                                onClick={() => handlePromoteAffiliate(company.ownerEmail, company.id)}
                              >
                                {togglingId === company.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : null}
                                Remove Affiliate Status
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No companies found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
