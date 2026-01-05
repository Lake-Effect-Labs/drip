"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { InventoryItem, PickupLocation } from "@/types/database";
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
import { Plus, Package, AlertTriangle, ShoppingCart, Pencil, Trash2 } from "lucide-react";

type ItemWithLocation = InventoryItem & {
  pickup_location: PickupLocation | null;
};

interface InventoryViewProps {
  initialItems: ItemWithLocation[];
  pickupLocations: PickupLocation[];
  companyId: string;
}

const UNITS = ["each", "gal", "box", "roll", "pack", "can", "tube"];

export function InventoryView({
  initialItems,
  pickupLocations,
  companyId,
}: InventoryViewProps) {
  const [items, setItems] = useState<ItemWithLocation[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithLocation | null>(null);
  const { addToast } = useToast();
  const supabase = createClient();

  // Form state
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("each");
  const [onHand, setOnHand] = useState("");
  const [reorderAt, setReorderAt] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [vendorName, setVendorName] = useState("Sherwin-Williams");
  const [vendorSku, setVendorSku] = useState("");
  const [pickupLocationId, setPickupLocationId] = useState("");
  const [saving, setSaving] = useState(false);

  const lowStockItems = items.filter((item) => item.on_hand <= item.reorder_at);
  const buyListItems = lowStockItems.map((item) => ({
    ...item,
    needed: Math.max(item.reorder_at * 2 - item.on_hand, 1),
  }));

  function resetForm() {
    setName("");
    setUnit("each");
    setOnHand("");
    setReorderAt("");
    setCostPerUnit("");
    setVendorName("Sherwin-Williams");
    setVendorSku("");
    setPickupLocationId("");
    setEditingItem(null);
  }

  function openEditDialog(item: ItemWithLocation) {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setOnHand(item.on_hand.toString());
    setReorderAt(item.reorder_at.toString());
    setCostPerUnit(item.cost_per_unit?.toString() || "");
    setVendorName(item.vendor_name || "Sherwin-Williams");
    setVendorSku(item.vendor_sku || "");
    setPickupLocationId(item.preferred_pickup_location_id || "");
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
        unit,
        on_hand: parseInt(onHand) || 0,
        reorder_at: parseInt(reorderAt) || 0,
        cost_per_unit: costPerUnit ? parseFloat(costPerUnit) : null,
        vendor_name: vendorName || null,
        vendor_sku: vendorSku || null,
        preferred_pickup_location_id: pickupLocationId || null,
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""} •{" "}
            {lowStockItems.length} low stock
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
            <TabsTrigger value="low">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Low Stock ({lowStockItems.length})
            </TabsTrigger>
            <TabsTrigger value="buy">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Buy List
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

          {/* Low Stock */}
          <TabsContent value="low" className="mt-4">
            {lowStockItems.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-muted-foreground">All items are stocked!</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-card divide-y">
                {lowStockItems.map((item) => (
                  <InventoryItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => openEditDialog(item)}
                    onDelete={() => handleDelete(item.id)}
                    onUpdateQuantity={(qty) => handleUpdateQuantity(item.id, qty)}
                    showWarning
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Buy List */}
          <TabsContent value="buy" className="mt-4">
            {buyListItems.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-muted-foreground">Nothing to buy!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-card divide-y">
                  {buyListItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Need {item.needed} {item.unit}
                          {item.vendor_sku && ` • SKU: ${item.vendor_sku}`}
                        </p>
                        {item.pickup_location && (
                          <p className="text-xs text-muted-foreground">
                            Pickup: {item.pickup_location.name}
                          </p>
                        )}
                      </div>
                      <Badge variant="warning">{item.needed} {item.unit}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  This is a manual buy list. Copy items to your shopping list or order from your vendor.
                </p>
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

              <div className="space-y-2">
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
                  <Label htmlFor="pickupLocation">Preferred Pickup Location</Label>
                  <Select
                    id="pickupLocation"
                    value={pickupLocationId}
                    onChange={(e) => setPickupLocationId(e.target.value)}
                  >
                    <option value="">None</option>
                    {pickupLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </Select>
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

