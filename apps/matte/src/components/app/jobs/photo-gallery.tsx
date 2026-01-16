"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Trash2, Image as ImageIcon, ImagePlus } from "lucide-react";
import type { JobPhoto } from "@drip/core/types";

interface PhotoGalleryProps {
  jobId: string;
  companyId: string;
  compact?: boolean;
}

export function PhotoGallery({ jobId, companyId, compact = false }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [selectedTag, setSelectedTag] = useState<"before" | "after" | "other">("other");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadPhotos();
  }, [jobId]);

  async function loadPhotos() {
    try {
      const response = await fetch(`/api/jobs/${jobId}/photos`);
      if (!response.ok) throw new Error("Failed to load photos");
      const data = await response.json();
      setPhotos(data);
    } catch (error) {
      console.error("Error loading photos:", error);
      addToast("Failed to load photos", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      addToast("File too large (max 10MB)", "error");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
    if (!validTypes.includes(file.type)) {
      addToast("Invalid file type. Use JPEG, PNG, WebP, or HEIC", "error");
      return;
    }

    await uploadPhoto(file);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tag", selectedTag);

      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Upload error details:", error);
        throw new Error(error.error || "Upload failed");
      }

      const photo = await response.json();
      setPhotos((prev) => [photo, ...prev]);
      addToast("Photo uploaded!", "success");

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      addToast(error.message || "Failed to upload photo", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Delete this photo? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete photo");

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setSelectedPhoto(null);
      addToast("Photo deleted", "success");
    } catch (error) {
      console.error("Delete error:", error);
      addToast("Failed to delete photo", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Controls */}
      {!compact && (
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value as "before" | "after" | "other")}
            className="flex-1 min-h-[44px]"
          >
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="other">Other</option>
          </Select>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            loading={uploading}
            className="flex-1 touch-target min-h-[44px]"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Add Photo"}
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm">Loading photos...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && photos.length === 0 && (
        <div className="p-8 text-center text-muted-foreground rounded-lg border bg-muted/30">
          <ImageIcon className="mx-auto h-8 w-8 mb-2" />
          <p>No photos yet</p>
          <p className="text-xs mt-1">Take or upload photos to document this job</p>
        </div>
      )}

      {/* Photo Grid - All Photos */}
      {!loading && photos.length > 0 && (
        <div className={compact ? "flex items-center gap-2" : "grid grid-cols-2 sm:grid-cols-3 gap-3"}>
          {compact ? (
            <>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
              </div>
              {photos.slice(0, 3).map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="w-12 h-12 rounded overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                >
                  <img
                    src={photo.public_url}
                    alt={photo.caption || "Photo"}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </>
          ) : (
            photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity relative"
              >
                <img
                  src={photo.public_url}
                  alt={photo.caption || "Photo"}
                  className="w-full h-full object-cover"
                />
                {photo.tag && (
                  <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                    {photo.tag}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Photo</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <img
                src={selectedPhoto.public_url}
                alt={selectedPhoto.caption || "Photo"}
                className="w-full rounded-lg"
              />
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <strong>Tag:</strong> {selectedPhoto.tag || "other"}
                  </p>
                  {selectedPhoto.file_name && (
                    <p>
                      <strong>File:</strong> {selectedPhoto.file_name}
                    </p>
                  )}
                  {selectedPhoto.caption && (
                    <p>
                      <strong>Caption:</strong> {selectedPhoto.caption}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePhoto(selectedPhoto.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
