"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Video,
  ImageIcon,
  Database,
  Clock,
  MessageSquare,
  Compass,
  Hash,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Footer } from "@/components/layout";
import { cn } from "@/lib/utils";
import { API_BASE_URL, getThumbnailUrl } from "@/lib/api";

// Filter chip type for hero section
interface FilterChip {
  label: string;
  icon: React.ElementType;
  param: string;
  value: string;
}

// Type for recent highlights from API
interface RecentHighlight {
  svs_id: number;
  title: string;
  snippet: string;
  published_date: string | null;
  thumbnail_url: string | null;
  media_types: string[];
  tags: string[];
  score: number;
}

const filterChips: FilterChip[] = [
  { label: "Videos", icon: Video, param: "media_type", value: "video" },
  { label: "Images", icon: ImageIcon, param: "media_type", value: "image" },
  { label: "Data", icon: Database, param: "media_type", value: "data" },
  { label: "Recently Released", icon: Clock, param: "sort", value: "date_desc" },
];

// Gradient colors for cards without thumbnails
const gradientColors = [
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-orange-500 to-red-600",
  "from-green-500 to-teal-600",
  "from-amber-500 to-yellow-600",
  "from-cyan-500 to-blue-600",
];

// Quick Access cards
const quickAccessCards = [
  {
    title: "Ask Questions",
    description: "Get answers about visualizations with grounded citations",
    icon: MessageSquare,
    href: "/chat",
    linkText: "Start Chat",
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Browse by Mission",
    description: "Explore visualizations organized by NASA missions",
    icon: Compass,
    href: "/browse",
    linkText: "Browse",
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Direct SVS Access",
    description: "Enter an SVS ID for direct page access",
    icon: Hash,
    href: "/search",
    linkText: "Go to ID",
    color: "bg-purple-50 text-purple-600",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [recentHighlights, setRecentHighlights] = useState<RecentHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const indexedCount = 10305; // Will be fetched from API in production

  // Fetch recent highlights on mount
  useEffect(() => {
    async function fetchRecentHighlights() {
      try {
        const response = await fetch(`${API_BASE_URL}/pages/recent?limit=6`);
        if (response.ok) {
          const data = await response.json();
          setRecentHighlights(data);
        }
      } catch (error) {
        console.error("Failed to fetch recent highlights:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRecentHighlights();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      const params = new URLSearchParams();
      params.set("q", searchValue.trim());
      activeFilters.forEach((filter) => {
        const chip = filterChips.find((c) => c.label === filter);
        if (chip) {
          params.set(chip.param, chip.value);
        }
      });
      router.push(`/search?${params.toString()}`);
    }
  };

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((f) => f !== label) : [...prev, label]
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:pt-20">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
              Explore NASA&apos;s Scientific Visualizations
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">
              Search by keywords, mission, target (Mars), event (eclipse), or SVS ID to find and understand scientific visualizations
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-8 sm:mt-10">
            <div className="relative">
              <input
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search for visualizations, missions, or enter SVS ID..."
                className="h-14 w-full rounded-xl border border-gray-300 bg-white pl-12 pr-28 text-base shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:h-16 sm:text-lg"
              />
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-6 sm:py-3"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>

          {/* Filter Chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-6">
            {filterChips.map((chip) => {
              const Icon = chip.icon;
              const isActive = activeFilters.includes(chip.label);
              return (
                <button
                  key={chip.label}
                  onClick={() => toggleFilter(chip.label)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Highlights */}
        <section className="border-t border-gray-100 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Recent Highlights</h2>
              <Link
                href="/search?sort=date_desc"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                // Loading skeleton
                [...Array(3)].map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm animate-pulse">
                    <div className="aspect-video bg-gray-200" />
                    <div className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-full" />
                    </div>
                  </div>
                ))
              ) : (
                recentHighlights.map((item, index) => (
                  <Link
                    key={item.svs_id}
                    href={`/svs/${item.svs_id}`}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden bg-gray-100">
                      {item.thumbnail_url ? (
                        <img
                          src={getThumbnailUrl(item.thumbnail_url) || ""}
                          alt={item.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className={cn(
                          "flex h-full items-center justify-center bg-gradient-to-br",
                          gradientColors[index % gradientColors.length]
                        )}>
                          <Compass className="h-12 w-12 text-white/50" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-mono text-blue-600">SVS-{item.svs_id}</span>
                        <span>{item.published_date ? new Date(item.published_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                      </div>
                      <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.snippet}</p>

                      {/* Tags - show media types and first 2 tags */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1.5">
                          {item.media_types.slice(0, 1).map((type) => (
                            <span
                              key={type}
                              className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 capitalize"
                            >
                              {type}
                            </span>
                          ))}
                          {item.tags.slice(0, 1).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="flex items-center gap-1 text-sm font-medium text-blue-600">
                          View
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Quick Access */}
        <section className="bg-gray-50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Quick Access</h2>

            <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
              {quickAccessCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg",
                        card.color
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-semibold text-gray-900">{card.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:text-blue-700">
                      {card.linkText}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer indexedCount={indexedCount} lastUpdated="December 15, 2024" />
    </div>
  );
}
