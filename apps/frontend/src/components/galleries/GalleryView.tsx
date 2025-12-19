"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  GripVertical,
  ImageIcon,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useGallery } from "@/hooks";
import { GalleryDialog } from "./GalleryDialog";
import type { GalleryItem, GalleryInput } from "@/types/favorites";

interface GalleryViewProps {
  galleryId: string;
  onDelete?: () => void;
}

export function GalleryView({ galleryId, onDelete }: GalleryViewProps) {
  const { gallery, items, removeItem, reorderItems, update } =
    useGallery(galleryId);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedItem, setDraggedItem] = useState<GalleryItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!gallery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-600">Gallery not found.</p>
        <Link
          href="/galleries"
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to galleries
        </Link>
      </div>
    );
  }

  const handleUpdateGallery = (input: GalleryInput) => {
    update(input);
    setIsEditing(false);
  };

  const handleRemoveItem = (svsId: number) => {
    if (confirm("Remove this item from the gallery?")) {
      removeItem(svsId);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: GalleryItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(item.svs_id));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (!draggedItem) return;

    const currentIndex = items.findIndex(
      (item) => item.svs_id === draggedItem.svs_id
    );
    if (currentIndex === targetIndex) return;

    // Reorder items
    const newOrder = [...items];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    reorderItems(newOrder.map((item) => item.svs_id));

    setDraggedItem(null);
    setDragOverIndex(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/galleries"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All galleries
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{gallery.name}</h1>
          {gallery.description && (
            <p className="mt-1 text-gray-600">{gallery.description}</p>
          )}
          <p className="mt-2 text-sm text-gray-500">
            {items.length} {items.length === 1 ? "item" : "items"} · Updated{" "}
            {formatDate(gallery.updated_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          {onDelete && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete gallery "${gallery.name}"? This cannot be undone.`
                  )
                ) {
                  onDelete();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="mb-4 h-16 w-16 text-gray-300" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            This gallery is empty
          </h2>
          <p className="mb-6 max-w-md text-gray-600">
            Start adding pages to this gallery from the search results or page
            details.
          </p>
          <Link
            href="/search"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Browse Archive
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.svs_id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-white transition-shadow",
                draggedItem?.svs_id === item.svs_id
                  ? "border-blue-500 opacity-50"
                  : "border-gray-200 hover:shadow-md",
                dragOverIndex === index &&
                  draggedItem?.svs_id !== item.svs_id &&
                  "ring-2 ring-blue-500"
              )}
            >
              {/* Drag handle */}
              <div className="absolute left-2 top-2 z-10 cursor-grab rounded bg-white/80 p-1 opacity-0 shadow backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <GripVertical className="h-4 w-4 text-gray-600" />
              </div>

              {/* Remove button */}
              <button
                onClick={() => handleRemoveItem(item.svs_id)}
                className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-1 opacity-0 shadow backdrop-blur-sm transition-opacity hover:bg-red-100 group-hover:opacity-100"
                title="Remove from gallery"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>

              <Link href={`/svs/${item.svs_id}`} className="block">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100">
                  {item.thumbnail_url ? (
                    <Image
                      src={item.thumbnail_url}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <span className="font-mono text-xs text-gray-500">
                    SVS-{item.svs_id}
                  </span>
                  <h3 className="line-clamp-2 font-medium text-gray-900 group-hover:text-blue-600">
                    {item.title}
                  </h3>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <GalleryDialog
        gallery={gallery}
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        onSave={handleUpdateGallery}
      />
    </div>
  );
}
