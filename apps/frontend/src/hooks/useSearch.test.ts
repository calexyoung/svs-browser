import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearch } from "./useSearch";

// Mock the API module
vi.mock("@/lib/api", () => ({
  search: vi.fn(),
}));

import { search as searchApi } from "@/lib/api";

const mockSearchApi = vi.mocked(searchApi);

describe("useSearch", () => {
  const mockResponse = {
    count: 10,
    results: [
      {
        svs_id: 12345,
        title: "Test Result",
        snippet: "Test snippet",
        published_date: "2024-01-15",
        canonical_url: "https://svs.gsfc.nasa.gov/12345/",
        thumbnail_url: null,
        media_types: ["video"],
        tags: ["NASA"],
        score: 0.9,
      },
    ],
    facets: {
      media_type: { video: 5 },
      domain: {},
      mission: {},
    },
    next: null,
    previous: null,
  };

  beforeEach(() => {
    mockSearchApi.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useSearch());

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("performs a search and updates state", async () => {
    mockSearchApi.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search({ q: "mars" });
    });

    // Should be loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
    expect(mockSearchApi).toHaveBeenCalledWith({ q: "mars" });
  });

  it("handles search errors", async () => {
    const error = new Error("Network error");
    mockSearchApi.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search({ q: "test" });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(error);
  });

  it("wraps non-Error exceptions", async () => {
    mockSearchApi.mockRejectedValueOnce("string error");

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search({ q: "test" });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Search failed");
  });

  it("resets state with reset function", async () => {
    mockSearchApi.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useSearch());

    // Perform a search first
    act(() => {
      result.current.search({ q: "test" });
    });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("clears previous errors on new search", async () => {
    const error = new Error("First error");
    mockSearchApi.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useSearch());

    // First search fails
    act(() => {
      result.current.search({ q: "test1" });
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    // Second search succeeds
    mockSearchApi.mockResolvedValueOnce(mockResponse);

    act(() => {
      result.current.search({ q: "test2" });
    });

    // Error should be cleared immediately
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
  });
});
