"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import {
  Play,
  ImageIcon,
  Database,
  Download,
  ChevronDown,
  FileVideo,
  FileImage,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetFile {
  variant: string;
  url: string;
  mime_type: string | null;
}

interface Asset {
  asset_id: string;
  title: string | null;
  type: string;
  files: AssetFile[];
  thumbnail_url: string | null;
}

interface AssetGalleryProps {
  assets: Asset[];
  className?: string;
}

// File variant labels and order
const variantConfig: Record<string, { label: string; order: number }> = {
  original: { label: "Original", order: 1 },
  hires: { label: "High Resolution", order: 2 },
  "4k": { label: "4K", order: 3 },
  "1080p": { label: "1080p HD", order: 4 },
  "720p": { label: "720p", order: 5 },
  lores: { label: "Low Resolution", order: 6 },
  preview: { label: "Preview", order: 7 },
  print: { label: "Print Quality", order: 8 },
  web: { label: "Web Size", order: 9 },
  thumbnail: { label: "Thumbnail", order: 10 },
  caption: { label: "Caption", order: 11 },
  transcript: { label: "Transcript", order: 12 },
};

function getFileLabel(variant: string): string {
  return variantConfig[variant.toLowerCase()]?.label || variant;
}

function getFileIcon(mimeType: string | null, variant: string) {
  if (mimeType?.startsWith("video/") || variant.includes("mp4") || variant.includes("mov")) {
    return FileVideo;
  }
  if (mimeType?.startsWith("image/") || variant.includes("jpg") || variant.includes("png")) {
    return FileImage;
  }
  return FileText;
}

function sortFiles(files: AssetFile[]): AssetFile[] {
  return [...files].sort((a, b) => {
    const orderA = variantConfig[a.variant.toLowerCase()]?.order || 99;
    const orderB = variantConfig[b.variant.toLowerCase()]?.order || 99;
    return orderA - orderB;
  });
}

// Dropdown component for file downloads
function DownloadDropdown({ files, assetTitle }: { files: AssetFile[]; assetTitle: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedFiles = sortFiles(files.filter(f => f.variant !== "thumbnail"));

  if (sortedFiles.length === 0) return null;

  if (sortedFiles.length === 1) {
    const file = sortedFiles[0];
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Download className="h-4 w-4" />
        Download
      </a>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        aria-label={`Download options for ${assetTitle}`}
        aria-expanded={isOpen}
      >
        <Download className="h-4 w-4" />
        Download
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Available Formats
            </div>
            {sortedFiles.map((file) => {
              const Icon = getFileIcon(file.mime_type, file.variant);
              return (
                <a
                  key={file.variant}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="h-4 w-4 text-gray-400" />
                  <span className="flex-1">{getFileLabel(file.variant)}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual Asset Card
function AssetCard({
  asset,
  onImageClick,
}: {
  asset: Asset;
  onImageClick?: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const isVideo = asset.type === "video";
  const isImage = asset.type === "image";

  // Get video URL for playback
  const videoUrl = isVideo
    ? asset.files.find(f => f.variant === "preview" || f.variant === "lores" || f.mime_type?.startsWith("video/"))?.url
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Thumbnail / Media Preview */}
      <div className="relative aspect-video bg-gray-900">
        {isVideo && videoUrl ? (
          <video
            src={videoUrl}
            controls
            poster={asset.thumbnail_url || undefined}
            className="h-full w-full object-contain"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        ) : asset.thumbnail_url && !imageError ? (
          <div
            className={cn("relative h-full w-full", isImage && onImageClick && "cursor-pointer group")}
            onClick={onImageClick}
          >
            <Image
              src={asset.thumbnail_url}
              alt={asset.title || "Asset"}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              onError={() => setImageError(true)}
            />
            {isImage && onImageClick && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <Maximize2 className="h-10 w-10 text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            {isVideo ? (
              <Play className="h-16 w-16 text-gray-600" />
            ) : (
              <ImageIcon className="h-16 w-16 text-gray-600" />
            )}
          </div>
        )}
      </div>

      {/* Asset Info & Downloads */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {asset.title && (
              <h4 className="font-medium text-gray-900 line-clamp-2">{asset.title}</h4>
            )}
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              {isVideo ? (
                <span className="inline-flex items-center gap-1">
                  <Play className="h-3.5 w-3.5" />
                  Video
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Image
                </span>
              )}
              <span>&middot;</span>
              <span>{asset.files.filter(f => f.variant !== "thumbnail").length} formats</span>
            </div>
          </div>
          <DownloadDropdown files={asset.files} assetTitle={asset.title || "Asset"} />
        </div>
      </div>
    </div>
  );
}

export function AssetGallery({ assets, className }: AssetGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Separate assets by type
  const mediaAssets = assets.filter(a => a.type === "video" || a.type === "image");
  const dataAssets = assets.filter(a => a.type === "data" || a.type === "document");
  const imageAssets = assets.filter(a => a.type === "image");

  const openLightbox = (assetId: string) => {
    const index = imageAssets.findIndex(a => a.asset_id === assetId);
    if (index >= 0) setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxIndex(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft" && lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
    if (e.key === "ArrowRight" && lightboxIndex !== null && lightboxIndex < imageAssets.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Media Assets (Videos & Images) */}
      {mediaAssets.length > 0 && (
        <div className="space-y-4">
          {mediaAssets.map((asset) => (
            <AssetCard
              key={asset.asset_id}
              asset={asset}
              onImageClick={asset.type === "image" ? () => openLightbox(asset.asset_id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Data Files */}
      {dataAssets.length > 0 && (
        <section>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Database className="h-5 w-5" />
            Data Files ({dataAssets.length})
          </h3>
          <div className="space-y-3">
            {dataAssets.map((asset) => (
              <div
                key={asset.asset_id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <Database className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{asset.title || "Data file"}</p>
                    <p className="text-sm text-gray-500">
                      {asset.files.length} file{asset.files.length !== 1 ? "s" : ""} available
                    </p>
                  </div>
                </div>
                <DownloadDropdown files={asset.files} assetTitle={asset.title || "Data"} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No media assets available</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && imageAssets[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Navigation */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {lightboxIndex < imageAssets.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Image */}
          <div className="max-h-[90vh] max-w-[90vw] p-4" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const asset = imageAssets[lightboxIndex];
              const hiresFile = asset.files.find(f => f.variant === "hires" || f.variant === "original");
              const imageUrl = hiresFile?.url || asset.thumbnail_url;

              return imageUrl ? (
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={asset.title || "Image"}
                    className="max-h-[75vh] max-w-full object-contain"
                  />
                  <div className="mt-4 flex items-center gap-4">
                    {asset.title && (
                      <p className="text-lg font-medium text-white">{asset.title}</p>
                    )}
                    <span className="text-gray-400">
                      {lightboxIndex + 1} of {imageAssets.length}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sortFiles(asset.files.filter(f => f.variant !== "thumbnail")).map((file) => (
                      <a
                        key={file.variant}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                      >
                        <Download className="h-4 w-4" />
                        {getFileLabel(file.variant)}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-gray-800">
                  <ImageIcon className="h-16 w-16 text-gray-600" />
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
