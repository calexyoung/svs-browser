"use client";

import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  X,
  Grid3X3,
  List,
  Library,
} from "lucide-react";
import { Suspense, useState, useEffect, useCallback } from "react";
import { SearchFilters, ResultCard, Pagination } from "@/components/search";
import { Header, Footer } from "@/components/layout";
import { browse as browseApi, SearchResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FilterState, FacetCounts } from "@/types";

const PAGE_SIZE = 20;

type BrowseSortOption = "date_desc" | "date_asc";

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse URL params
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = (searchParams.get("sort") as BrowseSortOption) || "date_desc";

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [filters, setFilters] = useState<FilterState>({
    media_types: searchParams.getAll("media_type") as FilterState["media_types"],
    date_from: searchParams.get("date_from"),
    date_to: searchParams.get("date_to"),
    domains: searchParams.getAll("domain"),
    missions: searchParams.getAll("mission"),
  });

  // Build facets from API response
  const facets: FacetCounts | undefined = results?.facets
    ? {
        media_types: results.facets.media_type || {},
        domains: results.facets.domain || {},
        missions: results.facets.mission || {},
      }
    : undefined;

  // Update URL with params
  const updateUrl = useCallback(
    (params: {
      page?: number;
      sort?: BrowseSortOption;
      filters?: FilterState;
    }) => {
      const newParams = new URLSearchParams();

      const p = params.page ?? page;
      if (p > 1) newParams.set("page", p.toString());

      const s = params.sort ?? sort;
      if (s !== "date_desc") newParams.set("sort", s);

      const f = params.filters ?? filters;
      f.media_types?.forEach((t) => newParams.append("media_type", t));
      f.domains?.forEach((d) => newParams.append("domain", d));
      f.missions?.forEach((m) => newParams.append("mission", m));
      if (f.date_from) newParams.set("date_from", f.date_from);
      if (f.date_to) newParams.set("date_to", f.date_to);

      const queryString = newParams.toString();
      router.push(`/browse${queryString ? `?${queryString}` : ""}`);
    },
    [page, sort, filters, router]
  );

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await browseApi({
        media_types: filters.media_types,
        domains: filters.domains,
        missions: filters.missions,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setResults(response);
    } catch (err) {
      console.error("Browse failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load visualizations");
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [filters, sort, page]);

  // Fetch when params change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    updateUrl({ filters: newFilters, page: 1 });
  };

  const handleClearFilters = () => {
    const emptyFilters: FilterState = {
      media_types: [],
      date_from: null,
      date_to: null,
      domains: [],
      missions: [],
    };
    setFilters(emptyFilters);
    updateUrl({ filters: emptyFilters, page: 1 });
  };

  const handleRemoveFilter = (type: string, value: string) => {
    const newFilters = { ...filters };
    if (type === "media_type") {
      newFilters.media_types = filters.media_types?.filter((t) => t !== value) || [];
    } else if (type === "domain") {
      newFilters.domains = filters.domains?.filter((d) => d !== value) || [];
    } else if (type === "mission") {
      newFilters.missions = filters.missions?.filter((m) => m !== value) || [];
    }
    setFilters(newFilters);
    updateUrl({ filters: newFilters, page: 1 });
  };

  const handleSortChange = (newSort: BrowseSortOption) => {
    updateUrl({ sort: newSort, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    updateUrl({ page: newPage });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAskAI = (svsId: number) => {
    router.push(`/chat?svs=${svsId}`);
  };

  const totalPages = results ? Math.ceil(results.count / PAGE_SIZE) : 0;

  // Collect active filter chips
  const activeFilterChips: { type: string; value: string; label: string }[] = [];
  filters.media_types?.forEach((t) =>
    activeFilterChips.push({ type: "media_type", value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })
  );
  filters.domains?.forEach((d) =>
    activeFilterChips.push({ type: "domain", value: d, label: d })
  );
  filters.missions?.forEach((m) =>
    activeFilterChips.push({ type: "mission", value: m, label: m })
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Library className="h-6 w-6 text-blue-600" />
              Browse Visualizations
            </h1>
            <p className="mt-1 text-gray-600">
              Explore all NASA Scientific Visualization Studio content
            </p>
          </div>

          <div className="flex gap-8">
            {/* Filter Sidebar */}
            <div className="hidden w-60 flex-shrink-0 lg:block">
              <SearchFilters
                filters={filters}
                facets={facets}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
              />
            </div>

            {/* Main Content */}
            <div className="min-w-0 flex-1">
              {/* Active Filter Chips */}
              {activeFilterChips.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {activeFilterChips.map((chip) => (
                    <span
                      key={`${chip.type}-${chip.value}`}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                    >
                      {chip.label}
                      <button
                        onClick={() => handleRemoveFilter(chip.type, chip.value)}
                        className="ml-1 rounded-full p-0.5 hover:bg-blue-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Results Header */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </span>
                  ) : results ? (
                    <>
                      <span className="font-semibold text-gray-900">
                        {results.count.toLocaleString()}
                      </span>{" "}
                      visualizations
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Sort by:</label>
                    <select
                      value={sort}
                      onChange={(e) => handleSortChange(e.target.value as BrowseSortOption)}
                      className="h-9 rounded-md border border-gray-300 bg-white px-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isLoading}
                    >
                      <option value="date_desc">Newest First</option>
                      <option value="date_asc">Oldest First</option>
                    </select>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex rounded-md border border-gray-300 bg-white">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "rounded-l-md p-2",
                        viewMode === "grid"
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-400 hover:text-gray-600"
                      )}
                      title="Grid view"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "rounded-r-md p-2",
                        viewMode === "list"
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-400 hover:text-gray-600"
                      )}
                      title="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error State */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">Error Loading Visualizations</p>
                  </div>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                  <button
                    onClick={fetchData}
                    className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
                      <div className="aspect-video w-full rounded-lg bg-gray-200" />
                      <div className="mt-3 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-gray-200" />
                        <div className="h-3 w-1/2 rounded bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {!isLoading && results && results.results.length > 0 && (
                <>
                  <div
                    className={cn(
                      viewMode === "grid"
                        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        : "space-y-4"
                    )}
                  >
                    {results.results.map((result) => (
                      <ResultCard
                        key={result.svs_id}
                        result={result}
                        onAskAI={handleAskAI}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalResults={results.count}
                    pageSize={PAGE_SIZE}
                    onPageChange={handlePageChange}
                    className="mt-8"
                  />
                </>
              )}

              {/* No Results */}
              {!isLoading && results && results.results.length === 0 && (
                <div className="mt-12 text-center">
                  <Library className="mx-auto h-12 w-12 text-gray-300" />
                  <h2 className="mt-4 text-lg font-medium text-gray-900">
                    No visualizations found
                  </h2>
                  <p className="mt-2 text-gray-500">
                    Try adjusting your filters to see more results.
                  </p>
                  {activeFilterChips.length > 0 && (
                    <button
                      onClick={handleClearFilters}
                      className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
