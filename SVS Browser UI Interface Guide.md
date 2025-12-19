# SVS Browser UI Interface Guide and Plan (MVP → P1)

## 1) UI Goals and Design Principles

### Primary goals
- **Find** SVS pages and assets quickly (faster than SVS site search).
- **Understand** what a visualization shows (context + provenance).
- **Use** assets (download, preview, formats, sizes).
- **Ask** questions with **grounded answers + citations**.

### Design principles
- **Metadata-first, media-rich:** show key fields immediately; previews when useful.
- **Progressive disclosure:** start simple; expand details on demand.
- **Always cite:** AI responses must link to SVS page(s)/assets/chunks.
- **Fast by default:** paginated lists, cached queries, lazy asset loading.
- **NASA-friendly:** clean, accessible, documentation-heavy UX.

---

## 2) Global Information Architecture (IA)

### Top-level navigation (MVP)
- **Search** (default/home)
- **Browse** (optional MVP; P1 if time)
- **Chat** (RAG Q&A)
- **About / Help** (what data is indexed, how citations work)

### Global UI elements
- Header: logo/title + main nav + global search box
- Footer: attribution, SVS links, data freshness timestamp, privacy note
- Toast system: background ingestion status (admin/dev), errors, saved actions
- Command palette (P1): quick nav, “open SVS ID…”, “jump to asset…”

---

## 3) Core Screens (MVP)

## 3.1 Home / Search ( / )
**Purpose:** enter query; show fast results; expose filters.

### Layout
- Search bar (primary focus)
- Quick filters (chips): Video, Image, Data, Recently Released
- Results preview (top 10) or “popular / recent” (optional)

### Components
- `SearchBar`
  - query input
  - submit
  - optional autosuggest (P1)
- `QuickFilterChips`
- `RecentHighlights` (optional)

### UX notes
- “Search by keywords, mission, target (Mars), event (eclipse), or SVS ID.”
- If query is numeric, treat as **SVS ID direct jump**.

---

## 3.2 Search Results ( /search?q=... )
**Purpose:** exploration workflow: refine → scan → open detail.

### Layout
- Left rail: filters
- Main: results list + pagination
- Top: “results count”, sort dropdown, active filter chips

### Filters (MVP)
- Media type: image / video / data / other
- Date range (if available)
- Domain/topic tag (basic)
- Mission (if indexed; else P1)

### Sorting (MVP)
- Relevance (default)
- Newest

### Result Card content (MVP)
- Title + SVS ID
- One-line snippet (description)
- Thumb (if available)
- Badges: media types, key tags
- Release date (if known)
- Quick actions:
  - Open page
  - Copy SVS link
  - “Ask AI about this”

### States
- Loading skeleton
- No results: offer tips + show SVS API fallback indicator (optional)
- Error: retry, report

---

## 3.3 SVS Page Detail ( /svs/{id} )
**Purpose:** single source of truth view: description + assets + related.

### Layout (suggested sections)
1. **Header band**
   - Title, SVS ID, release date
   - Canonical SVS link (external)
   - Primary tags (chips)
2. **Preview panel**
   - Featured media preview (video player or hero image)
   - Key metadata summary (media counts, dimensions ranges)
3. **Description**
   - Full text + expandable sections (“read more”)
   - Credits block (names/roles/orgs)
4. **Assets**
   - Filterable asset gallery
   - Format variants and direct downloads
5. **Related**
   - Related SVS pages list
   - “Similar pages” (vector-based; P1 if time)
6. **AI panel (MVP optional / P1)**
   - “Ask about this page” prefilled prompt
   - Evidence snippets from citations

### Asset Gallery (MVP)
- Tabs or chips: All / Video / Images / Data
- Each asset card:
  - thumbnail/preview
  - title/variant label
  - format list (hires/lores/etc)
  - file size + dimensions + duration
  - download links
  - “open asset detail”

---

## 3.4 Asset Detail ( /assets/{asset_id} )
**Purpose:** technical download/usage view for a single asset.

### Layout
- Preview (player/image)
- Metadata grid:
  - type, format, resolution, fps (if available), duration, checksum (optional)
- Files table:
  - variant, url, mime type, size, filename
  - “copy link”, “download”
- Backlink to parent SVS page
- Related assets (same SVS page)

---

## 3.5 Chat / Q&A ( /chat )
**Purpose:** ask questions across SVS corpus; show citations.

### Layout
- Left column (P1): conversation list + “new chat”
- Main:
  - message thread
  - composer
  - citations drawer / right side panel

### Chat behaviors (MVP)
- Streaming responses
- “Citations” attached to answer blocks
- Clicking a citation opens:
  - SVS page detail (new tab) and highlights relevant section
  - Optional “evidence popover” showing chunk excerpt

### System constraints
- Require at least one citation for any factual statement about SVS content.
- If retrieval fails: respond with “I couldn’t find support in indexed SVS content” + suggest query refinements.

---

## 4) Cross-Cutting UX Patterns

### 4.1 Citation UX Standard
Citations should include:
- SVS ID + title
- Section label (description/caption/transcript)
- “Open source” link
- Optional excerpt preview (<= 2–3 lines)

### 4.2 “Evidence Viewer” (high value, low complexity)
A reusable component:
- Shows the retrieved chunk text
- Shows rank/score (debug in admin mode)
- Links to the SVS page section anchor

### 4.3 Accessibility & Performance
- Keyboard navigable filters and results
- WCAG-friendly contrast
- Lazy-load thumbnails
- Infinite scroll optional (P1); default pagination is safer
- Skeleton loaders for perceived speed

---

## 5) MVP UI Component Inventory (Frontend)

### Layout
- `AppShell` (header/footer)
- `TopNav`
- `GlobalSearchInput`

### Search
- `SearchBar`
- `SearchFilters`
- `FilterChipGroup`
- `SortMenu`
- `ResultCard`
- `Pagination`

### Page Detail
- `PageHeader`
- `MediaHero`
- `MetadataSummary`
- `DescriptionSection`
- `CreditsBlock`
- `AssetGallery`
- `RelatedPagesList`

### Asset Detail
- `AssetHero`
- `AssetMetadataGrid`
- `FileVariantsTable`

### Chat
- `ChatContainer`
- `ChatMessage`
- `ChatComposer`
- `CitationBadge`
- `CitationsPanel`
- `EvidencePopover`

### Utility
- `Skeleton`
- `EmptyState`
- `ErrorBoundary`
- `Toast`

---

## 6) API-to-UI Contract (What UI expects)

### Search results need
- `svs_id`, `title`, `snippet`, `published_date`
- `canonical_url`
- `thumbnail_url` (optional but recommended)
- `media_types[]`
- `tags[]`
- `score`
- `facets` (optional MVP)

### Page detail needs
- Full description + credits + tags
- Asset list with file variants
- Related page list

### Chat needs
- Streaming tokens
- Citation events with:
  - `svs_id`, `title`, `chunk_id`, `section`, `anchor`, `excerpt`

---

## 7) Visual Hierarchy Wireframe Notes (Text-Only)

### Search Results
- Top: query + active chips + sort
- Left: filters
- Right: cards (thumb → title → snippet → badges)

### Page Detail
- Hero: title + ID + external link + preview
- Below: description (left), metadata (right)
- Then: assets gallery
- Then: related pages

### Chat
- Thread centered
- Citations panel right
- Each assistant answer has inline citation badges

---

## 8) MVP Timeline Alignment (UI Work Plan)

### Sprint 1 (Weeks 1–2)
- AppShell + routing
- Placeholder pages
- API client scaffolding

### Sprint 3 (Weeks 5–6)
- Search UI + filters + results
- Page detail + asset gallery
- Basic asset detail view

### Sprint 4 (Weeks 7–8)
- Chat UI + citations
- Evidence popover
- “Ask about this page” entrypoints

### Sprint 5 (Weeks 9–10)
- Polish + responsive pass
- Performance tuning + caching
- Accessibility pass
- Error states + telemetry hooks

---

## 9) P1 UI Extensions (Post-MVP)

- Browse by:
  - mission, domain, target body, year
- Autosuggest + typeahead entities
- Knowledge graph visualization (Cytoscape.js):
  - Page ↔ Concept ↔ Mission ↔ Asset
- Collections:
  - save pages/assets, tag, notes
- Admin dashboard:
  - ingestion runs, failures, retry buttons
  - embedding coverage and drift checks

---

## 10) Acceptance Criteria (UI)

### MVP acceptance
- Users can search and reach desired SVS pages within 2–3 clicks.
- Page detail shows:
  - correct title, description, assets, download links
- Chat answers include citations that resolve to indexed SVS sources.
- UI usable on desktop and tablet; mobile readable.

---

## 11) Component Specifications

Detailed specifications for core search/browse components.

### 11.1 SearchBar

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `""` | Current search query |
| `onChange` | `(value: string) => void` | required | Query change handler |
| `onSubmit` | `() => void` | required | Submit handler |
| `placeholder` | `string` | `"Search visualizations..."` | Placeholder text |
| `variant` | `"hero" \| "compact"` | `"hero"` | Size variant |
| `autoFocus` | `boolean` | `false` | Auto-focus on mount |
| `isLoading` | `boolean` | `false` | Show loading spinner |

**States:**
- `default`: Ready for input
- `focused`: Blue ring (`ring-2 ring-blue-500`), elevated shadow
- `loading`: Spinner replaces search icon
- `error`: Red border, error message below

**Variants:**
- `hero`: Large input (`py-4 text-lg`), prominent button, centered layout
- `compact`: Smaller input (`py-2 text-sm`), icon-only button, inline in header

**Keyboard:**
- `Enter`: Submit search
- `Escape`: Clear input and blur
- `/` (global): Focus search bar

---

### 11.2 ResultCard

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `result` | `SearchResult` | required | Result data object |
| `onClick` | `() => void` | required | Navigate to detail |
| `onAskAI` | `() => void` | optional | "Ask AI about this" handler |
| `onCopyLink` | `() => void` | optional | Copy SVS link handler |
| `isSelected` | `boolean` | `false` | Keyboard navigation highlight |

**SearchResult interface:**
```typescript
interface SearchResult {
  svs_id: number;
  title: string;
  snippet: string;
  published_date: string | null;
  canonical_url: string;
  thumbnail_url: string | null;
  media_types: ("video" | "image" | "data")[];
  tags: string[];
  score: number;
}
```

**Layout:**
- Horizontal flex: thumbnail (`w-32 lg:w-48`) | content
- Content: title (`font-bold`) + snippet (`text-sm text-gray-600`) + tags (badges)
- Date: right-aligned, `text-xs text-gray-500`
- Actions: appear on hover, icon buttons with tooltips

**States:**
- `default`: Standard appearance
- `hover`: Slight background (`bg-gray-50`), show action buttons
- `selected`: Blue left border, background highlight (keyboard nav)
- `loading`: Skeleton placeholder

---

### 11.3 FilterSidebar

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filters` | `FilterState` | required | Current filter values |
| `facets` | `FacetCounts` | required | Available options with counts |
| `onChange` | `(filters: FilterState) => void` | required | Filter change handler |
| `onApply` | `() => void` | required | Apply filters (mobile) |
| `onClear` | `() => void` | required | Clear all filters |
| `isOpen` | `boolean` | `true` | Drawer state (mobile) |

**FilterState interface:**
```typescript
interface FilterState {
  media_types: ("video" | "image" | "data")[];
  date_from: string | null;
  date_to: string | null;
  domains: string[];
  missions: string[];
}

interface FacetCounts {
  media_types: { video: number; image: number; data: number };
  domains: Record<string, number>;
  missions: Record<string, number>;
}
```

**Filter Groups:**
1. **Media Type** - checkboxes with counts ("Video 1,247")
2. **Date Range** - date pickers (from/to)
3. **Domain/Topic** - expandable checkbox list
4. **Mission** - expandable checkbox list with search

**Responsive:**
- Desktop (lg+): Fixed sidebar, `w-1/4`, `sticky top-4`
- Mobile (<lg): Slide-out drawer, triggered by filter icon button

---

### 11.4 Pagination

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentPage` | `number` | required | Current page (1-indexed) |
| `totalPages` | `number` | required | Total pages |
| `totalResults` | `number` | required | Total result count |
| `pageSize` | `number` | `20` | Results per page |
| `onPageChange` | `(page: number) => void` | required | Page change handler |
| `onPageSizeChange` | `(size: number) => void` | optional | Page size change |

**Layout:**
- Left: "Showing X-Y of Z results"
- Center: Page numbers with ellipsis
- Right: "Items per page" dropdown (optional)

**Page Number Display:**
- Show: First, last, current ±2, ellipsis for gaps
- Example: `1 ... 4 5 [6] 7 8 ... 42`

**Keyboard:**
- `←` / `→`: Previous/next page (when pagination focused)

---

## 12) Responsive Design System

### Breakpoints

| Name | Min Width | Use Case |
|------|-----------|----------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Tablet landscape / small desktop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

### Layout Adaptations

#### Homepage
| Breakpoint | Grid | Search | Cards |
|------------|------|--------|-------|
| Mobile (<md) | Stack | Full-width | 1 column |
| Tablet (md-lg) | Stack | Centered 80% | 2 columns |
| Desktop (lg+) | Sections | Centered 60% | 3 columns |

#### Search Results
| Breakpoint | Sidebar | Results |
|------------|---------|---------|
| Mobile (<md) | Drawer (hidden) | Full width |
| Tablet (md-lg) | Collapsible | Full when collapsed |
| Desktop (lg+) | Fixed 25% | 75% |

#### Page Detail
| Breakpoint | Layout | Assets |
|------------|--------|--------|
| Mobile (<md) | Single column | 1-column grid |
| Tablet (md+) | Content + sidebar | 2-column grid |
| Desktop (lg+) | Content (60%) + sidebar (40%) | 3-column grid |

#### Chat
| Breakpoint | Citations Panel | Input |
|------------|-----------------|-------|
| Mobile (<md) | Modal on demand | Fixed bottom |
| Desktop (lg+) | Right sidebar 30% | Bottom of thread |

### Touch Considerations
- Minimum touch target: 44x44px
- Spacing between targets: 8px minimum
- Swipe gestures: drawer open/close, card dismiss

---

## 13) Accessibility Requirements (WCAG 2.1 AA)

### Color & Contrast
- Text contrast ratio: ≥ 4.5:1 (normal text)
- Large text contrast: ≥ 3:1 (18px+ or 14px bold)
- Non-text contrast: ≥ 3:1 (icons, borders, focus rings)
- Never convey information by color alone

### Focus Management
- Visible focus indicator on all interactive elements
- Focus ring: `ring-2 ring-blue-500 ring-offset-2`
- Skip link: "Skip to main content" as first focusable element
- Modal focus trap: focus stays within modal until closed
- Return focus: after modal close, return to trigger element

### Keyboard Navigation
- All interactive elements reachable via Tab
- Logical tab order (left-to-right, top-to-bottom)
- Arrow keys for widget navigation (tabs, menus, grids)
- Enter/Space to activate buttons and links
- Escape to close modals, drawers, popovers

### Screen Readers
- Semantic HTML: use appropriate elements (`button`, `nav`, `main`, `article`)
- ARIA labels for icon-only buttons: `aria-label="Search"`
- ARIA live regions for dynamic content:
  - Search results: `aria-live="polite"`
  - Chat messages: `aria-live="polite"`
  - Errors: `aria-live="assertive"`
- Heading hierarchy: h1 → h2 → h3 (no skipping)

### Motion
- Respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- No auto-playing video with audio
- Provide pause controls for animations

### Forms
- Labels associated with inputs (`htmlFor`/`id`)
- Error messages linked to inputs (`aria-describedby`)
- Required fields marked (`aria-required="true"`)
- Clear error states with text descriptions

---

## 14) Keyboard Shortcuts

### Global
| Key | Action |
|-----|--------|
| `/` | Focus search bar |
| `Escape` | Close modal/drawer/popover |
| `?` | Open keyboard shortcuts help (P1) |

### Search Results
| Key | Action |
|-----|--------|
| `j` / `↓` | Move to next result |
| `k` / `↑` | Move to previous result |
| `Enter` | Open selected result |
| `o` | Open in new tab |
| `c` | Copy SVS link |

### Page Detail
| Key | Action |
|-----|--------|
| `a` | Jump to assets section |
| `r` | Jump to related pages |
| `d` | Download primary asset |

### Chat
| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Escape` | Cancel current generation |
| `↑` | Edit last message (when input empty) |

---

## 15) Form Validation Patterns

### Search Input
| Rule | Value | Error Message |
|------|-------|---------------|
| Min length | 1 (after trim) | "Please enter a search term" |
| Max length | 500 characters | "Search query is too long (max 500 characters)" |
| Debounce | 300ms | — |

### SVS ID Input
| Rule | Value | Error Message |
|------|-------|---------------|
| Format | Numeric only | "Please enter numbers only" |
| Range | 1-99999 | "Please enter a valid SVS ID (1-99999)" |
| Required | Yes | "Please enter an SVS ID" |

### Chat Composer
| Rule | Value | Error Message |
|------|-------|---------------|
| Min length | 1 (after trim) | "Please enter a message" |
| Max length | 2000 characters | "Message is too long (max 2000 characters)" |
| Rate limit | 1 per 2s | "Please wait before sending another message" |

### Date Range Filters
| Rule | Value | Error Message |
|------|-------|---------------|
| Format | YYYY-MM-DD | "Please use format: YYYY-MM-DD" |
| Logical | from ≤ to | "Start date must be before end date" |
| Range | 1990-01-01 to today | "Date must be between 1990 and today" |

---

## 16) Empty & Error States

### No Search Results
```
Title: "No visualizations found"
Body: "We couldn't find any visualizations matching your search. Try adjusting your filters or using different keywords."
Actions: [Clear filters] [Search tips]
```

### Chat Error
```
Title: "Couldn't get a response"
Body: "There was a problem connecting to the AI assistant. This might be temporary."
Actions: [Try again] [Start new chat]
```

### Page Not Found (404)
```
Title: "SVS page not found"
Body: "This visualization may have been removed, or the ID might be incorrect."
Actions: [Search for visualizations] [Browse recent]
```

### Asset Not Found
```
Title: "Asset not available"
Body: "This asset file could not be found. It may have been moved or removed from the NASA servers."
Actions: [View parent page] [Report issue]
```

### Network Error
```
Title: "Connection problem"
Body: "We're having trouble connecting to the server. Please check your internet connection and try again."
Actions: [Retry] [Refresh page]
```

### Empty Chat History
```
Title: "Start a conversation"
Body: "Ask questions about NASA visualizations, missions, or scientific topics. Your answers will include citations to SVS sources."
Suggestions: ["What visualizations show Mars?", "Tell me about the James Webb telescope", "How does solar wind affect Earth?"]
```

---

## 17) Icon Library

**Package:** Lucide React (`lucide-react`)
**License:** MIT
**Style:** Stroke icons, 24x24 default

### Icon Mapping

| Use Case | Icon Name | Component |
|----------|-----------|-----------|
| Search | `Search` | `<Search />` |
| Close/Dismiss | `X` | `<X />` |
| External link | `ExternalLink` | `<ExternalLink />` |
| Download | `Download` | `<Download />` |
| Play video | `Play` | `<Play />` |
| Copy to clipboard | `Copy` | `<Copy />` |
| Success/Check | `Check` | `<Check />` |
| Error/Alert | `AlertCircle` | `<AlertCircle />` |
| Info | `Info` | `<Info />` |
| Menu (hamburger) | `Menu` | `<Menu />` |
| Filter | `Filter` | `<Filter />` |
| Sort | `ArrowUpDown` | `<ArrowUpDown />` |
| Calendar/Date | `Calendar` | `<Calendar />` |
| Chat/Message | `MessageSquare` | `<MessageSquare />` |
| Image | `Image` | `<Image />` |
| Video | `Video` | `<Video />` |
| File/Data | `FileText` | `<FileText />` |
| Chevron right | `ChevronRight` | `<ChevronRight />` |
| Chevron down | `ChevronDown` | `<ChevronDown />` |
| Loading | `Loader2` | `<Loader2 className="animate-spin" />` |

### Icon Sizes
| Context | Size | Tailwind |
|---------|------|----------|
| Button icon | 16px | `w-4 h-4` |
| Inline with text | 20px | `w-5 h-5` |
| Standalone | 24px | `w-6 h-6` |
| Hero/Feature | 32px | `w-8 h-8` |

---

## 18) Animation & Transitions

### Default Timing
| Property | Value |
|----------|-------|
| Duration | 150ms |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind default) |

### Specific Animations

| Element | Animation | Duration | Tailwind |
|---------|-----------|----------|----------|
| Modal open | Fade + scale | 200ms | `transition-all duration-200` |
| Drawer slide | translateX | 200ms | `transition-transform duration-200` |
| Toast enter | Fade + translateY | 150ms | `animate-in fade-in slide-in-from-bottom-4` |
| Toast exit | Fade + translateY | 100ms | `animate-out fade-out slide-out-to-bottom-4` |
| Dropdown open | Fade + scale | 100ms | `transition-all duration-100` |
| Skeleton pulse | Opacity | 2s infinite | `animate-pulse` |
| Loading spinner | Rotate | 1s infinite | `animate-spin` |
| Button hover | Background | 150ms | `transition-colors duration-150` |
| Focus ring | Ring | 150ms | `transition-shadow duration-150` |

### Reduced Motion
When `prefers-reduced-motion: reduce`:
- Replace all animations with instant transitions
- Disable skeleton pulse
- Keep focus ring transitions (accessibility requirement)

---

## 19) Browser & Device Support

### Supported Browsers
| Browser | Versions | Notes |
|---------|----------|-------|
| Chrome | Last 2 versions | Windows, macOS, Linux |
| Firefox | Last 2 versions | Windows, macOS, Linux |
| Safari | 14+ | macOS, iOS |
| Edge | Last 2 versions | Windows |

### Not Supported
- Internet Explorer (all versions)
- Safari < 14
- Opera Mini

### Device Breakdowns
| Category | Width | Experience |
|----------|-------|------------|
| Desktop | 1024px+ | Full experience, all features |
| Tablet | 768px - 1023px | Adapted layouts, collapsible sidebars |
| Mobile | 320px - 767px | Simplified UI, drawer navigation |

### Feature Support Requirements
- CSS Grid and Flexbox
- CSS Custom Properties (variables)
- ES2020 JavaScript
- Fetch API
- IntersectionObserver (for lazy loading)
- ResizeObserver (for responsive components)

---

## 20) Color Palette

### Brand Colors
| Name | Tailwind | Hex | Usage |
|------|----------|-----|-------|
| Primary | `blue-600` | #2563EB | Buttons, links, focus rings |
| Primary Hover | `blue-700` | #1D4ED8 | Button hover states |
| Secondary | `gray-600` | #4B5563 | Secondary text, icons |

### Background Colors
| Name | Tailwind | Hex | Usage |
|------|----------|-----|-------|
| Page | `white` | #FFFFFF | Main background |
| Surface | `gray-50` | #F9FAFB | Cards, panels, footer |
| Elevated | `white` + shadow | — | Modals, dropdowns |

### Text Colors
| Name | Tailwind | Hex | Usage |
|------|----------|-----|-------|
| Primary | `gray-900` | #111827 | Headings, body text |
| Secondary | `gray-600` | #4B5563 | Descriptions, labels |
| Muted | `gray-400` | #9CA3AF | Placeholders, hints |

### Semantic Colors
| Name | Tailwind | Hex | Usage |
|------|----------|-----|-------|
| Success | `green-600` | #16A34A | Success messages, confirmations |
| Warning | `amber-500` | #F59E0B | Warnings, cautions |
| Error | `red-600` | #DC2626 | Errors, destructive actions |
| Info | `blue-500` | #3B82F6 | Information, tips |

### NASA Brand (Optional Accent)
| Name | Hex | Usage |
|------|-----|-------|
| NASA Blue | #0B3D91 | Logo, special accents |
| NASA Red | #FC3D21 | Highlights (use sparingly) |

---

## Appendix A: Screenshot Reference

This appendix provides detailed component mappings based on UI mockups.

### A.1 Homepage Layout

| Component | Description | Styling |
|-----------|-------------|---------|
| `Header` | Site title, navigation, search | `flex justify-between items-center bg-white border-b` |
| `SVSBrowserTitle` | "SVS Browser" + subtitle | `font-semibold text-lg` + `text-xs` for subtitle |
| `PrimaryNav` | Search, Browse, Chat, About | `flex space-x-4 text-gray-600` |
| `MainSearch` | Hero search section | `text-center`, large input with `rounded-lg` |
| `SearchFilterPills` | Video/Image/Data/Recent tabs | `flex justify-center space-x-8` |
| `SectionHeader` | "Recent Highlights" + "View all" | `flex justify-between items-baseline font-semibold text-xl` |
| `VisualizationCardGrid` | Card grid for highlights | `grid` or `flex overflow-x-auto` |
| `VisualizationCard` | Individual highlight card | `Card` with `Image object-cover`, `p-4`, badges |
| `QuickAccessSection` | 3 feature boxes | `grid grid-cols-3 gap-6` |
| `FeatureBox` | Ask/Browse/Go to ID | `Card border text-center h-full` |
| `Footer` | 4-column links | `bg-gray-50 border-t p-8 grid grid-cols-4 text-sm` |

### A.2 Search Results Layout

| Component | Description | Styling |
|-----------|-------------|---------|
| `MainContentWrapper` | Sidebar + content split | `flex` with `w-1/4` sidebar + `w-3/4` content |
| `FilterSidebar` | Left filter panel | `sticky p-6 bg-white border-r` |
| `FilterGroup` | Filter sections | `border-b font-semibold` for titles |
| `FilterCheckboxList` | Options with counts | `Checkbox` + `flex justify-between` |
| `PillFilterContainer` | Active filters display | `flex items-center space-x-2` |
| `ActiveFilterPill` | Dismissible filter badge | `bg-blue-100 text-blue-800` + X icon |
| `ResultsHeader` | Count + sort dropdown | `flex justify-between items-center text-gray-600` |
| `VisualizationResultList` | Vertical result stack | Stacked `VisualizationResultCard` |
| `VisualizationResultCard` | Horizontal result card | `flex` with thumbnail `w-32`/`w-48` + content |
| `ResultDetails` | Title, description, date | `font-bold` title, `text-sm text-gray-700` desc |
| `ResultTags` | Tag badges | `bg-gray-100 text-xs` badges |
| `ApplyFiltersButton` | Apply button (mobile) | `bg-blue-600 w-full` |

---
