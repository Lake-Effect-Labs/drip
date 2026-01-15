"use client";

import { useState } from "react";
import { EstimateMaterial } from "@/types/database";
import { formatCurrency, PAINT_SHEENS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, Edit2, Check, X, RefreshCw } from "lucide-react";

interface EstimateMaterialsListProps {
  estimateId: string;
  materials: EstimateMaterial[];
  isEditable?: boolean; // Can the user edit/delete materials
  onMaterialsChange?: () => void; // Callback when materials are updated
}

export function EstimateMaterialsList({
  estimateId,
  materials: initialMaterials,
  isEditable = true,
  onMaterialsChange,
}: EstimateMaterialsListProps) {
  const { addToast } = useToast();
  const [materials, setMaterials] = useState<EstimateMaterial[]>(initialMaterials);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EstimateMaterial>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    paint_product: "",
    product_line: "",
    color_name: "",
    color_code: "",
    sheen: "Eggshell",
    area_description: "",
    quantity_gallons: "",
    cost_per_gallon: "45.00",
    notes: "",
  });
  const [regenerating, setRegenerating] = useState(false);

  const refreshMaterials = async () => {
    try {
      const response = await fetch(`/api/estimate-materials/${estimateId}`);
      if (!response.ok) throw new Error("Failed to fetch materials");
      const data = await response.json();
      setMaterials(data.materials || []);
      onMaterialsChange?.();
    } catch (error) {
      console.error("Error refreshing materials:", error);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("This will replace all auto-generated materials. Manual materials will be kept. Continue?")) {
      return;
    }

    setRegenerating(true);
    try {
      const response = await fetch(`/api/estimate-materials/${estimateId}/generate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to regenerate materials");

      const data = await response.json();
      addToast(`${data.count} materials created from line items`, "success");

      await refreshMaterials();
    } catch (error) {
      console.error("Error regenerating materials:", error);
      addToast("Failed to regenerate materials", "error");
    } finally {
      setRegenerating(false);
    }
  };

  const handleEdit = (material: EstimateMaterial) => {
    setEditingId(material.id);
    setEditForm({
      name: material.name,
      paint_product: material.paint_product || "",
      product_line: material.product_line || "",
      color_name: material.color_name || "",
      color_code: material.color_code || "",
      sheen: material.sheen || "",
      area_description: material.area_description || "",
      quantity_gallons: material.quantity_gallons || 0,
      cost_per_gallon: material.cost_per_gallon || 0,
      notes: material.notes || "",
    });
  };

  const handleSaveEdit = async (materialId: string) => {
    try {
      const response = await fetch(
        `/api/estimate-materials/${estimateId}/${materialId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );

      if (!response.ok) throw new Error("Failed to update material");

      addToast("Material updated", "success");

      setEditingId(null);
      setEditForm({});
      await refreshMaterials();
    } catch (error) {
      console.error("Error updating material:", error);
      addToast("Failed to update material", "error");
    }
  };

  const handleDelete = async (materialId: string) => {
    if (!confirm("Are you sure you want to delete this material?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/estimate-materials/${estimateId}/${materialId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete material");

      addToast("Material deleted", "success");

      await refreshMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
      addToast("Failed to delete material", "error");
    }
  };

  const handleAddNew = async () => {
    try {
      const response = await fetch(`/api/estimate-materials/${estimateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newMaterial,
          quantity_gallons: parseFloat(newMaterial.quantity_gallons) || 0,
          cost_per_gallon: parseFloat(newMaterial.cost_per_gallon) || 0,
        }),
      });

      if (!response.ok) throw new Error("Failed to add material");

      addToast("Material added", "success");

      setIsAddingNew(false);
      setNewMaterial({
        name: "",
        paint_product: "",
        product_line: "",
        color_name: "",
        color_code: "",
        sheen: "Eggshell",
        area_description: "",
        quantity_gallons: "",
        cost_per_gallon: "45.00",
        notes: "",
      });
      await refreshMaterials();
    } catch (error) {
      console.error("Error adding material:", error);
      addToast("Failed to add material", "error");
    }
  };

  const totalGallons = materials.reduce((sum, m) => sum + (m.quantity_gallons || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Materials</h3>
          <p className="text-sm text-gray-500">
            Total: {totalGallons.toFixed(1)} gallons
          </p>
        </div>
        {isEditable && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="w-full sm:w-auto justify-start sm:justify-center"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="hidden md:inline">{regenerating ? "Regenerating..." : "Regenerate from Line Items"}</span>
              <span className="md:hidden">{regenerating ? "Regenerating..." : "Regenerate"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAddingNew(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Add Material
            </Button>
          </div>
        )}
      </div>

      {/* Materials List */}
      <div className="space-y-2">
        {materials.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No materials yet</p>
            {isEditable && (
              <p className="text-sm mt-2">
                Click "Regenerate from Line Items" to auto-generate materials based on your line items
              </p>
            )}
          </div>
        ) : (
          materials.map((material) => (
            <div
              key={material.id}
              className="border rounded-lg p-4 bg-white hover:bg-gray-50"
            >
              {editingId === material.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editForm.name || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Area</Label>
                      <Input
                        value={editForm.area_description || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, area_description: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Product Line</Label>
                      <Input
                        value={editForm.product_line || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, product_line: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Color Name</Label>
                      <Input
                        value={editForm.color_name || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, color_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Color Code</Label>
                      <Input
                        value={editForm.color_code || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, color_code: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 md:col-span-1">
                      <Label>Sheen</Label>
                      <Select
                        value={editForm.sheen || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, sheen: e.target.value })
                        }
                        className="w-full"
                      >
                        <option value="">Select sheen</option>
                        {PAINT_SHEENS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Quantity (gal)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={editForm.quantity_gallons || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            quantity_gallons: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-base"
                      />
                    </div>
                    <div>
                      <Label>Cost per Gallon</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.cost_per_gallon || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            cost_per_gallon: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-base"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditForm({});
                      }}
                      className="w-full sm:w-auto"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(material.id)} className="w-full sm:w-auto">
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{material.name}</h4>
                      {material.is_auto_generated && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Auto
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      {material.area_description && (
                        <div>Area: {material.area_description}</div>
                      )}
                      {(material.product_line || material.color_name || material.sheen) && (
                        <div>
                          {material.product_line && `${material.product_line} `}
                          {material.color_name && `${material.color_name} `}
                          {material.color_code && `(${material.color_code}) `}
                          {material.sheen && `- ${material.sheen}`}
                        </div>
                      )}
                      {material.quantity_gallons && (
                        <div>
                          Quantity: {material.quantity_gallons} gallons
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditable && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(material)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(material.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add New Material Form */}
      {isAddingNew && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <h4 className="font-medium">Add New Material</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={newMaterial.name}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, name: e.target.value })
                }
                placeholder="e.g., Interior Paint - Living Room"
              />
            </div>
            <div>
              <Label>Area</Label>
              <Input
                value={newMaterial.area_description}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, area_description: e.target.value })
                }
                placeholder="e.g., Living Room Walls"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Product Line</Label>
              <Input
                value={newMaterial.product_line}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, product_line: e.target.value })
                }
                placeholder="e.g., Duration"
              />
            </div>
            <div>
              <Label>Color Name</Label>
              <Input
                value={newMaterial.color_name}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, color_name: e.target.value })
                }
                placeholder="e.g., Agreeable Gray"
              />
            </div>
            <div>
              <Label>Color Code</Label>
              <Input
                value={newMaterial.color_code}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, color_code: e.target.value })
                }
                placeholder="e.g., SW 7029"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Sheen</Label>
              <Select
                value={newMaterial.sheen}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, sheen: e.target.value })
                }
              >
                {PAINT_SHEENS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Quantity (gal) *</Label>
              <Input
                type="number"
                step="0.1"
                value={newMaterial.quantity_gallons}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, quantity_gallons: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Cost per Gallon *</Label>
              <Input
                type="number"
                step="0.01"
                value={newMaterial.cost_per_gallon}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, cost_per_gallon: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingNew(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddNew}
              disabled={!newMaterial.name || !newMaterial.quantity_gallons}
              className="w-full sm:w-auto"
            >
              Add Material
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
