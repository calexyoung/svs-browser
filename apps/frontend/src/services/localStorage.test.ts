import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetCache,
  addFavorite,
  addToGallery,
  clearAllData,
  createGallery,
  deleteGallery,
  exportData,
  getAllFavoriteTags,
  getFavorite,
  getFavorites,
  getFavoritesByTag,
  getGalleries,
  getGallery,
  importData,
  isFavorite,
  isInAnyGallery,
  removeFavorite,
  removeFromGallery,
  updateFavorite,
  updateGallery,
} from "./localStorage";

describe("localStorage service", () => {
  beforeEach(() => {
    // Clear localStorage and reset module-level caches
    localStorage.clear();
    _resetCache();
  });

  afterEach(() => {
    localStorage.clear();
    _resetCache();
  });

  describe("Favorites", () => {
    describe("getFavorites", () => {
      it("returns empty object when no favorites exist", () => {
        const favorites = getFavorites();
        expect(favorites).toEqual({});
      });

      it("returns favorites from localStorage", () => {
        const favorite = addFavorite({
          svs_id: 12345,
          title: "Test",
          thumbnail_url: null,
        });

        const favorites = getFavorites();
        expect(favorites[12345]).toEqual(favorite);
      });
    });

    describe("addFavorite", () => {
      it("adds a new favorite", () => {
        const favorite = addFavorite({
          svs_id: 12345,
          title: "Test Visualization",
          thumbnail_url: "https://example.com/thumb.jpg",
        });

        expect(favorite.svs_id).toBe(12345);
        expect(favorite.title).toBe("Test Visualization");
        expect(favorite.thumbnail_url).toBe("https://example.com/thumb.jpg");
        expect(favorite.notes).toBe("");
        expect(favorite.tags).toEqual([]);
        expect(favorite.created_at).toBeDefined();
        expect(favorite.updated_at).toBeDefined();
      });

      it("adds favorite with optional fields", () => {
        const favorite = addFavorite({
          svs_id: 12345,
          title: "Test",
          notes: "My notes",
          tags: ["space", "earth"],
        });

        expect(favorite.notes).toBe("My notes");
        expect(favorite.tags).toEqual(["space", "earth"]);
      });

      it("updates existing favorite", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));

        const first = addFavorite({
          svs_id: 12345,
          title: "Test",
          notes: "Original notes",
        });

        // Advance time to ensure different timestamp
        vi.setSystemTime(new Date("2024-01-01T10:00:01Z"));

        const second = addFavorite({
          svs_id: 12345,
          title: "Updated Title",
        });

        vi.useRealTimers();

        expect(second.title).toBe("Updated Title");
        expect(second.notes).toBe("Original notes"); // Preserved
        expect(second.created_at).toBe(first.created_at); // Preserved
        expect(second.updated_at).not.toBe(first.updated_at);
      });
    });

    describe("getFavorite", () => {
      it("returns favorite by ID", () => {
        addFavorite({ svs_id: 12345, title: "Test" });

        const favorite = getFavorite(12345);
        expect(favorite?.title).toBe("Test");
      });

      it("returns null for non-existent favorite", () => {
        const favorite = getFavorite(99999);
        expect(favorite).toBeNull();
      });
    });

    describe("isFavorite", () => {
      it("returns true for existing favorite", () => {
        addFavorite({ svs_id: 12345, title: "Test" });
        expect(isFavorite(12345)).toBe(true);
      });

      it("returns false for non-existent favorite", () => {
        expect(isFavorite(99999)).toBe(false);
      });
    });

    describe("updateFavorite", () => {
      it("updates notes and tags", () => {
        addFavorite({ svs_id: 12345, title: "Test" });

        const updated = updateFavorite(12345, {
          notes: "New notes",
          tags: ["tag1", "tag2"],
        });

        expect(updated?.notes).toBe("New notes");
        expect(updated?.tags).toEqual(["tag1", "tag2"]);
      });

      it("returns null for non-existent favorite", () => {
        const updated = updateFavorite(99999, { notes: "Test" });
        expect(updated).toBeNull();
      });
    });

    describe("removeFavorite", () => {
      it("removes existing favorite", () => {
        addFavorite({ svs_id: 12345, title: "Test" });

        const result = removeFavorite(12345);

        expect(result).toBe(true);
        expect(isFavorite(12345)).toBe(false);
      });

      it("returns false for non-existent favorite", () => {
        const result = removeFavorite(99999);
        expect(result).toBe(false);
      });
    });

    describe("getAllFavoriteTags", () => {
      it("returns all unique tags sorted", () => {
        addFavorite({ svs_id: 1, title: "A", tags: ["earth", "space"] });
        addFavorite({ svs_id: 2, title: "B", tags: ["mars", "space"] });

        const tags = getAllFavoriteTags();
        expect(tags).toEqual(["earth", "mars", "space"]);
      });

      it("returns empty array when no favorites", () => {
        const tags = getAllFavoriteTags();
        expect(tags).toEqual([]);
      });
    });

    describe("getFavoritesByTag", () => {
      it("returns favorites with matching tag", () => {
        addFavorite({ svs_id: 1, title: "A", tags: ["space"] });
        addFavorite({ svs_id: 2, title: "B", tags: ["earth"] });
        addFavorite({ svs_id: 3, title: "C", tags: ["space", "mars"] });

        const spaceFavorites = getFavoritesByTag("space");
        expect(spaceFavorites).toHaveLength(2);
        expect(spaceFavorites.map((f) => f.svs_id)).toContain(1);
        expect(spaceFavorites.map((f) => f.svs_id)).toContain(3);
      });
    });
  });

  describe("Galleries", () => {
    describe("getGalleries", () => {
      it("returns empty object when no galleries exist", () => {
        const galleries = getGalleries();
        expect(galleries).toEqual({});
      });
    });

    describe("createGallery", () => {
      it("creates a new gallery", () => {
        const gallery = createGallery({
          name: "My Gallery",
          description: "A collection of favorites",
        });

        expect(gallery.id).toBeDefined();
        expect(gallery.name).toBe("My Gallery");
        expect(gallery.description).toBe("A collection of favorites");
        expect(gallery.items).toEqual([]);
        expect(gallery.created_at).toBeDefined();
      });

      it("creates gallery without description", () => {
        const gallery = createGallery({ name: "Simple Gallery" });
        expect(gallery.description).toBe("");
      });
    });

    describe("getGallery", () => {
      it("returns gallery by ID", () => {
        const created = createGallery({ name: "Test" });
        const retrieved = getGallery(created.id);
        expect(retrieved?.name).toBe("Test");
      });

      it("returns null for non-existent gallery", () => {
        const gallery = getGallery("non-existent-id");
        expect(gallery).toBeNull();
      });
    });

    describe("updateGallery", () => {
      it("updates gallery name and description", () => {
        const gallery = createGallery({ name: "Original" });

        const updated = updateGallery(gallery.id, {
          name: "Updated",
          description: "New description",
        });

        expect(updated?.name).toBe("Updated");
        expect(updated?.description).toBe("New description");
      });

      it("returns null for non-existent gallery", () => {
        const updated = updateGallery("non-existent", { name: "Test" });
        expect(updated).toBeNull();
      });
    });

    describe("deleteGallery", () => {
      it("deletes existing gallery", () => {
        const gallery = createGallery({ name: "Test" });

        const result = deleteGallery(gallery.id);

        expect(result).toBe(true);
        expect(getGallery(gallery.id)).toBeNull();
      });

      it("returns false for non-existent gallery", () => {
        const result = deleteGallery("non-existent");
        expect(result).toBe(false);
      });
    });

    describe("addToGallery", () => {
      it("adds item to gallery", () => {
        const gallery = createGallery({ name: "Test" });

        const updated = addToGallery(gallery.id, {
          svs_id: 12345,
          title: "Visualization",
          thumbnail_url: "https://example.com/thumb.jpg",
        });

        expect(updated?.items).toHaveLength(1);
        expect(updated?.items[0].svs_id).toBe(12345);
        expect(updated?.items[0].position).toBe(0);
      });

      it("does not add duplicate items", () => {
        const gallery = createGallery({ name: "Test" });
        addToGallery(gallery.id, { svs_id: 12345, title: "Test" });
        const updated = addToGallery(gallery.id, { svs_id: 12345, title: "Test" });

        expect(updated?.items).toHaveLength(1);
      });

      it("returns null for non-existent gallery", () => {
        const result = addToGallery("non-existent", {
          svs_id: 12345,
          title: "Test",
        });
        expect(result).toBeNull();
      });
    });

    describe("removeFromGallery", () => {
      it("removes item from gallery", () => {
        const gallery = createGallery({ name: "Test" });
        addToGallery(gallery.id, { svs_id: 12345, title: "Test" });

        const updated = removeFromGallery(gallery.id, 12345);

        expect(updated?.items).toHaveLength(0);
      });

      it("reorders positions after removal", () => {
        const gallery = createGallery({ name: "Test" });
        addToGallery(gallery.id, { svs_id: 1, title: "A" });
        addToGallery(gallery.id, { svs_id: 2, title: "B" });
        addToGallery(gallery.id, { svs_id: 3, title: "C" });

        const updated = removeFromGallery(gallery.id, 2);

        expect(updated?.items).toHaveLength(2);
        expect(updated?.items[0].position).toBe(0);
        expect(updated?.items[1].position).toBe(1);
      });
    });

    describe("isInAnyGallery", () => {
      it("returns gallery IDs containing item", () => {
        const gallery1 = createGallery({ name: "Gallery 1" });
        const gallery2 = createGallery({ name: "Gallery 2" });
        addToGallery(gallery1.id, { svs_id: 12345, title: "Test" });
        addToGallery(gallery2.id, { svs_id: 12345, title: "Test" });

        const galleryIds = isInAnyGallery(12345);

        expect(galleryIds).toHaveLength(2);
        expect(galleryIds).toContain(gallery1.id);
        expect(galleryIds).toContain(gallery2.id);
      });

      it("returns empty array when not in any gallery", () => {
        const galleryIds = isInAnyGallery(99999);
        expect(galleryIds).toEqual([]);
      });
    });
  });

  describe("Export/Import", () => {
    it("exports all data", () => {
      addFavorite({ svs_id: 12345, title: "Fav" });
      createGallery({ name: "Gallery" });

      const data = exportData();

      expect(data.favorites.favorites[12345]).toBeDefined();
      expect(Object.keys(data.galleries.galleries)).toHaveLength(1);
    });

    it("imports and merges data", () => {
      addFavorite({ svs_id: 1, title: "Existing" });

      importData({
        favorites: {
          version: 1,
          favorites: {
            2: {
              svs_id: 2,
              title: "Imported",
              thumbnail_url: null,
              notes: "",
              tags: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
        },
      });

      expect(getFavorite(1)).toBeDefined();
      expect(getFavorite(2)).toBeDefined();
    });
  });

  describe("clearAllData", () => {
    it("removes all favorites and galleries", () => {
      addFavorite({ svs_id: 12345, title: "Test" });
      createGallery({ name: "Test" });

      clearAllData();

      expect(getFavorites()).toEqual({});
      expect(getGalleries()).toEqual({});
    });
  });
});
