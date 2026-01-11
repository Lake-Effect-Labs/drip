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
import type { Company, EstimatingConfig, InviteLink, PickupLocation } from "@/types/database";
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
  Palette,
  Calculator,
  Users,
  MapPin,
  Download,
  Copy,
  Trash2,
  Plus,
  Check,
  LogOut,
  CreditCard,
} from "lucide-react";

interface SettingsViewProps {
  company: Company;
  isOwner: boolean;
  currentUserId: string;
  currentUserEmail: string;
  config: EstimatingConfig | null;
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
  config: initialConfig,
  teamMembers: initialMembers,
  inviteLinks: initialLinks,
  pickupLocations: initialLocations,
}: SettingsViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [company, setCompany] = useState(initialCompany);
  const [config, setConfig] = useState(initialConfig);
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
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    company.theme_id as ThemeId
  );
  const [savingCompany, setSavingCompany] = useState(false);

  // Config form - use empty strings, show placeholders with suggestions
  const [wallsRate, setWallsRate] = useState(
    config?.walls_rate_per_sqft?.toString() || ""
  );
  const [ceilingsRate, setCeilingsRate] = useState(
    config?.ceilings_rate_per_sqft?.toString() || ""
  );
  const [trimRate, setTrimRate] = useState(
    config?.trim_rate_per_sqft?.toString() || ""
  );
  const [laborRate, setLaborRate] = useState(
    config?.labor_rate_per_hour?.toString() || ""
  );
  const [savingConfig, setSavingConfig] = useState(false);

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

      // Apply theme immediately
      document.documentElement.setAttribute("data-theme", selectedTheme);

      addToast("Company settings saved!", "success");
      router.refresh();
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      // Only save values that are provided (non-empty)
      const configData: any = {
        company_id: company.id,
        updated_at: new Date().toISOString(),
      };

      if (wallsRate.trim()) {
        configData.walls_rate_per_sqft = parseFloat(wallsRate);
      }
      if (ceilingsRate.trim()) {
        configData.ceilings_rate_per_sqft = parseFloat(ceilingsRate);
      }
      if (trimRate.trim()) {
        configData.trim_rate_per_sqft = parseFloat(trimRate);
      }
      if (laborRate.trim()) {
        configData.labor_rate_per_hour = parseFloat(laborRate);
      }

      const { error } = await supabase
        .from("estimating_config")
        .upsert(configData, { onConflict: "company_id" });

      if (error) throw error;

      // Fetch updated config to get all values
      const { data: updatedConfig } = await supabase
        .from("estimating_config")
        .select("*")
        .eq("company_id", company.id)
        .single();

      if (updatedConfig) {
        setConfig(updatedConfig);
        setWallsRate(updatedConfig.walls_rate_per_sqft?.toString() || "");
        setCeilingsRate(updatedConfig.ceilings_rate_per_sqft?.toString() || "");
        setTrimRate(updatedConfig.trim_rate_per_sqft?.toString() || "");
        setLaborRate(updatedConfig.labor_rate_per_hour?.toString() || "");
      }

      addToast("Estimating rates saved!", "success");
    } catch {
      addToast("Failed to save rates", "error");
    } finally {
      setSavingConfig(false);
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
      const customerIds = [...new Set((invoices || []).map(i => i.customer_id).filter(Boolean))];
      const jobIds = [...new Set((invoices || []).map(i => i.job_id).filter(Boolean))];

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

      const customerIds = [...new Set((invoices || []).map(i => i.customer_id).filter(Boolean))];
      const jobIds = [...new Set((invoices || []).map(i => i.job_id).filter(Boolean))];

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
            <TabsTrigger value="estimating">
              <Calculator className="mr-1.5 h-4 w-4" />
              Estimating
            </TabsTrigger>
            <TabsTrigger value="crew">
              <Users className="mr-1.5 h-4 w-4" />
              Crew
            </TabsTrigger>
            <TabsTrigger value="locations">
              <MapPin className="mr-1.5 h-4 w-4" />
              Locations
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
                <Palette className="h-4 w-4" />
                Theme
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose a Sherwin-Williams inspired color theme.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`relative rounded-lg border p-3 text-left transition-all ${
                      selectedTheme === theme.id
                        ? "border-primary ring-2 ring-primary"
                        : "hover:border-muted-foreground"
                    }`}
                  >
                    <div
                      className="h-8 w-full rounded mb-2"
                      style={{ backgroundColor: theme.color }}
                    />
                    <p className="text-xs font-medium truncate">{theme.name}</p>
                    {selectedTheme === theme.id && (
                      <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSaveCompany} loading={savingCompany}>
              Save Company Settings
            </Button>
          </TabsContent>

          {/* Estimating Tab */}
          <TabsContent value="estimating" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold">Square Footage Rates</h3>
              <p className="text-sm text-muted-foreground">
                Set your default $/sqft rates for auto-pricing estimates.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="wallsRate">Interior Walls ($/sqft)</Label>
                  <Input
                    id="wallsRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={wallsRate}
                    onChange={(e) => setWallsRate(e.target.value)}
                    placeholder="Suggested: 2.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ceilingsRate">Ceilings ($/sqft)</Label>
                  <Input
                    id="ceilingsRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={ceilingsRate}
                    onChange={(e) => setCeilingsRate(e.target.value)}
                    placeholder="Suggested: 0.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trimRate">Trim & Doors ($/sqft)</Label>
                  <Input
                    id="trimRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={trimRate}
                    onChange={(e) => setTrimRate(e.target.value)}
                    placeholder="Suggested: 0.75"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="font-semibold">Labor Rate</h3>
              <p className="text-sm text-muted-foreground">
                Set your default hourly rate for labor estimates.
              </p>
              <div className="max-w-xs">
                <div className="space-y-2">
                  <Label htmlFor="laborRate">Labor Rate ($/hr)</Label>
                  <Input
                    id="laborRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={laborRate}
                    onChange={(e) => setLaborRate(e.target.value)}
                    placeholder="Suggested: 50.00"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveConfig} loading={savingConfig}>
              Save Settings
            </Button>
          </TabsContent>

          {/* Crew Tab */}
          <TabsContent value="crew" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Crew Members</h3>
                <Button size="sm" onClick={handleCreateInviteLink}>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Crew Member
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Invite your crew to access jobs, estimates, and customer info. Everyone sees the same data.
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

            {inviteLinks.length > 0 && (
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <h3 className="font-semibold">Active Invite Links</h3>
                <div className="divide-y">
                  {inviteLinks.map((link) => (
                    <div
                      key={link.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-xs bg-muted px-2 py-1 rounded truncate block">
                          {origin ? `${origin}/join/${link.token}` : `/join/${link.token}`}
                        </code>
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires {formatDate(link.expires_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = `${origin || (typeof window !== "undefined" ? window.location.origin : "")}/join/${link.token}`;
                            copyToClipboard(url);
                            addToast("Link copied!", "success");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvite(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Pickup Locations</h3>
                  <p className="text-sm text-muted-foreground">
                    Sherwin-Williams stores or other pickup points.
                  </p>
                </div>
                <Button size="sm" onClick={() => openLocationDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </Button>
              </div>

              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No pickup locations added yet.
                </p>
              ) : (
                <div className="divide-y">
                  {locations.map((location) => (
                    <div
                      key={location.id}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{location.name}</p>
                        {location.address1 && (
                          <p className="text-sm text-muted-foreground">
                            {[
                              location.address1,
                              location.city,
                              location.state,
                              location.zip,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openLocationDialog(location)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLocation(location.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                      <span className="text-sm font-semibold text-primary">Free Trial</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You&apos;re currently on the free trial. Upgrade to unlock all features.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Payment Method</h4>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        No payment method on file
                      </p>
                      <Button variant="outline" disabled>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add Payment Method
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Billing History</h4>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No billing history available
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button variant="outline" disabled className="w-full sm:w-auto">
                      Upgrade Plan
                    </Button>
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
              Add a Sherwin-Williams store or other pickup point.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLocation} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="locationName">Name *</Label>
              <Input
                id="locationName"
                placeholder="e.g., Sherwin-Williams #1234"
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

