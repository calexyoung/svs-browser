/**
 * API client for the SVS Browser backend
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Extract the host part for thumbnail URLs (e.g., "http://localhost:8010")
export const API_HOST = API_BASE_URL.replace(/\/api\/v1$/, "");

/**
 * Convert a thumbnail URL to an absolute URL if it's a relative path
 */
export function getThumbnailUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/")) {
    return `${API_HOST}${url}`;
  }
  return url;
}

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.error?.code || "UNKNOWN_ERROR",
      errorData.error?.message || response.statusText
    );
  }

  return response.json();
}

/**
 * Search parameters
 */
export interface SearchParams {
  q: string;
  media_types?: string[];
  domains?: string[];
  missions?: string[];
  date_from?: string;
  date_to?: string;
  sort?: "relevance" | "date_desc" | "date_asc";
  limit?: number;
  offset?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  svs_id: number;
  title: string;
  snippet: string;
  published_date: string | null;
  canonical_url: string;
  thumbnail_url: string | null;
  media_types: string[];
  tags: string[];
  score: number;
}

/**
 * Search response
 */
export interface SearchResponse {
  count: number;
  results: SearchResult[];
  facets: {
    media_type: Record<string, number>;
    domain: Record<string, number>;
    mission: Record<string, number>;
  };
  next: string | null;
  previous: string | null;
}

/**
 * Search SVS content
 */
export async function search(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.media_types?.length) {
    params.media_types.forEach((t) => searchParams.append("media_type", t));
  }
  if (params.domains?.length) {
    params.domains.forEach((d) => searchParams.append("domain", d));
  }
  if (params.missions?.length) {
    params.missions.forEach((m) => searchParams.append("mission", m));
  }
  if (params.date_from) searchParams.set("date_from", params.date_from);
  if (params.date_to) searchParams.set("date_to", params.date_to);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  return fetchApi<SearchResponse>(`/search?${searchParams.toString()}`);
}

/**
 * Rich content paragraph
 */
export interface ContentParagraph {
  html: string;
  text: string;
}

/**
 * Rich content section
 */
export interface ContentSection {
  type: string;
  paragraphs: ContentParagraph[];
}

/**
 * Rich content with HTML formatting preserved
 */
export interface RichContent {
  format_version: number;
  sections: ContentSection[];
}

/**
 * SVS Page detail
 */
export interface SvsPageDetail {
  svs_id: number;
  title: string;
  canonical_url: string;
  published_date: string | null;
  content: RichContent | null;
  summary: string | null;
  credits: Array<{
    role: string;
    name: string;
    organization?: string;
  }>;
  tags: Array<{
    type: string;
    value: string;
  }>;
  assets: Array<{
    asset_id: string;
    title: string | null;
    type: string;
    caption_html: string | null;
    caption_text: string | null;
    files: Array<{
      variant: string;
      url: string;
      mime_type: string | null;
    }>;
    thumbnail_url: string | null;
  }>;
  related_pages: Array<{
    svs_id: number;
    title: string;
    rel_type: string;
  }>;
}

/**
 * Get SVS page details
 */
export async function getPage(svsId: number): Promise<SvsPageDetail> {
  return fetchApi<SvsPageDetail>(`/svs/${svsId}`);
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/health");
}

/**
 * Browse parameters (no query required)
 */
export interface BrowseParams {
  media_types?: string[];
  domains?: string[];
  missions?: string[];
  date_from?: string;
  date_to?: string;
  sort?: "date_desc" | "date_asc";
  limit?: number;
  offset?: number;
}

/**
 * Browse SVS content (list all pages with optional filters)
 */
export async function browse(params: BrowseParams = {}): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();

  if (params.media_types?.length) {
    params.media_types.forEach((t) => searchParams.append("media_type", t));
  }
  if (params.domains?.length) {
    params.domains.forEach((d) => searchParams.append("domain", d));
  }
  if (params.missions?.length) {
    params.missions.forEach((m) => searchParams.append("mission", m));
  }
  if (params.date_from) searchParams.set("date_from", params.date_from);
  if (params.date_to) searchParams.set("date_to", params.date_to);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  return fetchApi<SearchResponse>(`/browse${queryString ? `?${queryString}` : ""}`);
}
