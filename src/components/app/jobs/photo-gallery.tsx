"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Image as ImageIcon, ImagePlus, Upload, Camera, Clock, CheckCircle2 } from "lucide-react";
import type { JobPhoto } from "@/types/database";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  jobId: string;
  companyId: string;
  compact?: boolean;
}

type PhotoTag = "before" | "after" | "progress";

export function PhotoGallery({ jobId, companyId, compact = false }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<PhotoTag>("progress");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadPhotos();
  }, [jobId]);

  // Clean up preview URL when dialog closes
  useEffect(() => {
    if (!uploadDialogOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedTag("progress");
    }
  }, [uploadDialogOpen]);

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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  function validateAndSetFile(file: File) {
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

    setSelectedFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
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
      setUploadDialogOpen(false);

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

  const tagOptions: { value: PhotoTag; label: string; icon: React.ReactNode; description: string }[] = [
    { value: "before", label: "Before", icon: <Camera className="h-5 w-5" />, description: "Starting condition" },
    { value: "progress", label: "In Progress", icon: <Clock className="h-5 w-5" />, description: "Work in progress" },
    { value: "after", label: "After", icon: <CheckCircle2 className="h-5 w-5" />, description: "Completed work" },
  ];

  return (
    <div className="space-y-4">
      {/* Add Photo Button */}
      {!compact && (
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="w-full touch-target min-h-[44px]"
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Add Photo
        </Button>
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
                  <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded capitalize">
                    {photo.tag === "progress" ? "In Progress" : photo.tag}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Upload Photo Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* File Upload Area */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP, or HEIC (max 10MB)
                </p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={previewUrl!}
                  alt="Preview"
                  className="w-full rounded-lg max-h-64 object-contain bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Photo Type Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Photo Type</p>
              <div className="grid grid-cols-3 gap-2">
                {tagOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedTag(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                      selectedTag === option.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    {option.icon}
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              loading={uploading}
              className="w-full"
            >
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                    <strong>Type:</strong>{" "}
                    <span className="capitalize">
                      {selectedPhoto.tag === "progress" ? "In Progress" : selectedPhoto.tag || "other"}
                    </span>
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
