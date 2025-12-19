"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { useGalleries } from "@/hooks";
import { GalleryCard } from "./GalleryCard";
import { GalleryDialog } from "./GalleryDialog";
import type { GalleryInput, LocalGallery } from "@/types/favorites";

export function GalleriesList() {
  const { galleriesArray, createGallery, updateGallery, deleteGallery } =
    useGalleries();
  const [isCreating, setIsCreating] = useState(false);
  const [editingGallery, setEditingGallery] = useState<LocalGallery | null>(
    null
  );

  const handleCreateGallery = (input: GalleryInput) => {
    createGallery(input);
    setIsCreating(false);
  };

  const handleUpdateGallery = (input: GalleryInput) => {
    if (editingGallery) {
      updateGallery(editingGallery.id, input);
      setEditingGallery(null);
    }
  };

  if (galleriesArray.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="mb-4 h-16 w-16 text-gray-300" />
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          No galleries yet
        </h2>
        <p className="mb-6 max-w-md text-gray-600">
          Create galleries to organize and collect your favorite SVS pages into
          themed collections.
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Create Gallery
        </button>

        <GalleryDialog
          isOpen={isCreating}
          onClose={() => setIsCreating(false)}
          onSave={handleCreateGallery}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header with create button */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {galleriesArray.length}{" "}
          {galleriesArray.length === 1 ? "gallery" : "galleries"}
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Gallery
        </button>
      </div>

      {/* Gallery grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {galleriesArray.map((gallery) => (
          <GalleryCard
            key={gallery.id}
            gallery={gallery}
            onEdit={() => setEditingGallery(gallery)}
            onDelete={() => deleteGallery(gallery.id)}
          />
        ))}
      </div>

      {/* Create dialog */}
      <GalleryDialog
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSave={handleCreateGallery}
      />

      {/* Edit dialog */}
      <GalleryDialog
        gallery={editingGallery}
        isOpen={!!editingGallery}
        onClose={() => setEditingGallery(null)}
        onSave={handleUpdateGallery}
      />
    </div>
  );
}
