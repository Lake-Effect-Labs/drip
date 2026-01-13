"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { InventoryItem, PickupLocation, JobMaterial, Job } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Package, ShoppingCart, Pencil, Trash2, CheckCircle, Briefcase, Store } from "lucide-react";

type ItemWithLocation = InventoryItem & {
  pickup_location: PickupLocation | null;
};

type JobMaterialWithJob = JobMaterial & {
  job: Job;
};

interface InventoryViewProps {
  initialItems: ItemWithLocation[];
  pickupLocations: PickupLocation[];
  companyId: string;
  jobMaterials: JobMaterialWithJob[];
}

const UNITS = ["each", "gal", "box", "roll", "pack", "can", "tube"];
const CATEGORIES = [
  { value: "paint", label: "Paint" },
  { value: "primer", label: "Primer" },
  { value: "sundries", label: "Sundries" },
  { value: "tools", label: "Tools" },
];

interface MaterialNeed {
  inventoryItemId: string | null;
  name: string;
  totalNeeded: number;
  unit: string;
  storeId: string | null;
  storeName: string | null;
  onHand: number;
  quantityStillNeeded: number;
  jobIds: string[];
  jobTitles: string[];
  jobMaterialIds: string[];
}

export function InventoryView({
  initialItems,
  pickupLocations,
  companyId,
  jobMaterials,
}: InventoryViewProps) {
  const [items, setItems] = useState<ItemWithLocation[]>(initialItems);
  const [materials, setMaterials] = useState<JobMaterialWithJob[]>(jobMaterials);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithLocation | null>(null);
  const { addToast } = useToast();
  const supabase = createClient();

  // Subscribe to real-time updates for job_materials
  useEffect(() => {
    async function refreshMaterials() {
      const { data: refreshedMaterials } = await supabase
        .from("job_materials")
        .select(`
          *,
          job:jobs!inner(
            id,
            title,
            status,
            company_id
          )
        `)
        .eq("job.company_id", companyId)
        .in("job.status", ["new", "quoted", "scheduled", "in_progress"])
        .is("purchased_at", null);

      if (refreshedMaterials) {
        setMaterials(refreshedMaterials as any);
      }
    }

    // Subscribe to job_materials changes
    const channel = supabase
      .channel(`inventory-job-materials-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_materials",
        },
        () => {
          // Refresh materials when any job_material changes
          refreshMaterials();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          // Refresh materials when job status changes (might affect which materials show)
          refreshMaterials();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, supabase]);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("sundries");
  const [unit, setUnit] = useState("each");
  const [onHand, setOnHand] = useState("");
  const [reorderAt, setReorderAt] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [vendorName, setVendorName] = useState("Sherwin-Williams");
  const [vendorSku, setVendorSku] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Calculate "Materials Needed for Jobs"
  const materialsNeeded = useMemo(() => {
    const needsMap = new Map<string, MaterialNeed>();

    materials.forEach((material) => {
      // Use inventory_item_id as key if linked, otherwise use the material name
      const key = material.inventory_item_id || `unlinked_${material.name.toLowerCase()}`;

      const existing = needsMap.get(key);
      const quantity = material.quantity_decimal || 0;

      if (existing) {
        existing.totalNeeded += quantity;
        existing.jobIds.push(material.job.id);
        existing.jobTitles.push(material.job.title);
        existing.jobMaterialIds.push(material.id);
      } else {
        // Find the inventory item if linked
        const inventoryItem = material.inventory_item_id
          ? items.find(i => i.id === material.inventory_item_id)
          : null;

        const onHand = inventoryItem?.on_hand || 0;
        const storeId = inventoryItem?.preferred_pickup_location_id || null;
        const storeName = inventoryItem?.pickup_location?.name || null;

        needsMap.set(key, {
          inventoryItemId: material.inventory_item_id,
          name: material.name,
          totalNeeded: quantity,
          unit: material.unit || inventoryItem?.unit || "each",
          storeId,
          storeName,
          onHand,
          quantityStillNeeded: Math.max(quantity - onHand, 0),
          jobIds: [material.job.id],
          jobTitles: [material.job.title],
          jobMaterialIds: [material.id],
        });
      }
    });

    // Calculate final quantities still needed
    Array.from(needsMap.values()).forEach((need) => {
      need.quantityStillNeeded = Math.max(need.totalNeeded - need.onHand, 0);
    });

    // Filter to only show items where quantity is still needed
    const needsArray = Array.from(needsMap.values()).filter(
      (need) => need.quantityStillNeeded > 0
    );

    // Group by store
    const grouped: { [key: string]: MaterialNeed[] } = {
      "No Store": [],
    };

    needsArray.forEach((need) => {
      const storeName = need.storeName || "No Store";
      if (!grouped[storeName]) {
        grouped[storeName] = [];
      }
      grouped[storeName].push(need);
    });

    return grouped;
  }, [materials, items]);

  // Buy List: Items needed for jobs that aren't in inventory
  const buyListItems = useMemo(() => {
    const needsArray = Object.values(materialsNeeded).flat();
    // Filter to only items that aren't linked to inventory (don't exist in inventory)
    return needsArray.filter((need) => !need.inventoryItemId);
  }, [materialsNeeded]);

  function resetForm() {
    setName("");
    setCategory("sundries");
    setUnit("each");
    setOnHand("");
    setReorderAt("");
    setCostPerUnit("");
    setVendorName("Sherwin-Williams");
    setVendorSku("");
    setNotes("");
    setEditingItem(null);
  }

  function openEditDialog(item: ItemWithLocation) {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setOnHand(item.on_hand.toString());
    setReorderAt(item.reorder_at.toString());
    setCostPerUnit(item.cost_per_unit?.toString() || "");
    setVendorName(item.vendor_name || "Sherwin-Williams");
    setVendorSku(item.vendor_sku || "");
    setNotes(item.notes || "");
    setDialogOpen(true);
  }

  function openNewDialog() {
    resetForm();
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);

    try {
      const itemData = {
        company_id: companyId,
        name: name.trim(),
        category,
        unit,
        on_hand: parseInt(onHand) || 0,
        reorder_at: parseInt(reorderAt) || 0,
        cost_per_unit: costPerUnit ? parseFloat(costPerUnit) : null,
        vendor_name: vendorName || null,
        vendor_sku: vendorSku || null,
        preferred_pickup_location_id: null,
        notes: notes || null,
      };

      if (editingItem) {
        // Update existing
        const { data, error } = await supabase
          .from("inventory_items")
          .update(itemData)
          .eq("id", editingItem.id)
          .select("*")
          .single();

        if (error) throw error;

        const location = pickupLocations.find(l => l.id === data.preferred_pickup_location_id) || null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemWithLocation = { ...data, pickup_location: location } as any;

        setItems((prev) =>
          prev.map((item) => (item.id === editingItem.id ? itemWithLocation : item))
        );
        addToast("Item updated!", "success");
      } else {
        // Create new
        const { data, error } = await supabase
          .from("inventory_items")
          .insert(itemData)
          .select("*")
          .single();

        if (error) throw error;

        const location = pickupLocations.find(l => l.id === data.preferred_pickup_location_id) || null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemWithLocation = { ...data, pickup_location: location } as any;

        setItems((prev) => [...prev, itemWithLocation].sort((a, b) => a.name.localeCompare(b.name)));
        addToast("Item added!", "success");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving item:", error);
      addToast("Failed to save item", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm("Delete this item?")) return;

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      addToast("Failed to delete item", "error");
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
    addToast("Item deleted", "success");
  }

  async function handleUpdateQuantity(itemId: string, newQuantity: number) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ on_hand: newQuantity })
      .eq("id", itemId);

    if (error) {
      addToast("Failed to update quantity", "error");
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, on_hand: newQuantity } : item
      )
    );
  }

  async function handleMarkAsPurchased(jobMaterialIds: string[], inventoryItemId: string | null, quantityPurchased: number) {
    try {
      // Mark job materials as purchased
      const { error: materialsError } = await supabase
        .from("job_materials")
        .update({ purchased_at: new Date().toISOString() })
        .in("id", jobMaterialIds);

      if (materialsError) throw materialsError;

      // If linked to inventory item, increase on_hand quantity
      if (inventoryItemId) {
        const item = items.find(i => i.id === inventoryItemId);
        if (item) {
          const newQuantity = item.on_hand + quantityPurchased;
          await handleUpdateQuantity(inventoryItemId, newQuantity);
        }
      }

      // Remove from materials list
      setMaterials((prev) => prev.filter((m) => !jobMaterialIds.includes(m.id)));

      addToast("Marked as purchased!", "success");
    } catch (error) {
      console.error("Error marking as purchased:", error);
      addToast("Failed to mark as purchased", "error");
    }
  }

  const materialCount = Object.values(materialsNeeded).flat().length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""} •{" "}
            {materialCount} needed for jobs
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              All Items ({items.length})
            </TabsTrigger>
            <TabsTrigger value="needed">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
              Needed for Jobs ({materialCount})
            </TabsTrigger>
            <TabsTrigger value="buy">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Buy List ({buyListItems.length})
            </TabsTrigger>
            <TabsTrigger value="stores">
              <Store className="mr-1.5 h-3.5 w-3.5" />
              Stores ({pickupLocations.length})
            </TabsTrigger>
          </TabsList>

          {/* All Items */}
          <TabsContent value="all" className="mt-4">
            {items.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No inventory items yet</p>
                <Button onClick={openNewDialog} className="mt-4">
                  Add your first item
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border bg-card divide-y">
                {items.map((item) => (
                  <InventoryItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => openEditDialog(item)}
                    onDelete={() => handleDelete(item.id)}
                    onUpdateQuantity={(qty) => handleUpdateQuantity(item.id, qty)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Materials Needed for Jobs */}
          <TabsContent value="needed" className="mt-4">
            {materialCount === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-muted-foreground">No materials needed for active jobs!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(materialsNeeded).map(([storeName, needs]) => (
                  needs.length > 0 && (
                    <div key={storeName}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        {storeName}
                      </h3>
                      <div className="rounded-lg border bg-card divide-y">
                        {needs.map((need) => (
                          <MaterialNeedRow
                            key={need.inventoryItemId || need.name}
                            need={need}
                            onMarkAsPurchased={(qty) =>
                              handleMarkAsPurchased(need.jobMaterialIds, need.inventoryItemId, qty)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </TabsContent>

          {/* Buy List - Items needed for jobs that aren't in inventory */}
          <TabsContent value="buy" className="mt-4">
            {buyListItems.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-muted-foreground">Nothing to buy!</p>
                <p className="text-sm text-muted-foreground mt-2">
                  All materials needed for jobs are already in your inventory.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card divide-y">
                  {buyListItems.map((need, index) => (
                    <div key={need.inventoryItemId || need.name || index} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{need.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Need {need.quantityStillNeeded.toFixed(2)} {need.unit}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          For {need.jobTitles.length} job{need.jobTitles.length !== 1 ? "s" : ""}: {need.jobTitles.join(", ")}
                        </p>
                        {need.storeName && (
                          <p className="text-xs text-muted-foreground">
                            Store: {need.storeName}
                          </p>
                        )}
                      </div>
                      <Badge variant="warning">{need.quantityStillNeeded.toFixed(2)} {need.unit}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  These items are needed for jobs but aren't in your inventory. Add them to your inventory or purchase them directly.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Stores */}
          <TabsContent value="stores" className="mt-4">
            {pickupLocations.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <Store className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No pickup locations configured yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Add stores or pickup locations in Settings to track where you purchase materials.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pickupLocations.map((location) => {
                  const itemsForLocation = items.filter(
                    (item) => item.preferred_pickup_location_id === location.id
                  );
                  return (
                    <div key={location.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{location.name}</h3>
                          {location.address1 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {location.address1}
                              {location.city && `, ${location.city}`}
                              {location.state && `, ${location.state}`}
                            </p>
                          )}
                        </div>
                        <Badge variant="default">{itemsForLocation.length}</Badge>
                      </div>
                      {location.notes && (
                        <p className="text-xs text-muted-foreground mb-2">{location.notes}</p>
                      )}
                      {itemsForLocation.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Items from this store:
                          </p>
                          <div className="space-y-1">
                            {itemsForLocation.slice(0, 5).map((item) => (
                              <p key={item.id} className="text-xs truncate">
                                • {item.name}
                              </p>
                            ))}
                            {itemsForLocation.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                +{itemsForLocation.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Item" : "Add Inventory Item"}
            </DialogTitle>
            <DialogDescription>
              Track supplies to know when you need to restock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Painter's Tape 2in"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="onHand">On Hand</Label>
                <Input
                  id="onHand"
                  type="number"
                  min="0"
                  value={onHand}
                  onChange={(e) => setOnHand(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderAt">Reorder At</Label>
                <Input
                  id="reorderAt"
                  type="number"
                  min="0"
                  value={reorderAt}
                  onChange={(e) => setReorderAt(e.target.value)}
                  placeholder="5"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="costPerUnit">Cost per Unit ($)</Label>
                <Input
                  id="costPerUnit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <hr />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Vendor Info (optional)</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vendorName">Vendor</Label>
                  <Input
                    id="vendorName"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Sherwin-Williams"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendorSku">SKU</Label>
                  <Input
                    id="vendorSku"
                    value={vendorSku}
                    onChange={(e) => setVendorSku(e.target.value)}
                    placeholder="SW-12345"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about this item"
                    rows={2}
                  />
                </div>
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
                {editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InventoryItemRow({
  item,
  onEdit,
  onDelete,
  onUpdateQuantity,
  showWarning,
}: {
  item: ItemWithLocation;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateQuantity: (qty: number) => void;
  showWarning?: boolean;
}) {
  const isLow = item.on_hand <= item.reorder_at;

  return (
    <div className="p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{item.name}</p>
          {isLow && showWarning && (
            <Badge variant="warning" className="shrink-0">
              Low
            </Badge>
          )}
          <Badge variant="default" className="shrink-0 text-xs">
            {item.category}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {item.on_hand} {item.unit} on hand
          {item.reorder_at > 0 && ` • Reorder at ${item.reorder_at}`}
        </p>
        {item.vendor_sku && (
          <p className="text-xs text-muted-foreground">SKU: {item.vendor_sku}</p>
        )}
      </div>

      {/* Quick quantity adjust */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onUpdateQuantity(Math.max(0, item.on_hand - 1))}
        >
          -
        </Button>
        <span className="w-8 text-center text-sm font-medium">{item.on_hand}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onUpdateQuantity(item.on_hand + 1)}
        >
          +
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MaterialNeedRow({
  need,
  onMarkAsPurchased,
}: {
  need: MaterialNeed;
  onMarkAsPurchased: (quantity: number) => void;
}) {
  return (
    <div className="p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{need.name}</p>
          {!need.inventoryItemId && (
            <Badge variant="default" className="shrink-0 text-xs">
              Not Linked
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Total needed: {need.totalNeeded.toFixed(2)} {need.unit}
          {" • "}
          On hand: {need.onHand} {need.unit}
          {" • "}
          Still need: {need.quantityStillNeeded.toFixed(2)} {need.unit}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          For {need.jobTitles.length} job{need.jobTitles.length !== 1 ? "s" : ""}: {need.jobTitles.join(", ")}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onMarkAsPurchased(need.quantityStillNeeded)}
      >
        <CheckCircle className="mr-2 h-4 w-4" />
        Mark as Purchased
      </Button>
    </div>
  );
}
