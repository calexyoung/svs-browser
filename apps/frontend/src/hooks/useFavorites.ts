"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import type { LocalFavorite, FavoriteInput } from "@/types/favorites";
import * as storage from "@/services/localStorage";

// Storage event listener for cross-tab synchronization
const FAVORITES_KEY = "svs-favorites";
let listeners: Set<() => void> = new Set();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Listen for storage events from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === FAVORITES_KEY) {
      listeners.forEach((listener) => listener());
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): Record<number, LocalFavorite> {
  return storage.getFavorites();
}

function getServerSnapshot(): Record<number, LocalFavorite> {
  return {};
}

/**
 * Hook to manage favorites with localStorage persistence.
 * Automatically syncs across tabs and components.
 */
export function useFavorites() {
  const favorites = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const addFavorite = useCallback((input: FavoriteInput): LocalFavorite => {
    const result = storage.addFavorite(input);
    notifyListeners();
    return result;
  }, []);

  const updateFavorite = useCallback(
    (
      svsId: number,
      updates: { notes?: string; tags?: string[] }
    ): LocalFavorite | null => {
      const result = storage.updateFavorite(svsId, updates);
      notifyListeners();
      return result;
    },
    []
  );

  const removeFavorite = useCallback((svsId: number): boolean => {
    const result = storage.removeFavorite(svsId);
    notifyListeners();
    return result;
  }, []);

  const toggleFavorite = useCallback(
    (input: FavoriteInput): boolean => {
      const isFavorited = storage.isFavorite(input.svs_id);
      if (isFavorited) {
        removeFavorite(input.svs_id);
        return false;
      } else {
        addFavorite(input);
        return true;
      }
    },
    [addFavorite, removeFavorite]
  );

  const getAllTags = useCallback((): string[] => {
    return storage.getAllFavoriteTags();
  }, []);

  const getFavoritesByTag = useCallback((tag: string): LocalFavorite[] => {
    return storage.getFavoritesByTag(tag);
  }, []);

  return {
    favorites,
    favoritesArray: Object.values(favorites),
    addFavorite,
    updateFavorite,
    removeFavorite,
    toggleFavorite,
    getAllTags,
    getFavoritesByTag,
    isFavorite: (svsId: number) => svsId in favorites,
    getFavorite: (svsId: number) => favorites[svsId] || null,
    count: Object.keys(favorites).length,
  };
}

/**
 * Hook to check if a specific page is favorited.
 * Optimized for use in result cards where we only need the favorited state.
 */
export function useIsFavorite(svsId: number): {
  isFavorite: boolean;
  favorite: LocalFavorite | null;
} {
  const favorites = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return {
    isFavorite: svsId in favorites,
    favorite: favorites[svsId] || null,
  };
}
