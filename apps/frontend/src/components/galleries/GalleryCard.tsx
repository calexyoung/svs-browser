"use client";

import Link from "next/link";
import Image from "next/image";
import { FolderOpen, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { LocalGallery } from "@/types/favorites";

interface GalleryCardProps {
  gallery: LocalGallery;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function GalleryCard({
  gallery,
  onEdit,
  onDelete,
  className,
}: GalleryCardProps) {
  // Get first 4 thumbnails for preview grid
  const previewItems = gallery.items.slice(0, 4);
  const hasMore = gallery.items.length > 4;

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete gallery "${gallery.name}"? This cannot be undone.`)) {
      onDelete?.();
    }
  };

  return (
    <Link
      href={`/galleries/${gallery.id}`}
      className={cn(
        "group block overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Thumbnail grid */}
      <div className="relative aspect-[4/3] bg-gray-100">
        {previewItems.length > 0 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
            {previewItems.map((item, index) => (
              <div key={item.svs_id} className="relative overflow-hidden">
                {item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-200">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
            {/* Fill empty slots */}
            {[...Array(4 - previewItems.length)].map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center bg-gray-200"
              >
                <ImageIcon className="h-6 w-6 text-gray-300" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <FolderOpen className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Item count badge */}
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          {gallery.items.length} {gallery.items.length === 1 ? "item" : "items"}
        </div>

        {/* Action buttons (show on hover) */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="rounded-md bg-white p-1.5 shadow-md hover:bg-gray-100"
              title="Edit gallery"
            >
              <Pencil className="h-4 w-4 text-gray-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="rounded-md bg-white p-1.5 shadow-md hover:bg-red-50"
              title="Delete gallery"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
          {gallery.name}
        </h3>
        {gallery.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {gallery.description}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Updated {formatDate(gallery.updated_at)}
        </p>
      </div>
    </Link>
  );
}
