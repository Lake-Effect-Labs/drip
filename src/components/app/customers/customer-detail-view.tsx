"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  formatPhone,
  formatDate,
  formatCurrency,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobStatus,
} from "@/lib/utils";
import type { Customer, Job, Invoice } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  Briefcase,
  Receipt,
  FileText,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  CheckCircle,
  Calendar,
  Plus,
} from "lucide-react";

interface CustomerDetailViewProps {
  customer: Customer;
  jobs: Job[];
  invoices: Invoice[];
  companyId: string;
}

const ALLOWED_TAGS = ['good_payer', 'repeat_customer', 'referral', 'vip', 'needs_followup'] as const;
const MAX_TAGS_PER_CUSTOMER = 5;

const TAG_CONFIG: Record<typeof ALLOWED_TAGS[number], { label: string; variant: "success" | "default" | "secondary" | "outline"; icon: string }> = {
  good_payer: { label: 'Good Payer', variant: 'success', icon: '✓' },
  repeat_customer: { label: 'Repeat Customer', variant: 'default', icon: '↻' },
  referral: { label: 'Referral', variant: 'secondary', icon: '👥' },
  vip: { label: 'VIP', variant: 'outline', icon: '⭐' },
  needs_followup: { label: 'Needs Follow-up', variant: 'secondary', icon: '!' },
};

export function CustomerDetailView({
  customer: initialCustomer,
  jobs,
  invoices,
  companyId,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [customer, setCustomer] = useState(initialCustomer);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // Form state
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [email, setEmail] = useState(customer.email || "");
  const [address1, setAddress1] = useState(customer.address1 || "");
  const [city, setCity] = useState(customer.city || "");
  const [state, setState] = useState(customer.state || "");
  const [zip, setZip] = useState(customer.zip || "");
  const [notes, setNotes] = useState(customer.notes || "");

  // Load tags
  useEffect(() => {
    async function loadTags() {
      const { data } = await supabase
        .from("customer_tags")
        .select("tag")
        .eq("customer_id", customer.id)
        .eq("company_id", companyId);
      
      if (data) {
        setTags(data.map(t => t.tag));
      }
      setLoadingTags(false);
    }
    loadTags();
  }, [customer.id, companyId, supabase]);

  async function handleAddTag(tag: string) {
    if (tags.length >= MAX_TAGS_PER_CUSTOMER) {
      addToast("Maximum tags reached", "error");
      return;
    }

    try {
      const { error } = await supabase
        .from("customer_tags")
        .insert({
          customer_id: customer.id,
          company_id: companyId,
          tag,
        });

      if (error && error.code !== "23505") { // Ignore duplicate errors
        throw error;
      }

      setTags([...tags, tag]);
      addToast("Tag added", "success");
    } catch (error) {
      console.error("Error adding tag:", error);
      addToast("Failed to add tag", "error");
    }
  }

  async function handleRemoveTag(tag: string) {
    try {
      const { error } = await supabase
        .from("customer_tags")
        .delete()
        .eq("customer_id", customer.id)
        .eq("company_id", companyId)
        .eq("tag", tag);

      if (error) throw error;

      setTags(tags.filter(t => t !== tag));
      addToast("Tag removed", "success");
    } catch (error) {
      console.error("Error removing tag:", error);
      addToast("Failed to remove tag", "error");
    }
  }

  const address = [customer.address1, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");

  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount_total, 0);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount_total, 0);
  const pendingAmount = invoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + inv.amount_total, 0);

  // Calculate payment history
  const paidInvoices = invoices
    .filter((inv) => inv.status === "paid" && inv.paid_at)
    .map((inv) => {
      const createdDate = new Date(inv.created_at);
      const paidDate = new Date(inv.paid_at!);
      const daysToPay = Math.round(
        (paidDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...inv,
        daysToPay: Math.max(0, daysToPay), // Ensure non-negative
      };
    })
    .filter((inv) => inv.daysToPay >= 0) // Filter out any invalid dates
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());

  const averageDaysToPay =
    paidInvoices.length > 0
      ? Math.round(
          paidInvoices.reduce((sum, inv) => sum + inv.daysToPay, 0) / paidInvoices.length
        )
      : null;

  function getPaymentBadgeText() {
    if (!averageDaysToPay && averageDaysToPay !== 0) return null;
    if (paidInvoices.length === 1) {
      return `Paid last invoice in ${paidInvoices[0].daysToPay} days`;
    }
    if (averageDaysToPay < 7) return "Usually pays within a week ✅";
    if (averageDaysToPay < 14) return "Usually pays within 2 weeks";
    if (averageDaysToPay < 30) return `Average ${averageDaysToPay} days`;
    return `Slow payer: ${averageDaysToPay} days ⚠️`;
  }

  function getPaymentBadgeVariant(): "success" | "secondary" | "warning" | "outline" {
    if (!averageDaysToPay && averageDaysToPay !== 0) return "outline";
    if (averageDaysToPay < 7) return "success";
    if (averageDaysToPay < 14) return "secondary";
    if (averageDaysToPay < 30) return "secondary";
    return "warning";
  }

  // Create a combined timeline of jobs and invoices
  const timeline = [
    ...jobs.map((job) => ({
      type: "job" as const,
      date: job.created_at,
      title: job.title,
      status: job.status,
      id: job.id,
    })),
    ...invoices.map((inv) => ({
      type: "invoice" as const,
      date: inv.created_at,
      title: `Invoice - ${formatCurrency(inv.amount_total)}`,
      status: inv.status,
      id: inv.id,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  async function handleSave() {
    if (!name.trim()) {
      addToast("Name is required", "error");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("customers")
        .update({
          name: name.trim(),
          phone: phone || null,
          email: email || null,
          address1: address1 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          notes: notes || null,
        })
        .eq("id", customer.id);

      if (error) throw error;

      setCustomer((prev) => ({
        ...prev,
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        address1: address1 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        notes: notes || null,
      }));
      setEditing(false);
      addToast("Customer updated!", "success");
    } catch {
      addToast("Failed to update customer", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this customer? This cannot be undone.")) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) {
      addToast("Failed to delete customer", "error");
      return;
    }

    addToast("Customer deleted", "success");
    router.push("/app/customers");
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto p-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold truncate">{customer.name}</h1>
                <p className="text-muted-foreground text-sm">
                  Customer since {formatDate(customer.created_at)}
                </p>
                {/* Tags */}
                {!loadingTags && (
                  <div className="flex flex-wrap gap-2 items-center mt-2">
                    {tags.map(tag => {
                      const config = TAG_CONFIG[tag as keyof typeof TAG_CONFIG];
                      return config ? (
                        <Badge
                          key={tag}
                          variant={config.variant}
                          className="cursor-pointer"
                          onClick={() => {
                            if (confirm(`Remove "${config.label}" tag?`)) {
                              handleRemoveTag(tag);
                            }
                          }}
                        >
                          {config.icon} {config.label}
                        </Badge>
                      ) : null;
                    })}
                    {tags.length < MAX_TAGS_PER_CUSTOMER && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6">
                            <Plus className="mr-1 h-3 w-3" />
                            Add Tag
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Select Tag</DropdownMenuLabel>
                          {ALLOWED_TAGS.filter(tag => !tags.includes(tag)).map(tag => {
                            const config = TAG_CONFIG[tag];
                            return (
                              <DropdownMenuItem
                                key={tag}
                                onClick={() => handleAddTag(tag)}
                              >
                                {config.icon} {config.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/app/jobs/new?customerId=${customer.id}`}>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Job
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(!editing)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {editing ? "Cancel" : "Edit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {editing ? (
              /* Edit Form */
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <h3 className="font-semibold">Edit Customer</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address1">Street Address</Label>
                    <Input
                      id="address1"
                      value={address1}
                      onChange={(e) => setAddress1(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        maxLength={2}
                        value={state}
                        onChange={(e) => setState(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP</Label>
                      <Input
                        id="zip"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Internal notes about this customer..."
                    />
                  </div>

                  <Button onClick={handleSave} loading={saving}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              /* Tabs View */
              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <TabsTrigger value="timeline" className="shrink-0">
                    <Clock className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">Timeline</span>
                  </TabsTrigger>
                  <TabsTrigger value="jobs" className="shrink-0">
                    <Briefcase className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">Jobs ({jobs.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="shrink-0">
                    <Receipt className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">Invoices ({invoices.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="shrink-0">
                    <FileText className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">Notes</span>
                  </TabsTrigger>
                </TabsList>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-4">
                  {timeline.length === 0 ? (
                    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                      <Clock className="mx-auto h-8 w-8 mb-2" />
                      <p>No activity yet</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card">
                      {timeline.map((item, idx) => (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={`/app/${item.type === "job" ? "jobs" : "invoices"}/${item.id}`}
                          className="block p-4 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              {item.type === "job" ? (
                                <Briefcase className="h-5 w-5 text-primary" />
                              ) : (
                                <Receipt className="h-5 w-5 text-success" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium truncate">{item.title}</p>
                                <Badge
                                  variant={
                                    item.status === "paid" || item.status === "done"
                                      ? "success"
                                      : item.status === "in_progress" || item.status === "scheduled"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {item.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(item.date)}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Jobs Tab */}
                <TabsContent value="jobs" className="space-y-4">
                  {jobs.length === 0 ? (
                    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                      <Briefcase className="mx-auto h-8 w-8 mb-2" />
                      <p>No jobs yet</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card divide-y">
                      {jobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/app/jobs/${job.id}`}
                          className="block p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{job.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(job.created_at)}
                              </p>
                            </div>
                            <Badge className={JOB_STATUS_COLORS[job.status as JobStatus]}>
                              {JOB_STATUS_LABELS[job.status as JobStatus]}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Invoices Tab */}
                <TabsContent value="invoices" className="space-y-4">
                  {invoices.length === 0 ? (
                    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                      <Receipt className="mx-auto h-8 w-8 mb-2" />
                      <p>No invoices yet</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card divide-y">
                      {invoices.map((invoice) => (
                        <Link
                          key={invoice.id}
                          href={`/app/invoices/${invoice.id}`}
                          className="block p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {formatCurrency(invoice.amount_total)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(invoice.created_at)}
                              </p>
                            </div>
                            <Badge
                              variant={
                                invoice.status === "paid"
                                  ? "success"
                                  : invoice.status === "sent"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {invoice.status}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4">
                  <div className="rounded-lg border bg-card p-4">
                    {customer.notes ? (
                      <p className="whitespace-pre-wrap">{customer.notes}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        No notes yet. Click Edit to add notes.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Contact Info */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">Contact Info</h3>
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-sm hover:underline"
                  >
                    {formatPhone(customer.phone)}
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-sm hover:underline"
                  >
                    {customer.email}
                  </a>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-sm break-words">{address}</span>
                </div>
              )}
              {!customer.phone && !customer.email && !address && (
                <p className="text-sm text-muted-foreground">
                  No contact info added
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                    <p className="font-semibold">{jobs.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Receipt className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Total Invoiced</p>
                    <p className="font-semibold">{formatCurrency(totalInvoiced)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="font-semibold text-success">{formatCurrency(totalPaid)}</p>
                  </div>
                </div>
                {pendingAmount > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4 w-4 text-warning" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="font-semibold text-warning">{formatCurrency(pendingAmount)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment History */}
            {paidInvoices.length > 0 && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Payment History</h3>
                  {averageDaysToPay !== null && (
                    <Badge variant={getPaymentBadgeVariant()} className="text-xs">
                      {getPaymentBadgeText()}
                    </Badge>
                  )}
                </div>
                {paidInvoices.length < 5 && (
                  <p className="text-xs text-muted-foreground">
                    Based on {paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''} • Limited data
                  </p>
                )}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground grid grid-cols-3 gap-2 pb-1 border-b">
                    <span>Invoice</span>
                    <span>Paid</span>
                    <span className="text-right">Days</span>
                  </div>
                  {paidInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="grid grid-cols-3 gap-2 text-sm">
                      <span className="font-medium truncate">
                        {formatCurrency(invoice.amount_total)}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {formatDate(invoice.paid_at!)}
                      </span>
                      <span className={cn(
                        "text-right font-medium",
                        invoice.daysToPay < 7 ? "text-success" : 
                        invoice.daysToPay < 30 ? "text-foreground" : "text-warning"
                      )}>
                        {invoice.daysToPay}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

