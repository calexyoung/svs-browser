/**
 * Types for favorites and galleries feature (localStorage-based)
 */

/**
 * A favorited SVS page with user notes and tags
 */
export interface LocalFavorite {
  svs_id: number;
  title: string;
  thumbnail_url: string | null;
  notes: string;
  tags: string[];
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * An item in a gallery
 */
export interface GalleryItem {
  svs_id: number;
  title: string;
  thumbnail_url: string | null;
  position: number;
  added_at: string; // ISO timestamp
}

/**
 * A user-created gallery (collection of SVS pages)
 */
export interface LocalGallery {
  id: string; // UUID
  name: string;
  description: string;
  items: GalleryItem[];
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Shape of favorites stored in localStorage
 */
export interface FavoritesStore {
  version: number;
  favorites: Record<number, LocalFavorite>; // keyed by svs_id
}

/**
 * Shape of galleries stored in localStorage
 */
export interface GalleriesStore {
  version: number;
  galleries: Record<string, LocalGallery>; // keyed by gallery id
}

/**
 * Input for adding/updating a favorite
 */
export interface FavoriteInput {
  svs_id: number;
  title: string;
  thumbnail_url?: string | null;
  notes?: string;
  tags?: string[];
}

/**
 * Input for creating/updating a gallery
 */
export interface GalleryInput {
  name: string;
  description?: string;
}

/**
 * Input for adding an item to a gallery
 */
export interface GalleryItemInput {
  svs_id: number;
  title: string;
  thumbnail_url?: string | null;
}
