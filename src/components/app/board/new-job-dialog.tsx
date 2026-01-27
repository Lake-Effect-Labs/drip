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
import { validatePhoneNumber } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";

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
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const { addToast} = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      loadCustomers();
    }
  }, [open]);

  // Handle initialCustomerId when it changes or when customers are loaded
  useEffect(() => {
    if (initialCustomerId && customers.length > 0 && !selectedCustomerId) {
      const customer = customers.find((c) => c.id === initialCustomerId);
      if (customer) {
        setSelectedCustomerId(customer.id);
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
  }, [initialCustomerId, customers, selectedCustomerId]);

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
          // Use the customer object directly instead of calling handleCustomerSelect
          // which depends on the customers state that hasn't been set yet
          setSelectedCustomerId(customer.id);
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
    setSelectedCustomerId(null);
    setCustomerSearchQuery("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate phone number if provided
      if (customerPhone.trim()) {
        const phoneValidation = validatePhoneNumber(customerPhone);
        if (!phoneValidation.isValid) {
          addToast(phoneValidation.error || "Invalid phone number", "error");
          setLoading(false);
          return;
        }
      }

      // Create customer if name provided and not using existing customer (via API to bypass RLS)
      let customerId: string | null = selectedCustomerId;
      if (customerName.trim() && !selectedCustomerId) {
        const customerResponse = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            email: customerEmail.trim() || null,
            address1: address1.trim() || null,
            address2: address2.trim() || null,
            city: city.trim() || null,
            state: state || null,
            zip: zip.trim() || null,
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
        if (jobResponse.status === 402) {
          addToast("Subscribe to create more jobs. Go to Settings to upgrade.", "error");
          onOpenChange(false);
          return;
        }
        throw new Error(errorData.error || "Failed to create job");
      }

      const job = await jobResponse.json();

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

            {selectedCustomerId ? (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-sm font-medium text-green-800">✓ Using existing customer</p>
                <p className="text-xs text-green-700 mt-1">
                  {customers.find(c => c.id === selectedCustomerId)?.name}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(null);
                    setCustomerSearchQuery("");
                    setCustomerName("");
                    setCustomerPhone("");
                    setCustomerEmail("");
                    setShowCustomerSearch(false);
                  }}
                  className="text-xs text-green-700 hover:text-green-900 underline mt-2"
                >
                  Clear and create new customer
                </button>
              </div>
            ) : (
              <>
                {/* New Customer Form - Primary */}
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name *</Label>
                      <Input
                        id="customerName"
                        placeholder="John Smith"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="min-h-[44px]"
                        required
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
                        className="min-h-[44px]"
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
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Search Existing - Secondary */}
                <div className="pt-2 border-t">
                  {!showCustomerSearch ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomerSearch(true)}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Or search existing customers
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="customerSearch" className="text-sm">Search Existing Customer</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomerSearch(false);
                            setCustomerSearchQuery("");
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="customerSearch"
                          placeholder="Type name, phone, or email..."
                          value={customerSearchQuery}
                          onChange={(e) => {
                            setCustomerSearchQuery(e.target.value);
                            setSelectedCustomerId(null);
                          }}
                          className="min-h-[44px]"
                          autoFocus
                        />
                        {customerSearchQuery && filteredCustomers.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-card shadow-lg">
                            {filteredCustomers.slice(0, 10).map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => handleCustomerSelect(customer.id)}
                                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0"
                              >
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {customer.phone && <span>{customer.phone}</span>}
                                  {customer.phone && customer.email && <span className="mx-1">•</span>}
                                  {customer.email && <span>{customer.email}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {customerSearchQuery && filteredCustomers.length === 0 && (
                          <div className="absolute z-50 w-full mt-1 p-4 rounded-md border bg-card shadow-lg text-center text-sm text-muted-foreground">
                            No customers found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              Create Job
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

