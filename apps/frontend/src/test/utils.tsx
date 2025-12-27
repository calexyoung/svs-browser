import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";

/**
 * Custom render function that includes common providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  // Add any custom options here
}

function AllProviders({ children }: { children: ReactNode }) {
  // Add providers here (e.g., ThemeProvider, QueryClientProvider)
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: CustomRenderOptions) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render, userEvent };

/**
 * Create a mock search response
 */
export function createMockSearchResponse(overrides = {}) {
  return {
    count: 10,
    results: [
      {
        svs_id: 12345,
        title: "Test Visualization",
        snippet: "This is a test snippet...",
        published_date: "2024-01-15",
        canonical_url: "https://svs.gsfc.nasa.gov/12345/",
        thumbnail_url: "https://example.com/thumb.jpg",
        media_types: ["video", "image"],
        tags: ["NASA", "Space"],
        score: 0.95,
      },
    ],
    facets: {
      media_type: { video: 5, image: 3 },
      domain: { "Earth Science": 4 },
      mission: { SDO: 2 },
    },
    next: null,
    previous: null,
    ...overrides,
  };
}

/**
 * Create a mock page detail
 */
export function createMockPageDetail(overrides = {}) {
  return {
    svs_id: 12345,
    title: "Test Page",
    canonical_url: "https://svs.gsfc.nasa.gov/12345/",
    published_date: "2024-01-15",
    content: null,
    summary: "Test summary",
    credits: [{ role: "Lead Scientist", name: "Dr. Test" }],
    tags: [{ type: "mission", value: "Test Mission" }],
    assets: [],
    related_pages: [],
    ...overrides,
  };
}

/**
 * Wait for async operations
 */
export async function waitForAsync(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
