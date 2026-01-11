"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { Job, Customer, JobTemplateWithRelations } from "@/types/database";

type JobWithCustomer = Job & { customer: Customer | null };

interface NewJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  teamMembers: { id: string; email: string; fullName: string }[];
  onJobCreated: (job: JobWithCustomer) => void;
  initialCustomerId?: string | null;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export function NewJobDialog({
  open,
  onOpenChange,
  companyId,
  teamMembers,
  onJobCreated,
  initialCustomerId,
}: NewJobDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<JobTemplateWithRelations[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const { addToast} = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadCustomers();
    }
  }, [open]);

  async function loadTemplates() {
    try {
      const response = await fetch("/api/job-templates");
      if (!response.ok) throw new Error("Failed to load templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }

  async function loadCustomers() {
    try {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to load customers");
      const data = await response.json();
      setCustomers(data);
      
      // If initialCustomerId is provided, pre-select that customer
      if (initialCustomerId) {
        const customer = data.find((c: Customer) => c.id === initialCustomerId);
        if (customer) {
          handleCustomerSelect(customer.id);
        }
      }
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  }

  function handleCustomerSelect(customerId: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setSelectedCustomerId(customerId);
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone || "");
      setCustomerEmail(customer.email || "");
      setAddress1(customer.address1 || "");
      setAddress2(customer.address2 || "");
      setCity(customer.city || "");
      setState(customer.state || "");
      setZip(customer.zip || "");
      setCustomerSearchQuery(customer.name);
    }
  }

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

  function resetForm() {
    setTitle("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setAddress1("");
    setAddress2("");
    setCity("");
    setState("");
    setZip("");
    setNotes("");
    setAssignedUserId("");
    setSelectedTemplateId("");
    setSelectedCustomerId(null);
    setCustomerSearchQuery("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Create customer if name provided and not using existing customer (via API to bypass RLS)
      let customerId: string | null = selectedCustomerId;
      if (customerName.trim() && !selectedCustomerId) {
        const customerResponse = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            name: customerName.trim(),
            phone: customerPhone || null,
            email: customerEmail || null,
            address1: address1 || null,
            address2: address2 || null,
            city: city || null,
            state: state || null,
            zip: zip || null,
          }),
        });

        if (!customerResponse.ok) {
          const errorData = await customerResponse.json();
          throw new Error(errorData.error || "Failed to create customer");
        }

        const customer = await customerResponse.json();
        customerId = customer.id;
      }

      // Create job via API (bypasses RLS)
      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          customer_id: customerId,
          title: title.trim(),
          address1: address1 || null,
          address2: address2 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          notes: notes || null,
          assigned_user_id: assignedUserId || null,
          status: "new",
        }),
      });

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json();
        throw new Error(errorData.error || "Failed to create job");
      }

      const job = await jobResponse.json();

      // Apply template if selected
      if (selectedTemplateId) {
        const templateResponse = await fetch(
          `/api/job-templates/${selectedTemplateId}/use`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: job.id }),
          }
        );

        if (!templateResponse.ok) {
          console.error("Failed to apply template, but job created");
        }
      }

      onJobCreated(job);
      resetForm();
    } catch (error) {
      console.error("Error creating job:", error);
      addToast("Failed to create job", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
          <DialogDescription>
            Create a new job. It will start in the &quot;New&quot; column.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <Label htmlFor="template" className="text-sm font-medium">
                Start from Template (Optional)
              </Label>
              <Select
                id="template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="min-h-[44px]"
              >
                <option value="">None - Blank Job</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.description && ` - ${template.description.substring(0, 40)}${template.description.length > 40 ? '...' : ''}`}
                  </option>
                ))}
              </Select>
              {selectedTemplateId && (
                <p className="text-xs text-muted-foreground mt-2">
                  ℹ️ Template notes and materials will be added after creating the job
                </p>
              )}
            </div>
          )}

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Johnson Exterior Repaint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Customer Section */}
          <div className="space-y-3 rounded-lg border p-4">
            <h4 className="font-medium text-sm">Customer</h4>
            <div className="space-y-2">
              <Label htmlFor="customerSearch">Search Existing Customer (Optional)</Label>
              <div className="relative">
                <Input
                  id="customerSearch"
                  placeholder="Type to search customers..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setSelectedCustomerId(null);
                  }}
                  className="min-h-[44px]"
                />
                {customerSearchQuery && filteredCustomers.length > 0 && !selectedCustomerId && (
                  <div className="absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
                    {filteredCustomers.slice(0, 5).map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleCustomerSelect(customer.id)}
                        className="w-full text-left px-4 py-2 hover:bg-muted transition-colors"
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.phone && <span>{customer.phone} </span>}
                          {customer.email && <span>• {customer.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {selectedCustomerId ? (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium text-green-700">✓ Using existing customer</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(null);
                    setCustomerSearchQuery("");
                    setCustomerName("");
                    setCustomerPhone("");
                    setCustomerEmail("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground mt-1"
                >
                  Clear selection
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Or create a new customer:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Name</Label>
                    <Input
                      id="customerName"
                      placeholder="John Smith"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Phone</Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="john@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Address Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Job Address</h4>
            <div className="space-y-2">
              <Label htmlFor="address1">Street Address</Label>
              <Input
                id="address1"
                placeholder="123 Main St"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">Apt, Suite, etc.</Label>
              <Input
                id="address2"
                placeholder="Apt 4B"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Austin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  placeholder="78701"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-2">
            <Label htmlFor="assignedUser">Assign to</Label>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Job
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

