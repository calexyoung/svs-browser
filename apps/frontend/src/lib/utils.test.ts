import { describe, expect, it, vi } from "vitest";
import { cn, debounce, formatDate, formatDuration, formatFileSize } from "./utils";

describe("cn (class name merger)", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles arrays and objects", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    // Use ISO format with timezone to avoid TZ issues
    const result = formatDate("2024-01-15T12:00:00Z");
    expect(result).toMatch(/Jan 1[45], 2024/); // Can be 14 or 15 depending on TZ
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2024, 0, 15, 12, 0, 0)); // Month is 0-indexed
    expect(result).toBe("Jan 15, 2024");
  });

  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("handles different date formats", () => {
    // Use Date objects to avoid timezone parsing issues
    expect(formatDate(new Date(2024, 11, 25))).toBe("Dec 25, 2024");
    expect(formatDate(new Date(2020, 5, 1))).toBe("Jun 1, 2020");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("returns empty string for null", () => {
    expect(formatFileSize(null)).toBe("");
  });

  it("returns empty string for 0", () => {
    expect(formatFileSize(0)).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(125)).toBe("2:05");
  });

  it("pads seconds with leading zero", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(601)).toBe("10:01");
  });

  it("returns empty string for null", () => {
    expect(formatDuration(null)).toBe("");
  });

  it("returns empty string for 0", () => {
    expect(formatDuration(0)).toBe("");
  });
});

describe("debounce", () => {
  it("delays function execution", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("resets timer on subsequent calls", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);

    debouncedFn(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("passes arguments to the debounced function", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");

    vi.useRealTimers();
  });
});
