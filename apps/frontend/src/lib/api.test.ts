import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, API_BASE_URL, getThumbnailUrl, search } from "./api";

describe("API_BASE_URL", () => {
  it("has a default value", () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe("string");
  });
});

describe("getThumbnailUrl", () => {
  it("returns null for null input", () => {
    expect(getThumbnailUrl(null)).toBeNull();
  });

  it("returns absolute URLs unchanged", () => {
    const url = "https://example.com/image.jpg";
    expect(getThumbnailUrl(url)).toBe(url);
  });

  it("converts relative API paths to absolute URLs", () => {
    const result = getThumbnailUrl("/api/v1/thumbnails/pages/12345");
    expect(result).toContain("/api/v1/thumbnails/pages/12345");
    expect(result).toMatch(/^https?:\/\//);
  });

  it("handles paths not starting with /api/", () => {
    const url = "/some/other/path.jpg";
    expect(getThumbnailUrl(url)).toBe(url);
  });
});

describe("ApiError", () => {
  it("creates an error with status, code, and message", () => {
    const error = new ApiError(404, "NOT_FOUND", "Page not found");

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Page not found");
    expect(error.name).toBe("ApiError");
  });
});

describe("search", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes a GET request with query parameters", async () => {
    const mockResponse = {
      count: 1,
      results: [],
      facets: { media_type: {}, domain: {}, mission: {} },
      next: null,
      previous: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await search({ q: "mars" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/search?");
    expect(url).toContain("q=mars");
    expect(result).toEqual(mockResponse);
  });

  it("includes media_types as multiple parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 0, results: [], facets: {}, next: null, previous: null }),
    });

    await search({ q: "test", media_types: ["video", "image"] });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("media_type=video");
    expect(url).toContain("media_type=image");
  });

  it("includes sort parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 0, results: [], facets: {}, next: null, previous: null }),
    });

    await search({ q: "test", sort: "date_desc" });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("sort=date_desc");
  });

  it("includes pagination parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 0, results: [], facets: {}, next: null, previous: null }),
    });

    await search({ q: "test", limit: 50, offset: 100 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=100");
  });

  it("includes date range parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 0, results: [], facets: {}, next: null, previous: null }),
    });

    await search({ q: "test", date_from: "2020-01-01", date_to: "2024-12-31" });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("date_from=2020-01-01");
    expect(url).toContain("date_to=2024-12-31");
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ error: { code: "SERVER_ERROR", message: "Something went wrong" } }),
    });

    try {
      await search({ q: "test" });
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).code).toBe("SERVER_ERROR");
    }
  });

  it("handles JSON parse errors in error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("Invalid JSON")),
    });

    await expect(search({ q: "test" })).rejects.toThrow(ApiError);
  });
});
