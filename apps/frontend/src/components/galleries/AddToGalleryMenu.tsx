"use client";

import { useState, useRef, useEffect } from "react";
import { FolderPlus, Plus, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGalleries } from "@/hooks";
import { GalleryDialog } from "./GalleryDialog";
import type { GalleryInput, GalleryItemInput } from "@/types/favorites";

interface AddToGalleryMenuProps {
  svsId: number;
  title: string;
  thumbnailUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
}

const buttonSizeClasses = {
  sm: "p-1",
  md: "p-1.5",
};

const iconSizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

export function AddToGalleryMenu({
  svsId,
  title,
  thumbnailUrl,
  size = "md",
  className,
}: AddToGalleryMenuProps) {
  const {
    galleriesArray,
    createGallery,
    addToGallery,
    removeFromGallery,
    isInGallery,
  } = useGalleries();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleToggleGallery = (galleryId: string) => {
    const input: GalleryItemInput = {
      svs_id: svsId,
      title,
      thumbnail_url: thumbnailUrl,
    };

    if (isInGallery(galleryId, svsId)) {
      removeFromGallery(galleryId, svsId);
    } else {
      addToGallery(galleryId, input);
    }
  };

  const handleCreateGallery = (input: GalleryInput) => {
    const gallery = createGallery(input);
    // Add item to the new gallery
    addToGallery(gallery.id, {
      svs_id: svsId,
      title,
      thumbnail_url: thumbnailUrl,
    });
    setIsCreating(false);
    setIsOpen(false);
  };

  // Count how many galleries this item is in
  const inGalleryCount = galleriesArray.filter((g) =>
    g.items.some((item) => item.svs_id === svsId)
  ).length;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={handleToggleMenu}
        className={cn(
          "inline-flex items-center gap-1 rounded-md transition-colors",
          buttonSizeClasses[size],
          inGalleryCount > 0
            ? "text-blue-600 hover:bg-blue-50"
            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
          className
        )}
        title={
          inGalleryCount > 0
            ? `In ${inGalleryCount} ${inGalleryCount === 1 ? "gallery" : "galleries"}`
            : "Add to gallery"
        }
        aria-label="Add to gallery"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FolderPlus className={iconSizeClasses[size]} />
        {size === "md" && <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {/* Header */}
          <div className="border-b px-3 py-2">
            <p className="text-sm font-medium text-gray-900">Add to gallery</p>
          </div>

          {/* Gallery list */}
          <div className="max-h-64 overflow-y-auto">
            {galleriesArray.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-500">
                No galleries yet
              </p>
            ) : (
              galleriesArray.map((gallery) => {
                const isIn = isInGallery(gallery.id, svsId);
                return (
                  <button
                    key={gallery.id}
                    onClick={() => handleToggleGallery(gallery.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border",
                        isIn
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300"
                      )}
                    >
                      {isIn && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {gallery.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {gallery.items.length}{" "}
                        {gallery.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Create new gallery */}
          <div className="border-t">
            <button
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Create new gallery</span>
            </button>
          </div>
        </div>
      )}

      {/* Create gallery dialog */}
      <GalleryDialog
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSave={handleCreateGallery}
      />
    </div>
  );
}
