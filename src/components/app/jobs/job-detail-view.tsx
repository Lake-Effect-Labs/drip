"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  formatDate,
  formatTime,
  formatCurrency,
  copyToClipboard,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobStatus,
} from "@/lib/utils";
import type { Job, Customer, Estimate, EstimateLineItem, Invoice, JobMaterial } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SimpleCheckbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  FileText,
  Receipt,
  Package,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };
type EstimateWithLineItems = Estimate & { line_items: EstimateLineItem[] };

interface JobDetailViewProps {
  job: JobWithCustomer;
  estimates: EstimateWithLineItems[];
  invoices: Invoice[];
  materials: JobMaterial[];
  teamMembers: { id: string; email: string; fullName: string }[];
  companyId: string;
}

export function JobDetailView({
  job: initialJob,
  estimates,
  invoices,
  materials: initialMaterials,
  teamMembers,
  companyId,
}: JobDetailViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [job, setJob] = useState(initialJob);
  const [materials, setMaterials] = useState(initialMaterials);
  const [saving, setSaving] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");

  // Form state
  const [scheduledDate, setScheduledDate] = useState(job.scheduled_date || "");
  const [scheduledTime, setScheduledTime] = useState(job.scheduled_time || "");
  const [assignedUserId, setAssignedUserId] = useState(job.assigned_user_id || "");
  const [notes, setNotes] = useState(job.notes || "");

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  async function handleSave() {
    setSaving(true);
    try {
      // Determine new status based on scheduling
      let newStatus = job.status;
      if (scheduledDate && job.status === "quoted") {
        newStatus = "scheduled";
      }

      const { error } = await supabase
        .from("jobs")
        .update({
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          assigned_user_id: assignedUserId || null,
          notes: notes || null,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      setJob((prev) => ({
        ...prev,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime || null,
        assigned_user_id: assignedUserId || null,
        notes: notes || null,
        status: newStatus,
      }));

      addToast("Job updated!", "success");
    } catch {
      addToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: JobStatus) {
    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", job.id);

    if (error) {
      addToast("Failed to update status", "error");
      return;
    }

    setJob((prev) => ({ ...prev, status: newStatus }));
    addToast("Status updated!", "success");
  }

  async function handleAddMaterial() {
    if (!newMaterial.trim()) return;

    const { data, error } = await supabase
      .from("job_materials")
      .insert({
        job_id: job.id,
        name: newMaterial.trim(),
        checked: false,
      })
      .select()
      .single();

    if (error) {
      addToast("Failed to add material", "error");
      return;
    }

    setMaterials((prev) => [...prev, data]);
    setNewMaterial("");
  }

  async function handleToggleMaterial(materialId: string, checked: boolean) {
    const { error } = await supabase
      .from("job_materials")
      .update({ checked })
      .eq("id", materialId);

    if (error) {
      addToast("Failed to update material", "error");
      return;
    }

    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, checked } : m))
    );
  }

  async function handleDeleteMaterial(materialId: string) {
    const { error } = await supabase
      .from("job_materials")
      .delete()
      .eq("id", materialId);

    if (error) {
      addToast("Failed to delete material", "error");
      return;
    }

    setMaterials((prev) => prev.filter((m) => m.id !== materialId));
  }

  function copyReminderMessage() {
    const customerName = job.customer?.name || "there";
    const dateStr = scheduledDate ? formatDate(scheduledDate) : "[date]";
    const timeStr = scheduledTime ? formatTime(scheduledTime) : "[time]";
    const message = `Hey ${customerName} — just a reminder that we're scheduled for ${dateStr} at ${timeStr} at ${address || "[address]"}. Reply here if anything changes. See you then!`;
    copyToClipboard(message);
    addToast("Reminder message copied!", "success");
  }

  function copyPaymentRequestMessage() {
    const customerName = job.customer?.name || "there";
    const latestInvoice = invoices[0];
    const invoiceUrl = latestInvoice
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/i/${latestInvoice.public_token}`
      : "[invoice link]";
    const amount = latestInvoice
      ? formatCurrency(latestInvoice.amount_total)
      : "[amount]";
    const message = `Hey ${customerName} — thanks again for letting us work on your project! Here's your invoice for ${amount}: ${invoiceUrl}. Let us know if you have any questions!`;
    copyToClipboard(message);
    addToast("Payment request message copied!", "success");
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
            <div>
              <h1 className="text-2xl font-bold">{job.title}</h1>
              {job.customer && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <User className="h-4 w-4" />
                  {job.customer.name}
                </p>
              )}
            </div>
            <Badge className={cn("w-fit", JOB_STATUS_COLORS[job.status as JobStatus])}>
              {JOB_STATUS_LABELS[job.status as JobStatus]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Info */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
              )}
              {job.customer?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <a href={`tel:${job.customer.phone}`} className="hover:underline">
                    {job.customer.phone}
                  </a>
                </div>
              )}
              {job.customer?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <a href={`mailto:${job.customer.email}`} className="hover:underline">
                    {job.customer.email}
                  </a>
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="estimates">
                  Estimates ({estimates.length})
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  Invoices ({invoices.length})
                </TabsTrigger>
                <TabsTrigger value="materials">
                  Materials ({materials.length})
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="font-semibold">Scheduling</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="scheduledDate">Date</Label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime">Start Time</Label>
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedUser">Assigned To</Label>
                    <Select
                      id="assignedUser"
                      value={assignedUserId}
                      onChange={(e) => setAssignedUserId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {scheduledDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyReminderMessage}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy reminder message
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="font-semibold">Notes</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this job..."
                    rows={4}
                  />
                </div>

                <Button onClick={handleSave} loading={saving}>
                  Save Changes
                </Button>
              </TabsContent>

              {/* Estimates Tab */}
              <TabsContent value="estimates" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Estimates</h3>
                  <Link href={`/app/estimates/new?jobId=${job.id}`}>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      New Estimate
                    </Button>
                  </Link>
                </div>

                {estimates.length === 0 ? (
                  <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <p>No estimates yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {estimates.map((estimate) => (
                      <Link
                        key={estimate.id}
                        href={`/app/estimates/${estimate.id}`}
                        className="block rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {formatCurrency(
                                estimate.line_items.reduce((sum, li) => sum + li.price, 0)
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {estimate.line_items.length} line items • {formatDate(estimate.created_at)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              estimate.status === "accepted"
                                ? "success"
                                : estimate.status === "sent"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {estimate.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Invoices</h3>
                  <Link href={`/app/invoices/new?jobId=${job.id}`}>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      New Invoice
                    </Button>
                  </Link>
                </div>

                {invoices.length === 0 ? (
                  <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                    <Receipt className="mx-auto h-8 w-8 mb-2" />
                    <p>No invoices yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/app/invoices/${invoice.id}`}
                        className="block rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
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

              {/* Materials Tab */}
              <TabsContent value="materials" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Materials Checklist</h3>
                </div>

                <div className="rounded-lg border bg-card divide-y">
                  {materials.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Package className="mx-auto h-8 w-8 mb-2" />
                      <p>No materials added</p>
                    </div>
                  ) : (
                    materials.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center gap-3 p-3"
                      >
                        <SimpleCheckbox
                          checked={material.checked}
                          onChange={(e) =>
                            handleToggleMaterial(material.id, e.target.checked)
                          }
                        />
                        <span
                          className={cn(
                            "flex-1",
                            material.checked && "line-through text-muted-foreground"
                          )}
                        >
                          {material.name}
                        </span>
                        <button
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add material */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add material..."
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMaterial();
                      }
                    }}
                  />
                  <Button onClick={handleAddMaterial} disabled={!newMaterial.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Status Actions */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">Actions</h3>
              {job.status === "new" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("quoted")}
                >
                  Mark as Quoted
                </Button>
              )}
              {job.status === "quoted" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("scheduled")}
                >
                  Mark as Scheduled
                </Button>
              )}
              {job.status === "scheduled" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("in_progress")}
                >
                  Start Job
                </Button>
              )}
              {job.status === "in_progress" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("done")}
                >
                  Mark Complete
                </Button>
              )}
              {job.status === "done" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("paid")}
                >
                  Mark as Paid
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => handleStatusChange("archive")}
              >
                Archive Job
              </Button>
            </div>

            {/* Copy Messages */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">Copy Messages</h3>
              {scheduledDate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={copyReminderMessage}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy reminder message
                </Button>
              )}
              {invoices.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={copyPaymentRequestMessage}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy payment request
                </Button>
              )}
              {estimates.length > 0 && estimates[0].public_token && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const url = `${window.location.origin}/e/${estimates[0].public_token}`;
                    copyToClipboard(url);
                    addToast("Estimate link copied!", "success");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy estimate link
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

