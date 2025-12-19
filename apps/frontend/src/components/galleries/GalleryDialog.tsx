"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { LocalGallery, GalleryInput } from "@/types/favorites";

interface GalleryDialogProps {
  gallery?: LocalGallery | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: GalleryInput) => void;
}

export function GalleryDialog({
  gallery,
  isOpen,
  onClose,
  onSave,
}: GalleryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize state from existing gallery
  useEffect(() => {
    if (isOpen) {
      setName(gallery?.name || "");
      setDescription(gallery?.description || "");
      setError("");
      // Focus name input after dialog opens
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [isOpen, gallery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Gallery name is required");
      return;
    }

    onSave({
      name: trimmedName,
      description: description.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="gallery-dialog-title" className="font-semibold text-gray-900">
            {gallery ? "Edit Gallery" : "Create New Gallery"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="gallery-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="gallery-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="My Collection"
                className={`w-full rounded-md border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 ${
                  error
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                }`}
              />
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="gallery-description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="gallery-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this collection about? (optional)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {gallery ? "Save Changes" : "Create Gallery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
