"use client";

import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  AlertCircle,
  X,
  Grid3X3,
  List,
  Compass,
} from "lucide-react";
import { Suspense, useState, useEffect, useCallback } from "react";
import { SearchFilters, ResultCard, Pagination } from "@/components/search";
import { Header, Footer } from "@/components/layout";
import { search as searchApi, SearchResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FilterState, FacetCounts, SortOption } from "@/types";

const PAGE_SIZE = 20;

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse URL params
  const query = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = (searchParams.get("sort") as SortOption) || "relevance";

  // State
  const [searchValue, setSearchValue] = useState(query);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchTime, setSearchTime] = useState<number | null>(null);
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

  // Update URL with search params
  const updateUrl = useCallback(
    (params: {
      q?: string;
      page?: number;
      sort?: SortOption;
      filters?: FilterState;
    }) => {
      const newParams = new URLSearchParams();

      const q = params.q ?? query;
      if (q) newParams.set("q", q);

      const p = params.page ?? page;
      if (p > 1) newParams.set("page", p.toString());

      const s = params.sort ?? sort;
      if (s !== "relevance") newParams.set("sort", s);

      const f = params.filters ?? filters;
      f.media_types?.forEach((t) => newParams.append("media_type", t));
      f.domains?.forEach((d) => newParams.append("domain", d));
      f.missions?.forEach((m) => newParams.append("mission", m));
      if (f.date_from) newParams.set("date_from", f.date_from);
      if (f.date_to) newParams.set("date_to", f.date_to);

      const queryString = newParams.toString();
      router.push(`/search${queryString ? `?${queryString}` : ""}`);
    },
    [query, page, sort, filters, router]
  );

  // Perform search
  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const response = await searchApi({
        q: query,
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
      setSearchTime(Math.round(performance.now() - startTime) / 1000);
    } catch (err) {
      console.error("Search failed:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, sort, page]);

  // Search when params change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Handlers
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      updateUrl({ q: searchValue.trim(), page: 1 });
    }
  };

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

  const handleSortChange = (newSort: SortOption) => {
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
              {/* Search Input */}
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search visualizations..."
                  className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-11 pr-24 text-base shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Search
                </button>
              </form>

              {/* Active Filter Chips */}
              {activeFilterChips.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
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
                </div>
              )}

              {/* Results Header */}
              {query && !error && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-600">
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </span>
                    ) : results ? (
                      <>
                        <span className="font-semibold text-gray-900">
                          {results.count.toLocaleString()}
                        </span>{" "}
                        results found
                        {searchTime && (
                          <span className="text-gray-400">
                            {" "}| Search took {searchTime}s
                          </span>
                        )}
                      </>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500">Sort by:</label>
                      <select
                        value={sort}
                        onChange={(e) => handleSortChange(e.target.value as SortOption)}
                        className="h-9 rounded-md border border-gray-300 bg-white px-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={isLoading}
                      >
                        <option value="relevance">Relevance</option>
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
              )}

              {/* Error State */}
              {error && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">Search Error</p>
                  </div>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                  <button
                    onClick={performSearch}
                    className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="mt-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex gap-4">
                        <div className="h-28 w-44 flex-shrink-0 rounded-lg bg-gray-200" />
                        <div className="flex-1 space-y-3">
                          <div className="flex gap-2">
                            <div className="h-5 w-16 rounded bg-gray-200" />
                            <div className="h-5 w-12 rounded bg-gray-200" />
                          </div>
                          <div className="h-5 w-3/4 rounded bg-gray-200" />
                          <div className="h-4 w-full rounded bg-gray-200" />
                          <div className="h-4 w-2/3 rounded bg-gray-200" />
                        </div>
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
                      "mt-6",
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
                  <Search className="mx-auto h-12 w-12 text-gray-300" />
                  <h2 className="mt-4 text-lg font-medium text-gray-900">
                    No visualizations found
                  </h2>
                  <p className="mt-2 text-gray-500">
                    Try adjusting your filters or search terms.
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

              {/* Empty State (no query) */}
              {!query && (
                <div className="mt-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <Compass className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="mt-4 text-lg font-medium text-gray-900">
                    Search NASA Visualizations
                  </h2>
                  <p className="mt-2 max-w-md mx-auto text-gray-500">
                    Search by keyword, mission name, or SVS ID (e.g., &quot;Mars&quot;, &quot;Hubble&quot;, &quot;SVS-14321&quot;)
                  </p>
                  <p className="mt-4 text-sm text-gray-400">
                    Press{" "}
                    <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                      /
                    </kbd>{" "}
                    to focus search
                  </p>
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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}
