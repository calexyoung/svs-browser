import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock clipboard API
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  const readTextMock = vi.fn().mockResolvedValue("");

  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: writeTextMock,
      readText: readTextMock,
    },
    writable: true,
    configurable: true,
  });

  // Store mocks for reset
  (globalThis as Record<string, unknown>).__clipboardMocks = {
    writeText: writeTextMock,
    readText: readTextMock,
  };
});

// Reset clipboard mock before each test
beforeEach(() => {
  const mocks = (globalThis as Record<string, unknown>).__clipboardMocks as {
    writeText: ReturnType<typeof vi.fn>;
    readText: ReturnType<typeof vi.fn>;
  } | undefined;
  if (mocks) {
    mocks.writeText.mockClear();
    mocks.readText.mockClear();
  }
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Reset localStorage before each test
afterEach(() => {
  localStorageMock.clear();
});
