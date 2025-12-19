"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Citation {
  svs_id: number;
  title: string;
  chunk_id: string;
  section: string;
  anchor: string;
  excerpt: string;
}

interface CitationBadgeProps {
  citation: Citation;
  index: number;
}

export function CitationBadge({ citation, index }: CitationBadgeProps) {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        className={cn(
          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium",
          "bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors",
          "cursor-pointer"
        )}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
        onClick={() => setShowPopover(!showPopover)}
      >
        <FileText className="h-3 w-3" />
        SVS-{citation.svs_id}
      </button>

      {/* Popover */}
      {showPopover && (
        <div
          className={cn(
            "absolute z-50 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg",
            "left-0 top-full mt-1",
            "animate-in fade-in-0 zoom-in-95"
          )}
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                {citation.title}
              </h4>
              <Link
                href={`/svs/${citation.svs_id}`}
                className="flex-shrink-0 text-blue-600 hover:text-blue-700"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono">SVS-{citation.svs_id}</span>
              <span className="px-1.5 py-0.5 bg-gray-100 rounded capitalize">
                {citation.section}
              </span>
            </div>

            <p className="text-xs text-gray-600 line-clamp-3">
              {citation.excerpt}
            </p>

            <Link
              href={`/svs/${citation.svs_id}`}
              className="block text-xs text-blue-600 hover:text-blue-700 hover:underline"
            >
              View full page
            </Link>
          </div>
        </div>
      )}
    </span>
  );
}

interface CitationListProps {
  citations: Citation[];
}

export function CitationList({ citations }: CitationListProps) {
  if (!citations.length) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <h4 className="text-xs font-medium text-gray-500 mb-2">Sources</h4>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((citation, index) => (
          <CitationBadge key={citation.svs_id} citation={citation} index={index} />
        ))}
      </div>
    </div>
  );
}
