"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Tag, Pencil, Trash2, ImageIcon, Search } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useFavorites } from "@/hooks";
import { FavoriteDialog } from "./FavoriteDialog";
import type { LocalFavorite } from "@/types/favorites";

type SortOption = "newest" | "oldest" | "title" | "updated";

export function FavoritesList() {
  const { favoritesArray, removeFavorite, getAllTags } = useFavorites();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [editingFavorite, setEditingFavorite] = useState<LocalFavorite | null>(
    null
  );

  const allTags = getAllTags();

  // Filter and sort favorites
  const filteredFavorites = useMemo(() => {
    let results = favoritesArray;

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      results = results.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.notes.toLowerCase().includes(query) ||
          f.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Filter by tag
    if (selectedTag) {
      results = results.filter((f) => f.tags.includes(selectedTag));
    }

    // Sort
    switch (sortBy) {
      case "newest":
        results.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        results.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "title":
        results.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "updated":
        results.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        break;
    }

    return results;
  }, [favoritesArray, search, selectedTag, sortBy]);

  const handleRemove = (svsId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Remove this page from your favorites?")) {
      removeFavorite(svsId);
    }
  };

  if (favoritesArray.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Heart className="mb-4 h-16 w-16 text-gray-300" />
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          No favorites yet
        </h2>
        <p className="mb-6 max-w-md text-gray-600">
          Start exploring the SVS archive and click the heart icon on any page
          to add it to your favorites.
        </p>
        <Link
          href="/search"
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Browse Archive
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        {/* Search and Sort */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search favorites..."
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sort-by" className="text-sm text-gray-600">
              Sort by:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="updated">Recently updated</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Filter by tag:</span>
            <button
              onClick={() => setSelectedTag(null)}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition-colors",
                selectedTag === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              All ({favoritesArray.length})
            </button>
            {allTags.map((tag) => {
              const count = favoritesArray.filter((f) =>
                f.tags.includes(tag)
              ).length;
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTag(selectedTag === tag ? null : tag)
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors",
                    selectedTag === tag
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Tag className="h-3 w-3" />
                  {tag} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-gray-600">
        {filteredFavorites.length} of {favoritesArray.length} favorites
        {selectedTag && ` tagged "${selectedTag}"`}
        {search && ` matching "${search}"`}
      </p>

      {/* Favorites list */}
      <div className="space-y-4">
        {filteredFavorites.map((favorite) => (
          <article
            key={favorite.svs_id}
            className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            {/* Thumbnail */}
            <Link
              href={`/svs/${favorite.svs_id}`}
              className="relative h-24 w-36 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
            >
              {favorite.thumbnail_url ? (
                <Image
                  src={favorite.thumbnail_url}
                  alt=""
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-gray-300" />
                </div>
              )}
            </Link>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-sm text-gray-500">
                    SVS-{favorite.svs_id}
                  </span>
                  <Link href={`/svs/${favorite.svs_id}`}>
                    <h3 className="font-semibold text-gray-900 hover:text-blue-600">
                      {favorite.title}
                    </h3>
                  </Link>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingFavorite(favorite)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit notes and tags"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => handleRemove(favorite.svs_id, e)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove from favorites"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notes */}
              {favorite.notes && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                  {favorite.notes}
                </p>
              )}

              {/* Tags and date */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {favorite.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </button>
                ))}
                <span className="text-xs text-gray-400">
                  Added {formatDate(favorite.created_at)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredFavorites.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">
            No favorites match your search or filter.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setSelectedTag(null);
            }}
            className="mt-2 text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Edit dialog */}
      {editingFavorite && (
        <FavoriteDialog
          svsId={editingFavorite.svs_id}
          title={editingFavorite.title}
          thumbnailUrl={editingFavorite.thumbnail_url}
          isOpen={true}
          onClose={() => setEditingFavorite(null)}
        />
      )}
    </div>
  );
}
