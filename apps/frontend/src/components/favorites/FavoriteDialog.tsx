"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { X, Plus, Tag } from "lucide-react";
import { useFavorites, useIsFavorite } from "@/hooks";
import type { LocalFavorite } from "@/types/favorites";

interface FavoriteDialogProps {
  svsId: number;
  title: string;
  thumbnailUrl?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FavoriteDialog({
  svsId,
  title,
  thumbnailUrl,
  isOpen,
  onClose,
}: FavoriteDialogProps) {
  const { favorite } = useIsFavorite(svsId);
  const { addFavorite, updateFavorite, getAllTags } = useFavorites();
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Get all existing tags for autocomplete
  const allTags = getAllTags();
  const suggestions = allTags.filter(
    (t) =>
      t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
  );

  // Initialize state from existing favorite
  useEffect(() => {
    if (isOpen) {
      setNotes(favorite?.notes || "");
      setTags(favorite?.tags || []);
      setTagInput("");
    }
  }, [isOpen, favorite]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag]);
    }
    setTagInput("");
    setShowSuggestions(false);
    tagInputRef.current?.focus();
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  const handleSave = () => {
    if (favorite) {
      // Update existing favorite
      updateFavorite(svsId, { notes, tags });
    } else {
      // Add new favorite with notes and tags
      addFavorite({
        svs_id: svsId,
        title,
        thumbnail_url: thumbnailUrl,
        notes,
        tags,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorite-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="favorite-dialog-title" className="font-semibold text-gray-900">
            {favorite ? "Edit Favorite" : "Add to Favorites"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Page info */}
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            {thumbnailUrl && (
              <Image
                src={thumbnailUrl}
                alt=""
                width={64}
                height={48}
                className="rounded object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="font-mono text-xs text-gray-500">SVS-{svsId}</p>
              <p className="truncate font-medium text-gray-900">{title}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label
              htmlFor="favorite-notes"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Notes
            </label>
            <textarea
              id="favorite-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add personal notes about this page..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tags
            </label>
            <div className="relative">
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 p-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-sm text-blue-700"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={tags.length === 0 ? "Add tags..." : ""}
                  className="min-w-[100px] flex-1 border-none p-0 text-sm focus:outline-none focus:ring-0"
                />
              </div>

              {/* Tag suggestions */}
              {showSuggestions && suggestions.length > 0 && tagInput && (
                <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {suggestions.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddTag(suggestion);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
                    >
                      <Tag className="h-3 w-3 text-gray-400" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Press Enter or comma to add a tag
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
