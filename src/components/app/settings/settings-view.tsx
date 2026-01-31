"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  copyToClipboard,
  generateToken,
  THEMES,
  type ThemeId,
} from "@/lib/utils";
import type { Company, InviteLink, PickupLocation } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Building,
  Users,
  Download,
  Copy,
  Trash2,
  Check,
  LogOut,
  CreditCard,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Palette,
  Gift,
  Link,
  TrendingUp,
  Edit3,
} from "lucide-react";
import { useReferralContext } from "@/providers/ReferralProvider";

interface SettingsViewProps {
  company: Company;
  isOwner: boolean;
  currentUserId: string;
  currentUserEmail: string;
  teamMembers: {
    id: string;
    email: string;
    fullName: string;
    joinedAt: string;
  }[];
  inviteLinks: InviteLink[];
  pickupLocations: PickupLocation[];
}

export function SettingsView({
  company: initialCompany,
  isOwner,
  currentUserId,
  currentUserEmail,
  teamMembers: initialMembers,
  inviteLinks: initialLinks,
  pickupLocations: initialLocations,
}: SettingsViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [company, setCompany] = useState(initialCompany);
  const [, setInviteLinks] = useState(initialLinks);
  const [, setLocations] = useState(initialLocations);
  const [origin, setOrigin] = useState<string>("");

  // Safely get origin after component mounts (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Company form
  const [companyName, setCompanyName] = useState(company.name);
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    (company.theme_id as ThemeId) || "agreeable-gray"
  );
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>((company as any).logo_url || null);

  // Location dialog
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PickupLocation | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationZip, setLocationZip] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  async function handleSaveCompany() {
    setSavingCompany(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: companyName.trim(),
          theme_id: selectedTheme,
        })
        .eq("id", company.id);

      if (error) throw error;

      setCompany((prev) => ({
        ...prev,
        name: companyName.trim(),
        theme_id: selectedTheme,
      }));

      addToast("Company settings saved!", "success");
      router.refresh();
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      addToast("File too large (max 5MB)", "error");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
      addToast("Invalid file type. Allowed: JPEG, PNG, WebP, SVG", "error");
      return;
    }

    setUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/companies/${company.id}/logo`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload logo");
      }

      setLogoPreview(data.logo_url);
      setCompany((prev) => ({
        ...prev,
        logo_url: data.logo_url,
      }));

      addToast("Logo uploaded successfully!", "success");
      router.refresh();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to upload logo", "error");
    } finally {
      setUploadingLogo(false);
      // Reset file input
      e.target.value = "";
    }
  }

  async function handleCopyInviteLink() {
    try {
      // First, try to find an existing active invite link
      const { data: existingLinks } = await supabase
        .from("invite_links")
        .select("token")
        .eq("company_id", company.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      let token: string;

      if (existingLinks && existingLinks.length > 0) {
        // Use existing active link
        token = existingLinks[0].token;
      } else {
        // Create a new invite link
        token = generateToken(24);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const { data, error } = await supabase
          .from("invite_links")
          .insert({
            company_id: company.id,
            token,
            expires_at: expiresAt.toISOString(),
            created_by_user_id: currentUserId,
          })
          .select()
          .single();

        if (error) throw error;

        setInviteLinks((prev) => [data, ...prev]);
      }

      const inviteUrl = `${origin || (typeof window !== "undefined" ? window.location.origin : "")}/join/${token}`;
      copyToClipboard(inviteUrl);
      addToast("Invite link copied! Share it with your crew.", "success");
    } catch {
      addToast("Failed to copy invite link", "error");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleCreateInviteLink() {
    try {
      const token = generateToken(24);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expire in 1 hour

      const { data, error } = await supabase
        .from("invite_links")
        .insert({
          company_id: company.id,
          token,
          expires_at: expiresAt.toISOString(),
          created_by_user_id: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;

      setInviteLinks((prev) => [data, ...prev]);
      
      const inviteUrl = `${origin || (typeof window !== "undefined" ? window.location.origin : "")}/join/${token}`;
      copyToClipboard(inviteUrl);
      addToast("Invite link created and copied!", "success");
    } catch {
      addToast("Failed to create invite link", "error");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleRevokeInvite(linkId: string) {
    const { error } = await supabase
      .from("invite_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId);

    if (error) {
      addToast("Failed to revoke link", "error");
      return;
    }

    setInviteLinks((prev) => prev.filter((l) => l.id !== linkId));
    addToast("Invite link revoked", "success");
  }

  async function handleRemoveUser(userId: string) {
    if (userId === currentUserId) {
      addToast("You cannot remove yourself", "error");
      return;
    }

    if (!confirm("Remove this user from the company?")) return;

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", company.id);

    if (error) {
      addToast("Failed to remove user", "error");
      return;
    }

    router.refresh();
    addToast("User removed", "success");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function openLocationDialog(location?: PickupLocation) {
    if (location) {
      setEditingLocation(location);
      setLocationName(location.name);
      setLocationAddress(location.address1 || "");
      setLocationCity(location.city || "");
      setLocationState(location.state || "");
      setLocationZip(location.zip || "");
    } else {
      setEditingLocation(null);
      setLocationName("");
      setLocationAddress("");
      setLocationCity("");
      setLocationState("");
      setLocationZip("");
    }
    setLocationDialogOpen(true);
  }

  async function handleSaveLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!locationName.trim()) return;

    setSavingLocation(true);
    try {
      const locationData = {
        company_id: company.id,
        name: locationName.trim(),
        address1: locationAddress || null,
        city: locationCity || null,
        state: locationState || null,
        zip: locationZip || null,
      };

      if (editingLocation) {
        const { data, error } = await supabase
          .from("pickup_locations")
          .update(locationData)
          .eq("id", editingLocation.id)
          .select()
          .single();

        if (error) throw error;

        setLocations((prev) =>
          prev.map((l) => (l.id === editingLocation.id ? data : l))
        );
      } else {
        const { data, error } = await supabase
          .from("pickup_locations")
          .insert(locationData)
          .select()
          .single();

        if (error) throw error;

        setLocations((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }

      setLocationDialogOpen(false);
      addToast("Location saved!", "success");
    } catch {
      addToast("Failed to save location", "error");
    } finally {
      setSavingLocation(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleDeleteLocation(locationId: string) {
    if (!confirm("Delete this location?")) return;

    const { error } = await supabase
      .from("pickup_locations")
      .delete()
      .eq("id", locationId);

    if (error) {
      addToast("Failed to delete location", "error");
      return;
    }

    setLocations((prev) => prev.filter((l) => l.id !== locationId));
    addToast("Location deleted", "success");
  }

  async function handleExportPayments() {
    try {
      // Get all paid jobs (these are payments made directly on jobs)
      const { data: paidJobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          id,
          title,
          customer_id,
          payment_amount,
          payment_paid_at,
          payment_method
        `)
        .eq("company_id", company.id)
        .eq("payment_state", "paid")
        .order("payment_paid_at", { ascending: false });

      if (jobsError) throw jobsError;

      // Get customer names
      const customerIds = [...new Set((paidJobs || []).map(j => j.customer_id).filter((id): id is string => id !== null))];

      const { data: customers } = customerIds.length > 0
        ? await supabase.from("customers").select("id, name").in("id", customerIds)
        : { data: [] };

      const customerMap = new Map((customers || []).map(c => [c.id, c.name]));

      const csvRows = (paidJobs || []).map((job) => {
        return [
          job.payment_paid_at || "",
          `"${customerMap.get(job.customer_id || "") || ""}"`,
          `"${(job.title || "").replace(/"/g, '""')}"`,
          job.payment_amount ? (job.payment_amount / 100).toFixed(2) : "0.00",
          job.payment_method || "Unknown",
        ].join(",");
      });

      const csv = [
        ["Date", "Customer", "Job", "Amount", "Payment Method"].join(","),
        ...csvRows,
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      addToast("Payments exported!", "success");
    } catch {
      addToast("Failed to export", "error");
    }
  }

  async function handleExportCustomers() {
    try {
      const { data: customers, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", company.id)
        .order("name");

      if (error) throw error;

      const csv = [
        ["Name", "Phone", "Email", "Address", "City", "State", "ZIP", "Notes", "Created At"].join(","),
        ...(customers || []).map((cust) =>
          [
            `"${cust.name}"`,
            cust.phone || "",
            cust.email || "",
            `"${cust.address1 || ""}"`,
            cust.city || "",
            cust.state || "",
            cust.zip || "",
            `"${(cust.notes || "").replace(/"/g, '""')}"`,
            cust.created_at,
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      addToast("Customers exported!", "success");
    } catch {
      addToast("Failed to export", "error");
    }
  }

  // Export Jobs state
  const [exportingJobs, setExportingJobs] = useState(false);

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const { referralCode, visitorId, hasReferral } = useReferralContext();

  // Affiliate state
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affiliateLoading, setAffiliateLoading] = useState(true);
  const [affiliateCode, setAffiliateCode] = useState<{
    id: string;
    code: string;
    discountPercent: number;
    commissionPercent: number;
    totalReferrals: number;
    totalConversions: number;
    activeSubscriberCount: number;
    pendingPayout: number;
    isActive: boolean;
  } | null>(null);
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  // Fetch affiliate status on mount
  useEffect(() => {
    async function fetchAffiliateStatus() {
      try {
        const response = await fetch("/api/affiliate/me");
        const data = await response.json();

        if (data.isAffiliate) {
          setIsAffiliate(true);
          setAffiliateCode(data.creatorCode);
          if (data.creatorCode) {
            setNewCode(data.creatorCode.code);
          }
        }
      } catch (error) {
        console.error("Failed to fetch affiliate status:", error);
      } finally {
        setAffiliateLoading(false);
      }
    }

    fetchAffiliateStatus();
  }, []);

  async function handleSaveAffiliateCode() {
    if (!newCode.trim()) return;

    setSavingCode(true);
    try {
      const method = affiliateCode ? "PUT" : "POST";
      const response = await fetch("/api/affiliate/me", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save code");
      }

      setAffiliateCode(data.creatorCode);
      setNewCode(data.creatorCode.code);
      setEditingCode(false);
      addToast("Affiliate code saved!", "success");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to save code",
        "error"
      );
    } finally {
      setSavingCode(false);
    }
  }

  function copyAffiliateLink() {
    if (!affiliateCode) return;
    const link = `${origin}/signup?ref=${affiliateCode.code}`;
    copyToClipboard(link);
    addToast("Affiliate link copied!", "success");
  }

  async function handleExportJobs() {
    setExportingJobs(true);

    try {
      // Fetch all jobs with customer info
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(name, phone, email, address1, city, state, zip)
        `)
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      // Create CSV with comprehensive job data
      const csv = [
        [
          "Created Date",
          "Job Title",
          "Job Status",
          "Customer Name",
          "Customer Phone",
          "Customer Email",
          "Job Address",
          "City",
          "State",
          "ZIP",
          "Scheduled Date",
          "Scheduled Time",
          "Payment State",
          "Payment Amount",
          "Payment Method",
          "Paid At",
          "Notes",
          "Assigned To",
          "Progress %",
        ].join(","),
        ...(jobs || []).map((job) => {
          const customer = job.customer as any;

          return [
            formatDate(job.created_at),
            `"${(job.title || "").replace(/"/g, '""')}"`,
            job.status || "",
            customer ? `"${(customer.name || "").replace(/"/g, '""')}"` : "",
            customer?.phone || "",
            customer?.email || "",
            `"${(job.address1 || "").replace(/"/g, '""')}"`,
            job.city || "",
            job.state || "",
            job.zip || "",
            job.scheduled_date || "",
            job.scheduled_time || "",
            job.payment_state || "",
            job.payment_amount ? (job.payment_amount / 100).toFixed(2) : "",
            job.payment_method || "",
            job.payment_paid_at || "",
            `"${(job.notes || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
            job.assigned_user_id || "",
            job.progress_percentage?.toString() || "0",
          ].join(",");
        }),
      ].join("\n");

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jobs-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      addToast("Jobs exported!", "success");
    } catch (error) {
      console.error("Export error:", error);
      addToast("Failed to export data", "error");
    } finally {
      setExportingJobs(false);
    }
  }

  async function handleSubscribe() {
    setBillingLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: referralCode || undefined,
          visitorId: visitorId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to start checkout",
        "error"
      );
      setBillingLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to open billing portal",
        "error"
      );
      setBillingLoading(false);
    }
  }

  // Helper to get subscription status display
  function getSubscriptionDisplay() {
    const status = (company as any).subscription_status;
    const trialEnds = (company as any).trial_ends_at;

    if (status === "active") {
      return { label: "Active", color: "text-green-600" };
    } else if (status === "past_due") {
      return { label: "Past Due", color: "text-red-600" };
    } else if (status === "canceled") {
      return { label: "Canceled", color: "text-gray-600" };
    } else if (status === "trialing" || !status) {
      const trialEndDate = trialEnds ? new Date(trialEnds) : null;
      const daysLeft = trialEndDate
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 14;
      return { label: `Free Trial (${daysLeft} days left)`, color: "text-primary" };
    }
    return { label: "Free Trial", color: "text-primary" };
  }

  const subscriptionDisplay = getSubscriptionDisplay();
  const isSubscribed = (company as any).subscription_status === "active";

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide flex-nowrap gap-1 -mx-4 px-4 lg:flex-wrap lg:overflow-x-visible">
            <TabsTrigger value="company">
              <Building className="mr-1.5 h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="crew">
              <Users className="mr-1.5 h-4 w-4" />
              Crew
            </TabsTrigger>
            <TabsTrigger value="exports">
              <Download className="mr-1.5 h-4 w-4" />
              Exports
            </TabsTrigger>
            <TabsTrigger value="account">
              <Users className="mr-1.5 h-4 w-4" />
              Account
            </TabsTrigger>
            {isAffiliate && (
              <TabsTrigger value="affiliate">
                <Gift className="mr-1.5 h-4 w-4" />
                Affiliate
              </TabsTrigger>
            )}
          </TabsList>

          {/* Company Tab */}
          <TabsContent value="company" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold">Company Details</h3>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Company Logo
              </h3>
              <p className="text-sm text-muted-foreground">
                Upload your company logo to display on customer-facing pages (estimates, invoices, payment links).
              </p>
              
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img 
                      src={logoPreview} 
                      alt="Company Logo" 
                      className="w-20 h-20 rounded-lg object-cover border"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted border flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1">
                  <Label htmlFor="logoUpload" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      <span>{logoPreview ? "Change Logo" : "Upload Logo"}</span>
                    </div>
                  </Label>
                  <input
                    id="logoUpload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 5MB. Formats: JPEG, PNG, WebP, SVG
                  </p>
                </div>
              </div>
              
              {uploadingLogo && (
                <p className="text-sm text-muted-foreground">Uploading...</p>
              )}
            </div>

            {/* Color Theme */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Color Theme
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose a color theme for customer-facing pages.
              </p>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`relative w-full aspect-square rounded-lg border-2 transition-all ${
                      selectedTheme === theme.id
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-muted hover:border-muted-foreground"
                    }`}
                    style={{ backgroundColor: theme.color }}
                    title={theme.name}
                  >
                    {selectedTheme === theme.id && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Selected: {THEMES.find(t => t.id === selectedTheme)?.name || "Agreeable Gray"}
              </p>
            </div>

            <Button onClick={handleSaveCompany} loading={savingCompany}>
              Save Company Settings
            </Button>
          </TabsContent>

          {/* Crew Tab */}
          <TabsContent value="crew" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Crew Members</h3>
                {isOwner && (
                  <Button onClick={handleCopyInviteLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Link to Invite
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your crew members have access to jobs, estimates, and customer info. Everyone sees the same data.
              </p>

              <div className="divide-y">
                {initialMembers.map((member) => (
                  <div
                    key={member.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {member.fullName || member.email}
                        {member.id === company.owner_user_id && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (Owner)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    {isOwner && member.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Exports Tab */}
          <TabsContent value="exports" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg">Export Your Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Download CSV files for accounting, backup, or analysis.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  onClick={handleExportJobs}
                  disabled={exportingJobs}
                  className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors group"
                >
                  <Download className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-3" />
                  <span className="font-medium">Jobs</span>
                  <span className="text-xs text-muted-foreground mt-1">All job data</span>
                </button>

                <button
                  onClick={handleExportPayments}
                  className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors group"
                >
                  <Download className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-3" />
                  <span className="font-medium">Payments</span>
                  <span className="text-xs text-muted-foreground mt-1">Payment history</span>
                </button>

                <button
                  onClick={handleExportCustomers}
                  className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors group"
                >
                  <Download className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-3" />
                  <span className="font-medium">Customers</span>
                  <span className="text-xs text-muted-foreground mt-1">Contact info</span>
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold">Account</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="font-medium">{currentUserEmail}</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.push("/login");
                    router.refresh();
                  }}
                  className="w-full sm:w-auto"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>

            {/* Billing Section - Owner Only */}
            {isOwner && (
              <div className="rounded-lg border bg-card p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Billing & Subscription</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your subscription and billing information
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Current Plan</h4>
                      <span className={`text-sm font-semibold ${subscriptionDisplay.color}`}>
                        {subscriptionDisplay.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isSubscribed
                        ? "You have full access to all features."
                        : "Upgrade to unlock all features and support development."}
                    </p>
                  </div>

                  {/* Referral discount banner */}
                  {hasReferral && !isSubscribed && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <p className="text-sm text-green-800 font-medium">
                        Referral discount applied: $5 off your first month!
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    {isSubscribed ? (
                      <Button
                        variant="outline"
                        onClick={handleManageBilling}
                        disabled={billingLoading}
                        className="w-full sm:w-auto"
                      >
                        {billingLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="mr-2 h-4 w-4" />
                        )}
                        Manage Billing
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubscribe}
                        disabled={billingLoading}
                        className="w-full sm:w-auto"
                      >
                        {billingLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="mr-2 h-4 w-4" />
                        )}
                        Upgrade Now
                        {hasReferral && (
                          <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">
                            $5 off
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Affiliate Tab */}
          {isAffiliate && (
            <TabsContent value="affiliate" className="mt-6 space-y-6">
              {affiliateLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Your Affiliate Link */}
                  <div className="rounded-lg border bg-card p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Link className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">Your Affiliate Link</h3>
                    </div>

                    {affiliateCode ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-lg bg-muted p-3 font-mono text-sm truncate">
                            {origin}/signup?ref={affiliateCode.code}
                          </div>
                          <Button onClick={copyAffiliateLink} variant="outline">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Edit Code */}
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <Label>Your Code</Label>
                            {!editingCode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCode(true)}
                              >
                                <Edit3 className="h-4 w-4 mr-1" />
                                Change
                              </Button>
                            )}
                          </div>

                          {editingCode ? (
                            <div className="flex gap-2">
                              <Input
                                value={newCode}
                                onChange={(e) =>
                                  setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                                }
                                placeholder="YOURCODE"
                                maxLength={20}
                                className="font-mono uppercase"
                              />
                              <Button
                                onClick={handleSaveAffiliateCode}
                                disabled={savingCode || !newCode.trim()}
                              >
                                {savingCode ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingCode(false);
                                  setNewCode(affiliateCode.code);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <p className="font-mono text-lg font-bold text-primary">
                              {affiliateCode.code}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            3-20 alphanumeric characters. This appears in your referral link.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-muted-foreground">
                          Create your unique affiliate code to start sharing.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            value={newCode}
                            onChange={(e) =>
                              setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                            }
                            placeholder="YOURCODE"
                            maxLength={20}
                            className="font-mono uppercase"
                          />
                          <Button
                            onClick={handleSaveAffiliateCode}
                            disabled={savingCode || !newCode.trim() || newCode.length < 3}
                          >
                            {savingCode ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Create Code"
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          3-20 alphanumeric characters (e.g., MYCODE, PAINT2024)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  {affiliateCode && (
                    <div className="rounded-lg border bg-card p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Your Stats</h3>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="rounded-lg bg-muted/50 p-4 text-center">
                          <p className="text-3xl font-bold text-primary">
                            {affiliateCode.totalReferrals}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Link Clicks
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4 text-center">
                          <p className="text-3xl font-bold text-blue-600">
                            {affiliateCode.totalConversions}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Signups
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4 text-center">
                          <p className="text-3xl font-bold text-green-600">
                            {affiliateCode.activeSubscriberCount}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Active Subs
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4 text-center">
                          <p className="text-3xl font-bold text-green-600">
                            ${(affiliateCode.activeSubscriberCount * 5).toFixed(0)}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your Payout/mo
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount for referrals</span>
                          <span className="font-medium">$5 off first month</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Your payout</span>
                          <span className="font-medium">$5/month per active subscriber</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* How it works */}
                  <div className="rounded-lg border bg-muted/30 p-6">
                    <h4 className="font-medium mb-3">How it works</h4>
                    <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                      <li>Share your unique link with potential customers</li>
                      <li>They get $5 off their first month</li>
                      <li>You earn $5/month for each active subscriber you referred</li>
                      <li>Referrals are tracked for 30 days after clicking your link</li>
                    </ol>
                  </div>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Location" : "Add Pickup Location"}
            </DialogTitle>
            <DialogDescription>
              Add a paint store or other pickup point.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLocation} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="locationName">Name *</Label>
              <Input
                id="locationName"
                placeholder="e.g., Paint Store Downtown"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationAddress">Street Address</Label>
              <Input
                id="locationAddress"
                placeholder="123 Main St"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="locationCity">City</Label>
                <Input
                  id="locationCity"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationState">State</Label>
                <Input
                  id="locationState"
                  maxLength={2}
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationZip">ZIP</Label>
                <Input
                  id="locationZip"
                  value={locationZip}
                  onChange={(e) => setLocationZip(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocationDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={savingLocation}>
                {editingLocation ? "Save Changes" : "Add Location"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

