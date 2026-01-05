"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
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
} from "lucide-react";

interface CustomerDetailViewProps {
  customer: Customer;
  jobs: Job[];
  invoices: Invoice[];
  companyId: string;
}

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

  // Form state
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [email, setEmail] = useState(customer.email || "");
  const [address1, setAddress1] = useState(customer.address1 || "");
  const [city, setCity] = useState(customer.city || "");
  const [state, setState] = useState(customer.state || "");
  const [zip, setZip] = useState(customer.zip || "");
  const [notes, setNotes] = useState(customer.notes || "");

  const address = [customer.address1, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");

  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount_total, 0);

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
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                <p className="text-muted-foreground">
                  Customer since {formatDate(customer.created_at)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
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
              <Tabs defaultValue="jobs" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="jobs">
                    <Briefcase className="mr-1.5 h-4 w-4" />
                    Jobs ({jobs.length})
                  </TabsTrigger>
                  <TabsTrigger value="invoices">
                    <Receipt className="mr-1.5 h-4 w-4" />
                    Invoices ({invoices.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    <FileText className="mr-1.5 h-4 w-4" />
                    Notes
                  </TabsTrigger>
                </TabsList>

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
                  <span className="text-sm">{address}</span>
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
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Jobs</span>
                  <span className="font-medium">{jobs.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Invoices</span>
                  <span className="font-medium">{invoices.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="font-medium text-success">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

