/**
 * localStorage service for favorites and galleries persistence
 *
 * Provides CRUD operations for favorites and galleries stored in browser localStorage.
 * Includes data validation and migration support for schema changes.
 */

import type {
  LocalFavorite,
  LocalGallery,
  GalleryItem,
  FavoritesStore,
  GalleriesStore,
  FavoriteInput,
  GalleryInput,
  GalleryItemInput,
} from "@/types/favorites";

// Storage keys
const FAVORITES_KEY = "svs-favorites";
const GALLERIES_KEY = "svs-galleries";

// Current schema versions
const FAVORITES_VERSION = 1;
const GALLERIES_VERSION = 1;

// Cached values to prevent infinite re-renders with useSyncExternalStore
let cachedFavorites: Record<number, LocalFavorite> = {};
let cachedFavoritesRaw: string | null = null;
let cachedGalleries: Record<string, LocalGallery> = {};
let cachedGalleriesRaw: string | null = null;

// Generate UUID (simple implementation for browser)
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get current ISO timestamp
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// Favorites Operations
// ============================================================================

/**
 * Get all favorites from localStorage
 * Returns a cached reference if the raw data hasn't changed to prevent infinite re-renders
 */
export function getFavorites(): Record<number, LocalFavorite> {
  if (typeof window === "undefined") return cachedFavorites;

  try {
    const stored = localStorage.getItem(FAVORITES_KEY);

    // Return cached value if raw data hasn't changed
    if (stored === cachedFavoritesRaw) {
      return cachedFavorites;
    }

    // Update cache
    cachedFavoritesRaw = stored;

    if (!stored) {
      cachedFavorites = {};
      return cachedFavorites;
    }

    const data: FavoritesStore = JSON.parse(stored);

    // Handle version migrations here if needed
    if (data.version !== FAVORITES_VERSION) {
      // Future: migrate data schema
    }

    cachedFavorites = data.favorites || {};
    return cachedFavorites;
  } catch (error) {
    console.error("Error reading favorites from localStorage:", error);
    cachedFavorites = {};
    return cachedFavorites;
  }
}

/**
 * Get a single favorite by SVS ID
 */
export function getFavorite(svsId: number): LocalFavorite | null {
  const favorites = getFavorites();
  return favorites[svsId] || null;
}

/**
 * Check if a page is favorited
 */
export function isFavorite(svsId: number): boolean {
  const favorites = getFavorites();
  return svsId in favorites;
}

/**
 * Add or update a favorite
 */
export function addFavorite(input: FavoriteInput): LocalFavorite {
  const favorites = getFavorites();
  const existing = favorites[input.svs_id];
  const timestamp = now();

  const favorite: LocalFavorite = {
    svs_id: input.svs_id,
    title: input.title,
    thumbnail_url: input.thumbnail_url ?? null,
    notes: input.notes ?? existing?.notes ?? "",
    tags: input.tags ?? existing?.tags ?? [],
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
  };

  favorites[input.svs_id] = favorite;
  saveFavorites(favorites);

  return favorite;
}

/**
 * Update a favorite's notes and tags
 */
export function updateFavorite(
  svsId: number,
  updates: { notes?: string; tags?: string[] }
): LocalFavorite | null {
  const favorites = getFavorites();
  const existing = favorites[svsId];

  if (!existing) return null;

  const updated: LocalFavorite = {
    ...existing,
    notes: updates.notes ?? existing.notes,
    tags: updates.tags ?? existing.tags,
    updated_at: now(),
  };

  favorites[svsId] = updated;
  saveFavorites(favorites);

  return updated;
}

/**
 * Remove a favorite
 */
export function removeFavorite(svsId: number): boolean {
  const favorites = getFavorites();

  if (!(svsId in favorites)) return false;

  delete favorites[svsId];
  saveFavorites(favorites);

  return true;
}

/**
 * Get all unique tags used across favorites
 */
export function getAllFavoriteTags(): string[] {
  const favorites = getFavorites();
  const tagsSet = new Set<string>();

  for (const favorite of Object.values(favorites)) {
    for (const tag of favorite.tags) {
      tagsSet.add(tag);
    }
  }

  return Array.from(tagsSet).sort();
}

/**
 * Get favorites filtered by tag
 */
export function getFavoritesByTag(tag: string): LocalFavorite[] {
  const favorites = getFavorites();
  return Object.values(favorites).filter((f) => f.tags.includes(tag));
}

/**
 * Save favorites to localStorage
 */
function saveFavorites(favorites: Record<number, LocalFavorite>): void {
  if (typeof window === "undefined") return;

  const store: FavoritesStore = {
    version: FAVORITES_VERSION,
    favorites,
  };

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(store));
}

// ============================================================================
// Galleries Operations
// ============================================================================

/**
 * Get all galleries from localStorage
 * Returns a cached reference if the raw data hasn't changed to prevent infinite re-renders
 */
export function getGalleries(): Record<string, LocalGallery> {
  if (typeof window === "undefined") return cachedGalleries;

  try {
    const stored = localStorage.getItem(GALLERIES_KEY);

    // Return cached value if raw data hasn't changed
    if (stored === cachedGalleriesRaw) {
      return cachedGalleries;
    }

    // Update cache
    cachedGalleriesRaw = stored;

    if (!stored) {
      cachedGalleries = {};
      return cachedGalleries;
    }

    const data: GalleriesStore = JSON.parse(stored);

    // Handle version migrations here if needed
    if (data.version !== GALLERIES_VERSION) {
      // Future: migrate data schema
    }

    cachedGalleries = data.galleries || {};
    return cachedGalleries;
  } catch (error) {
    console.error("Error reading galleries from localStorage:", error);
    cachedGalleries = {};
    return cachedGalleries;
  }
}

/**
 * Get a single gallery by ID
 */
export function getGallery(galleryId: string): LocalGallery | null {
  const galleries = getGalleries();
  return galleries[galleryId] || null;
}

/**
 * Create a new gallery
 */
export function createGallery(input: GalleryInput): LocalGallery {
  const galleries = getGalleries();
  const timestamp = now();
  const id = generateUUID();

  const gallery: LocalGallery = {
    id,
    name: input.name,
    description: input.description ?? "",
    items: [],
    created_at: timestamp,
    updated_at: timestamp,
  };

  galleries[id] = gallery;
  saveGalleries(galleries);

  return gallery;
}

/**
 * Update a gallery's name and description
 */
export function updateGallery(
  galleryId: string,
  updates: { name?: string; description?: string }
): LocalGallery | null {
  const galleries = getGalleries();
  const existing = galleries[galleryId];

  if (!existing) return null;

  const updated: LocalGallery = {
    ...existing,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    updated_at: now(),
  };

  galleries[galleryId] = updated;
  saveGalleries(galleries);

  return updated;
}

/**
 * Delete a gallery
 */
export function deleteGallery(galleryId: string): boolean {
  const galleries = getGalleries();

  if (!(galleryId in galleries)) return false;

  delete galleries[galleryId];
  saveGalleries(galleries);

  return true;
}

/**
 * Add an item to a gallery
 */
export function addToGallery(
  galleryId: string,
  input: GalleryItemInput
): LocalGallery | null {
  const galleries = getGalleries();
  const gallery = galleries[galleryId];

  if (!gallery) return null;

  // Check if item already exists
  if (gallery.items.some((item) => item.svs_id === input.svs_id)) {
    return gallery; // Already in gallery
  }

  const item: GalleryItem = {
    svs_id: input.svs_id,
    title: input.title,
    thumbnail_url: input.thumbnail_url ?? null,
    position: gallery.items.length,
    added_at: now(),
  };

  gallery.items.push(item);
  gallery.updated_at = now();

  galleries[galleryId] = gallery;
  saveGalleries(galleries);

  return gallery;
}

/**
 * Remove an item from a gallery
 */
export function removeFromGallery(
  galleryId: string,
  svsId: number
): LocalGallery | null {
  const galleries = getGalleries();
  const gallery = galleries[galleryId];

  if (!gallery) return null;

  const index = gallery.items.findIndex((item) => item.svs_id === svsId);
  if (index === -1) return gallery;

  gallery.items.splice(index, 1);

  // Reorder positions
  gallery.items.forEach((item, i) => {
    item.position = i;
  });

  gallery.updated_at = now();

  galleries[galleryId] = gallery;
  saveGalleries(galleries);

  return gallery;
}

/**
 * Reorder items in a gallery
 */
export function reorderGalleryItems(
  galleryId: string,
  svsIds: number[]
): LocalGallery | null {
  const galleries = getGalleries();
  const gallery = galleries[galleryId];

  if (!gallery) return null;

  // Create a map for quick lookup
  const itemMap = new Map(gallery.items.map((item) => [item.svs_id, item]));

  // Reorder items based on provided order
  const reorderedItems: GalleryItem[] = [];
  svsIds.forEach((svsId, index) => {
    const item = itemMap.get(svsId);
    if (item) {
      reorderedItems.push({ ...item, position: index });
    }
  });

  // Add any items not in the provided order at the end
  gallery.items.forEach((item) => {
    if (!svsIds.includes(item.svs_id)) {
      reorderedItems.push({ ...item, position: reorderedItems.length });
    }
  });

  gallery.items = reorderedItems;
  gallery.updated_at = now();

  galleries[galleryId] = gallery;
  saveGalleries(galleries);

  return gallery;
}

/**
 * Check if an item is in any gallery
 */
export function isInAnyGallery(svsId: number): string[] {
  const galleries = getGalleries();
  const galleryIds: string[] = [];

  for (const [id, gallery] of Object.entries(galleries)) {
    if (gallery.items.some((item) => item.svs_id === svsId)) {
      galleryIds.push(id);
    }
  }

  return galleryIds;
}

/**
 * Get galleries containing a specific item
 */
export function getGalleriesContaining(svsId: number): LocalGallery[] {
  const galleries = getGalleries();
  return Object.values(galleries).filter((g) =>
    g.items.some((item) => item.svs_id === svsId)
  );
}

/**
 * Save galleries to localStorage
 */
function saveGalleries(galleries: Record<string, LocalGallery>): void {
  if (typeof window === "undefined") return;

  const store: GalleriesStore = {
    version: GALLERIES_VERSION,
    galleries,
  };

  localStorage.setItem(GALLERIES_KEY, JSON.stringify(store));
}

// ============================================================================
// Export/Import Operations (for future sync feature)
// ============================================================================

/**
 * Export all data for backup/sync
 */
export function exportData(): {
  favorites: FavoritesStore;
  galleries: GalleriesStore;
} {
  return {
    favorites: {
      version: FAVORITES_VERSION,
      favorites: getFavorites(),
    },
    galleries: {
      version: GALLERIES_VERSION,
      galleries: getGalleries(),
    },
  };
}

/**
 * Import data (merges with existing)
 */
export function importData(data: {
  favorites?: FavoritesStore;
  galleries?: GalleriesStore;
}): void {
  if (data.favorites) {
    const existing = getFavorites();
    const merged = { ...existing, ...data.favorites.favorites };
    saveFavorites(merged);
  }

  if (data.galleries) {
    const existing = getGalleries();
    const merged = { ...existing, ...data.galleries.galleries };
    saveGalleries(merged);
  }
}

/**
 * Clear all data
 */
export function clearAllData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FAVORITES_KEY);
  localStorage.removeItem(GALLERIES_KEY);
}
