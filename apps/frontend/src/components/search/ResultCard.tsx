"use client";

import Link from "next/link";
import {
  ExternalLink,
  MessageSquare,
  Link2,
  Share2,
  Play,
  ImageIcon,
  Database,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { getThumbnailUrl, type SearchResult } from "@/lib/api";
import { FavoriteButton } from "@/components/favorites";
import { AddToGalleryMenu } from "@/components/galleries";

interface ResultCardProps {
  result: SearchResult;
  onAskAI?: (svsId: number) => void;
  viewMode?: "list" | "grid";
  className?: string;
}

// Media type badge configurations
const mediaTypeBadges: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  video: { label: "Video", color: "bg-blue-100 text-blue-700", icon: Play },
  image: { label: "Image", color: "bg-green-100 text-green-700", icon: ImageIcon },
  data: { label: "Data", color: "bg-purple-100 text-purple-700", icon: Database },
  "4k": { label: "4K", color: "bg-amber-100 text-amber-700", icon: FileText },
  "8k": { label: "8K", color: "bg-red-100 text-red-700", icon: FileText },
};

export function ResultCard({
  result,
  onAskAI,
  viewMode = "list",
  className,
}: ResultCardProps) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(result.canonical_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.share) {
      await navigator.share({
        title: result.title,
        url: result.canonical_url,
      });
    } else {
      handleCopyLink(e);
    }
  };

  const handleAskAI = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAskAI?.(result.svs_id);
  };

  if (viewMode === "grid") {
    return (
      <div
        className={cn(
          "group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md",
          className
        )}
      >
        {/* Thumbnail */}
        <Link
          href={`/svs/${result.svs_id}`}
          className="relative block aspect-video overflow-hidden bg-gray-100"
        >
          {result.thumbnail_url && !imageError ? (
            <img
              src={getThumbnailUrl(result.thumbnail_url) || ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-gray-300" />
            </div>
          )}
          {/* Action buttons overlay */}
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <FavoriteButton
              svsId={result.svs_id}
              title={result.title}
              thumbnailUrl={result.thumbnail_url}
              size="sm"
              className="bg-white/90 shadow backdrop-blur-sm"
            />
            <AddToGalleryMenu
              svsId={result.svs_id}
              title={result.title}
              thumbnailUrl={result.thumbnail_url}
              size="sm"
              className="bg-white/90 shadow backdrop-blur-sm"
            />
          </div>
        </Link>

        {/* Content */}
        <Link href={`/svs/${result.svs_id}`} className="block p-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-blue-600">SVS-{result.svs_id}</span>
            {result.media_types.slice(0, 2).map((type) => {
              const badge = mediaTypeBadges[type];
              return badge ? (
                <span
                  key={type}
                  className={cn("rounded px-1.5 py-0.5 text-xs font-medium", badge.color)}
                >
                  {badge.label}
                </span>
              ) : null;
            })}
          </div>
          <h3 className="mt-1 line-clamp-2 font-semibold text-gray-900 group-hover:text-blue-600">
            {result.title}
          </h3>
        </Link>
      </div>
    );
  }

  // List view (default)
  return (
    <article
      className={cn(
        "group flex gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Thumbnail */}
      <Link
        href={`/svs/${result.svs_id}`}
        className="relative h-28 w-44 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
      >
        {result.thumbnail_url && !imageError ? (
          <img
            src={getThumbnailUrl(result.thumbnail_url) || ""}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-gray-300" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* SVS ID and Media Type Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-gray-500">SVS-{result.svs_id}</span>
          {result.media_types.map((type) => {
            const badge = mediaTypeBadges[type];
            return badge ? (
              <span
                key={type}
                className={cn("rounded px-2 py-0.5 text-xs font-medium", badge.color)}
              >
                {badge.label}
              </span>
            ) : null;
          })}
        </div>

        {/* Title */}
        <Link href={`/svs/${result.svs_id}`}>
          <h3 className="mt-1 font-semibold text-gray-900 hover:text-blue-600">
            {result.title}
          </h3>
        </Link>

        {/* Snippet */}
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{result.snippet}</p>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {result.tags.slice(0, 5).map((tag) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(tag)}`}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
            >
              {tag}
            </Link>
          ))}
          {result.tags.length > 5 && (
            <span className="text-xs text-gray-400">+{result.tags.length - 5}</span>
          )}
        </div>

        {/* Bottom row: Date and Actions */}
        <div className="mt-3 flex items-center justify-between">
          {result.published_date && (
            <time
              dateTime={result.published_date}
              className="text-sm text-gray-500"
            >
              {formatDate(result.published_date)}
            </time>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <FavoriteButton
              svsId={result.svs_id}
              title={result.title}
              thumbnailUrl={result.thumbnail_url}
              size="sm"
            />
            <AddToGalleryMenu
              svsId={result.svs_id}
              title={result.title}
              thumbnailUrl={result.thumbnail_url}
              size="sm"
            />
            {onAskAI && (
              <button
                onClick={handleAskAI}
                className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                title="Ask AI about this"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={copied ? "Copied!" : "Copy link"}
            >
              <Link2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleShare}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <a
              href={result.canonical_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Open on NASA SVS"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
