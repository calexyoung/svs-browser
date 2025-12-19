"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  LocalGallery,
  GalleryInput,
  GalleryItemInput,
} from "@/types/favorites";
import * as storage from "@/services/localStorage";

// Storage event listener for cross-tab synchronization
const GALLERIES_KEY = "svs-galleries";
let listeners: Set<() => void> = new Set();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Listen for storage events from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === GALLERIES_KEY) {
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

function getSnapshot(): Record<string, LocalGallery> {
  return storage.getGalleries();
}

function getServerSnapshot(): Record<string, LocalGallery> {
  return {};
}

/**
 * Hook to manage galleries with localStorage persistence.
 * Automatically syncs across tabs and components.
 */
export function useGalleries() {
  const galleries = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const createGallery = useCallback((input: GalleryInput): LocalGallery => {
    const result = storage.createGallery(input);
    notifyListeners();
    return result;
  }, []);

  const updateGallery = useCallback(
    (
      galleryId: string,
      updates: { name?: string; description?: string }
    ): LocalGallery | null => {
      const result = storage.updateGallery(galleryId, updates);
      notifyListeners();
      return result;
    },
    []
  );

  const deleteGallery = useCallback((galleryId: string): boolean => {
    const result = storage.deleteGallery(galleryId);
    notifyListeners();
    return result;
  }, []);

  const addToGallery = useCallback(
    (galleryId: string, input: GalleryItemInput): LocalGallery | null => {
      const result = storage.addToGallery(galleryId, input);
      notifyListeners();
      return result;
    },
    []
  );

  const removeFromGallery = useCallback(
    (galleryId: string, svsId: number): LocalGallery | null => {
      const result = storage.removeFromGallery(galleryId, svsId);
      notifyListeners();
      return result;
    },
    []
  );

  const reorderGalleryItems = useCallback(
    (galleryId: string, svsIds: number[]): LocalGallery | null => {
      const result = storage.reorderGalleryItems(galleryId, svsIds);
      notifyListeners();
      return result;
    },
    []
  );

  const getGalleriesContaining = useCallback(
    (svsId: number): LocalGallery[] => {
      return storage.getGalleriesContaining(svsId);
    },
    []
  );

  const isInGallery = useCallback(
    (galleryId: string, svsId: number): boolean => {
      const gallery = galleries[galleryId];
      if (!gallery) return false;
      return gallery.items.some((item) => item.svs_id === svsId);
    },
    [galleries]
  );

  return {
    galleries,
    galleriesArray: Object.values(galleries).sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
    createGallery,
    updateGallery,
    deleteGallery,
    addToGallery,
    removeFromGallery,
    reorderGalleryItems,
    getGallery: (id: string) => galleries[id] || null,
    getGalleriesContaining,
    isInGallery,
    count: Object.keys(galleries).length,
  };
}

/**
 * Hook to work with a specific gallery
 */
export function useGallery(galleryId: string | null) {
  const galleries = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const gallery = galleryId ? galleries[galleryId] || null : null;

  const addItem = useCallback(
    (input: GalleryItemInput): LocalGallery | null => {
      if (!galleryId) return null;
      const result = storage.addToGallery(galleryId, input);
      notifyListeners();
      return result;
    },
    [galleryId]
  );

  const removeItem = useCallback(
    (svsId: number): LocalGallery | null => {
      if (!galleryId) return null;
      const result = storage.removeFromGallery(galleryId, svsId);
      notifyListeners();
      return result;
    },
    [galleryId]
  );

  const reorderItems = useCallback(
    (svsIds: number[]): LocalGallery | null => {
      if (!galleryId) return null;
      const result = storage.reorderGalleryItems(galleryId, svsIds);
      notifyListeners();
      return result;
    },
    [galleryId]
  );

  const update = useCallback(
    (updates: { name?: string; description?: string }): LocalGallery | null => {
      if (!galleryId) return null;
      const result = storage.updateGallery(galleryId, updates);
      notifyListeners();
      return result;
    },
    [galleryId]
  );

  return {
    gallery,
    items: gallery?.items || [],
    addItem,
    removeItem,
    reorderItems,
    update,
    isInGallery: (svsId: number) =>
      gallery?.items.some((item) => item.svs_id === svsId) || false,
  };
}
