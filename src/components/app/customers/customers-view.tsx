"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPhone, formatDate } from "@/lib/utils";
import type { Customer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Users,
  Download,
  Upload,
} from "lucide-react";

interface CustomersViewProps {
  initialCustomers: Customer[];
  customerJobCounts: Record<string, number>;
  companyId: string;
}

export function CustomersView({
  initialCustomers,
  customerJobCounts,
  companyId,
}: CustomersViewProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvData, setCsvData] = useState("");
  const { addToast } = useToast();
  const supabase = createClient();

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  // Filter customers by search query
  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.city?.toLowerCase().includes(query)
    );
  });

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setAddress1("");
    setCity("");
    setState("");
    setZip("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          company_id: companyId,
          name: name.trim(),
          phone: phone || null,
          email: email || null,
          address1: address1 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
        })
        .select()
        .single();

      if (error) throw error;

      setCustomers((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setDialogOpen(false);
      resetForm();
      addToast("Customer added!", "success");
    } catch {
      addToast("Failed to add customer", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportCustomers() {
    if (!csvData.trim()) {
      addToast("Please paste CSV data", "error");
      return;
    }

    setImporting(true);
    try {
      const lines = csvData.trim().split("\n");
      const headers = lines[0].toLowerCase().split(",");
      
      const nameIdx = headers.findIndex(h => h.includes("name"));
      const phoneIdx = headers.findIndex(h => h.includes("phone"));
      const emailIdx = headers.findIndex(h => h.includes("email"));
      const addressIdx = headers.findIndex(h => h.includes("address"));
      const cityIdx = headers.findIndex(h => h.includes("city"));
      const stateIdx = headers.findIndex(h => h.includes("state"));
      const zipIdx = headers.findIndex(h => h.includes("zip"));

      const customersToImport = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        
        if (nameIdx >= 0 && values[nameIdx]) {
          customersToImport.push({
            company_id: companyId,
            name: values[nameIdx],
            phone: phoneIdx >= 0 ? values[phoneIdx] || null : null,
            email: emailIdx >= 0 ? values[emailIdx] || null : null,
            address1: addressIdx >= 0 ? values[addressIdx] || null : null,
            city: cityIdx >= 0 ? values[cityIdx] || null : null,
            state: stateIdx >= 0 ? values[stateIdx] || null : null,
            zip: zipIdx >= 0 ? values[zipIdx] || null : null,
          });
        }
      }

      if (customersToImport.length === 0) {
        addToast("No valid customers found in CSV", "error");
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .insert(customersToImport)
        .select();

      if (error) throw error;

      setCustomers((prev) => [...(data || []), ...prev]);
      setCsvData("");
      setImportDialogOpen(false);
      addToast(`Imported ${data?.length || 0} customers!`, "success");
    } catch (error) {
      console.error("Import error:", error);
      addToast("Failed to import customers", "error");
    } finally {
      setImporting(false);
    }
  }

  async function handleExportCustomers() {
    try {
      const csv = [
        ["Name", "Phone", "Email", "Address", "City", "State", "ZIP", "Total Jobs", "Created At"].join(","),
        ...customers.map((cust) =>
          [
            `"${cust.name.replace(/"/g, '""')}"`,
            cust.phone || "",
            cust.email || "",
            `"${(cust.address1 || "").replace(/"/g, '""')}"`,
            cust.city || "",
            cust.state || "",
            cust.zip || "",
            customerJobCounts[cust.id] || 0,
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCustomers}
              disabled={customers.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {filteredCustomers.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {searchQuery ? (
              <>
                <p className="text-muted-foreground">No customers found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No customers yet</p>
                <Button onClick={() => setDialogOpen(true)} className="mt-4">
                  Add your first customer
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-card divide-y">
            {filteredCustomers.map((customer) => (
              <Link
                key={customer.id}
                href={`/app/customers/${customer.id}`}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{customer.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(customer.phone)}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </span>
                    )}
                    {customer.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {customer.city}, {customer.state}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {customerJobCounts[customer.id] || 0} job
                    {(customerJobCounts[customer.id] || 0) !== 1 ? "s" : ""}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Added {formatDate(customer.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Add a new customer to your list.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Smith"
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
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address1">Street Address</Label>
              <Input
                id="address1"
                placeholder="123 Main St"
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add Customer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Customers</DialogTitle>
            <DialogDescription>
              Paste CSV data with columns: Name, Phone, Email, Address, City, State, ZIP
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="csvData">CSV Data</Label>
              <textarea
                id="csvData"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Name,Phone,Email,Address,City,State,ZIP
John Smith,555-1234,john@email.com,123 Main St,Austin,TX,78701
Jane Doe,555-5678,jane@email.com,456 Oak Ave,Dallas,TX,75201"
                className="w-full min-h-[200px] p-3 rounded-lg border bg-background font-mono text-sm"
              />
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Tips:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>First row should be headers (Name, Phone, Email, etc.)</li>
                <li>Name column is required</li>
                <li>Other columns are optional</li>
                <li>You can export from Excel or Google Sheets as CSV</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImportDialogOpen(false);
                  setCsvData("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleImportCustomers} loading={importing}>
                <Upload className="mr-2 h-4 w-4" />
                Import Customers
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

