"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalResults,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = 5; // Number of page buttons to show

    if (totalPages <= showPages + 2) {
      // Show all pages if not many
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if at edges
      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      // Add ellipsis if needed
      if (start > 2) {
        pages.push("ellipsis");
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={cn("flex items-center justify-between", className)}
      aria-label="Pagination"
    >
      {/* Results info */}
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium">{startResult}</span> to{" "}
        <span className="font-medium">{endResult}</span> of{" "}
        <span className="font-medium">{totalResults.toLocaleString()}</span>{" "}
        results
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "rounded-md p-2",
            currentPage === 1
              ? "cursor-not-allowed text-gray-300"
              : "text-gray-600 hover:bg-gray-100"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-gray-400"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  "min-w-[2.5rem] rounded-md px-3 py-2 text-sm font-medium",
                  page === currentPage
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "rounded-md p-2",
            currentPage === totalPages
              ? "cursor-not-allowed text-gray-300"
              : "text-gray-600 hover:bg-gray-100"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
