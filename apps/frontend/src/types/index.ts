/**
 * Common TypeScript types for the SVS Browser frontend
 */

// Re-export API types
export type {
  SearchParams,
  SearchResult,
  SearchResponse,
  SvsPageDetail,
} from "@/lib/api";

/**
 * Media types available in the SVS archive
 */
export type MediaType = "video" | "image" | "data" | "document" | "other";

/**
 * Sort options for search results
 */
export type SortOption = "relevance" | "date_desc" | "date_asc";

/**
 * Tag types
 */
export type TagType =
  | "keyword"
  | "mission"
  | "instrument"
  | "target"
  | "domain"
  | "concept"
  | "event"
  | "person"
  | "organization";

/**
 * Filter state for search
 */
export interface FilterState {
  media_types: MediaType[];
  date_from: string | null;
  date_to: string | null;
  domains: string[];
  missions: string[];
}

/**
 * Facet counts from search results
 */
export interface FacetCounts {
  media_types: Record<string, number>;
  domains: Record<string, number>;
  missions: Record<string, number>;
}

/**
 * Pagination state
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

/**
 * Citation from RAG response
 */
export interface Citation {
  svs_id: number;
  title: string;
  chunk_id: string;
  section: string;
  anchor: string;
  excerpt: string;
}
