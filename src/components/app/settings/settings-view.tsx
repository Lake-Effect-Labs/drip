"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  copyToClipboard,
  generateToken,
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
  const [inviteLinks, setInviteLinks] = useState(initialLinks);
  const [locations, setLocations] = useState(initialLocations);
  const [origin, setOrigin] = useState<string>("");

  // Safely get origin after component mounts (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Company form
  const [companyName, setCompanyName] = useState(company.name);
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
        })
        .eq("id", company.id);

      if (error) throw error;

      setCompany((prev) => ({
        ...prev,
        name: companyName.trim(),
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

  async function handleExportInvoices() {
    try {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch customers and jobs for the invoices
      const customerIds = [...new Set((invoices || []).map(i => i.customer_id).filter((id): id is string => id !== null))];
      const jobIds = [...new Set((invoices || []).map(i => i.job_id).filter((id): id is string => id !== null))];

      const { data: customers } = customerIds.length > 0 
        ? await supabase.from("customers").select("id, name").in("id", customerIds)
        : { data: [] };
      
      const { data: jobs } = jobIds.length > 0
        ? await supabase.from("jobs").select("id, title").in("id", jobIds)
        : { data: [] };

      const customerMap = new Map((customers || []).map(c => [c.id, c.name]));
      const jobMap = new Map((jobs || []).map(j => [j.id, j.title]));

      const csv = [
        ["Date", "Customer", "Job", "Amount", "Status", "Paid At"].join(","),
        ...(invoices || []).map((inv) =>
          [
            inv.created_at,
            `"${customerMap.get(inv.customer_id) || ""}"`,
            `"${jobMap.get(inv.job_id) || ""}"`,
            (inv.amount_total / 100).toFixed(2),
            inv.status,
            inv.paid_at || "",
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      addToast("Invoices exported!", "success");
    } catch {
      addToast("Failed to export", "error");
    }
  }

  async function handleExportPayments() {
    try {
      // Get invoices for company first
      const { data: companyInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("company_id", company.id);

      const invoiceIds = companyInvoices?.map(i => i.id) || [];
      
      // Get payments for those invoices
      const { data: payments, error } = invoiceIds.length > 0
        ? await supabase
            .from("invoice_payments")
            .select("*")
            .in("invoice_id", invoiceIds)
            .order("paid_at", { ascending: false })
        : { data: [] };

      if (error) throw error;

      // Get invoice details
      const { data: invoices } = invoiceIds.length > 0
        ? await supabase.from("invoices").select("id, customer_id, job_id").in("id", invoiceIds)
        : { data: [] };

      const customerIds = [...new Set((invoices || []).map(i => i.customer_id).filter((id): id is string => id !== null))];
      const jobIds = [...new Set((invoices || []).map(i => i.job_id).filter((id): id is string => id !== null))];

      const { data: customers } = customerIds.length > 0
        ? await supabase.from("customers").select("id, name").in("id", customerIds)
        : { data: [] };
      
      const { data: jobs } = jobIds.length > 0
        ? await supabase.from("jobs").select("id, title").in("id", jobIds)
        : { data: [] };

      const invoiceMap = new Map((invoices || []).map(i => [i.id, i]));
      const customerMap = new Map((customers || []).map(c => [c.id, c.name]));
      const jobMap = new Map((jobs || []).map(j => [j.id, j.title]));

      const csv = [
        ["Date", "Customer", "Job", "Amount", "Payment Method"].join(","),
        ...(payments || []).map((payment) => {
          const invoice = invoiceMap.get(payment.invoice_id);
          const isManual = payment.stripe_payment_intent_id?.startsWith("manual_");
          const method = isManual
            ? payment.stripe_payment_intent_id.split("_")[1]
            : "Stripe";
          const customerId = invoice?.customer_id || "";
          const jobId = invoice?.job_id || "";
          return [
            payment.paid_at,
            `"${customerMap.get(customerId) || ""}"`,
            `"${jobMap.get(jobId) || ""}"`,
            (payment.amount / 100).toFixed(2),
            method,
          ].join(",");
        }),
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
  const [exportJobsDialogOpen, setExportJobsDialogOpen] = useState(false);
  const [exportingJobs, setExportingJobs] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const { referralCode, visitorId, discountPercent, hasReferral } = useReferralContext();

  async function handleExportJobs() {
    if (!startDate || !endDate) {
      addToast("Please select both start and end dates", "error");
      return;
    }

    setExportingJobs(true);

    try {
      // Fetch jobs with customer info
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(name, phone, email, address1, city, state, zip)
        `)
        .eq("company_id", company.id)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch invoices for these jobs
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", company.id)
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
      setExportJobsDialogOpen(false);
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
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold">Export Data</h3>
              <p className="text-sm text-muted-foreground">
                Download your data for accounting or backup purposes.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setExportJobsDialogOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Jobs (CSV)
                </Button>
                <Button variant="outline" onClick={handleExportInvoices}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Invoices (CSV)
                </Button>
                <Button variant="outline" onClick={handleExportPayments}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Payments (CSV)
                </Button>
                <Button variant="outline" onClick={handleExportCustomers}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Customers (CSV)
                </Button>
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
                  {hasReferral && !isSubscribed && discountPercent && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <p className="text-sm text-green-800 font-medium">
                        🎉 Referral discount applied: {discountPercent}% off your first month!
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
                        {hasReferral && discountPercent && (
                          <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">
                            {discountPercent}% off
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Export Jobs Dialog */}
      <Dialog open={exportJobsDialogOpen} onOpenChange={setExportJobsDialogOpen}>
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
                onClick={() => setExportJobsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleExportJobs} loading={exportingJobs}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

