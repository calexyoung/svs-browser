# NASA SVS Browser - Implementation Plan

## Overview
Web application providing searchable, AI-augmented access to NASA's Scientific Visualization Studio archive (~10,300 visualizations). Features hybrid search (keyword + vector + graph) and RAG-powered Q&A with citations.

## UI Goals & Design Principles
- **Find** SVS pages and assets quickly (faster than SVS site search)
- **Understand** what a visualization shows (context + provenance)
- **Use** assets (download, preview, formats, sizes)
- **Ask** questions with **grounded answers + citations**

### Design Principles
- **Metadata-first, media-rich:** show key fields immediately; previews when useful
- **Progressive disclosure:** start simple; expand details on demand
- **Always cite:** AI responses must link to SVS page(s)/assets/chunks
- **Fast by default:** paginated lists, cached queries, lazy asset loading
- **NASA-friendly:** clean, accessible, documentation-heavy UX

---

## Repository Structure
```
svs-browser/
├── apps/
│   ├── backend/                      # FastAPI (Python)
│   │   ├── alembic/                  # Database migrations
│   │   │   └── versions/
│   │   ├── app/
│   │   │   ├── main.py               # FastAPI entry point
│   │   │   ├── config.py             # Settings & env vars
│   │   │   ├── api/v1/               # Endpoints
│   │   │   │   ├── search.py         # /search
│   │   │   │   ├── pages.py          # /svs/{id}
│   │   │   │   ├── assets.py         # /assets/{id}
│   │   │   │   ├── chat.py           # /chat/query
│   │   │   │   └── admin.py          # Admin endpoints
│   │   │   ├── models/               # SQLAlchemy models
│   │   │   │   ├── page.py           # SVS_PAGE
│   │   │   │   ├── asset.py          # ASSET, ASSET_FILE
│   │   │   │   ├── tag.py            # TAG, PAGE_TAG
│   │   │   │   ├── chunk.py          # Text chunks
│   │   │   │   ├── embedding.py      # EMBEDDING
│   │   │   │   └── ingest.py         # INGEST_RUN, INGEST_ITEM
│   │   │   ├── schemas/              # Pydantic request/response
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── search.py         # Hybrid search
│   │   │   │   ├── retrieval.py      # RAG retrieval
│   │   │   │   ├── embedding.py      # Embedding generation
│   │   │   │   └── llm.py            # LLM abstraction
│   │   │   └── ingestion/            # Crawler & parsers
│   │   │       ├── api_client.py     # SVS API client
│   │   │       ├── html_parser.py    # BeautifulSoup parser
│   │   │       ├── chunker.py        # Text chunking
│   │   │       └── pipeline.py       # Orchestration
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   └── frontend/                     # Next.js (TypeScript)
│       ├── src/
│       │   ├── app/                  # Next.js App Router
│       │   │   ├── page.tsx          # Home / Search
│       │   │   ├── search/page.tsx   # Search results
│       │   │   ├── svs/[id]/page.tsx # Page detail
│       │   │   ├── assets/[id]/page.tsx # Asset detail
│       │   │   ├── chat/page.tsx     # AI chat
│       │   │   └── about/page.tsx    # About / Help
│       │   ├── components/
│       │   │   ├── layout/           # AppShell, TopNav, GlobalSearchInput
│       │   │   ├── search/           # SearchBar, SearchFilters, FilterChipGroup,
│       │   │   │                     # SortMenu, ResultCard, Pagination
│       │   │   ├── page/             # PageHeader, MediaHero, MetadataSummary,
│       │   │   │                     # DescriptionSection, CreditsBlock,
│       │   │   │                     # AssetGallery, RelatedPagesList
│       │   │   ├── asset/            # AssetHero, AssetMetadataGrid, FileVariantsTable
│       │   │   ├── chat/             # ChatContainer, ChatMessage, ChatComposer,
│       │   │   │                     # CitationBadge, CitationsPanel, EvidencePopover
│       │   │   └── utility/          # Skeleton, EmptyState, ErrorBoundary, Toast
│       │   ├── hooks/                # useSearch, useChat, usePage, useDebounce
│       │   ├── lib/                  # API client, utils
│       │   └── types/                # TypeScript types
│       ├── tailwind.config.js
│       ├── package.json
│       └── Dockerfile
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml        # Local development
│   │   └── .env.example
│   └── aws/                          # CloudFormation/Terraform
│
├── docs/
│   ├── architecture/
│   ├── development/
│   └── deployment/
│
├── .github/workflows/                # CI/CD
├── CLAUDE.md
├── README.md
└── Makefile
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic |
| Frontend | Next.js 14, TypeScript, TailwindCSS, Cytoscape.js |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis |
| Object Storage | MinIO (local) / S3 (production) |
| Embeddings | sentence-transformers (BAAI/bge-large-en-v1.5) |
| LLM Framework | LangChain |
| LLM Backends | Ollama (local), OpenAI, Anthropic, AWS Bedrock |
| Graph (P1) | Neo4j or Amazon Neptune |

---

## Implementation Phases

### Phase 1: Weeks 1-2 - Foundations + Schema

#### Week 1: Repository Setup & Infrastructure

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Initialize monorepo structure | Git repo with folder structure |
| 1 | Set up Python backend with FastAPI skeleton | `apps/backend/` with `/health` endpoint |
| 2 | Set up Next.js frontend with TypeScript | `apps/frontend/` with TailwindCSS |
| 2 | Create Docker Compose for local dev | PostgreSQL + pgvector running |
| 3 | Configure Alembic for migrations | Migration infrastructure ready |
| 3 | Create initial database schema (core tables) | `svs_page`, `asset`, `asset_file` |
| 4 | Add remaining schema tables | `tag`, `page_tag`, `svs_page_relation`, chunks |
| 5 | Add pgvector extension and EMBEDDING table | Vector storage ready |

#### Week 2: API Skeleton & CI/CD

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Create SQLAlchemy models for all tables | Complete ORM layer |
| 2 | Create Pydantic schemas for API | Request/response models |
| 2 | Implement basic CRUD endpoints for pages | `/svs/{id}` working |
| 3 | Set up GitHub Actions CI pipeline | Automated testing on PR |
| 3 | Configure linting (ruff, eslint, prettier) | Code quality gates |
| 4 | Create frontend layout components | Header, Footer, Navigation |
| 4 | Set up API client in frontend | Fetch wrapper with types |
| 5 | Integration test: frontend calls backend | End-to-end connection verified |

**Exit Criteria:**
- Docker Compose starts all services (postgres, backend, frontend)
- Database schema applied via migrations
- `/health` endpoint returns 200
- Frontend loads and displays placeholder content

---

### Phase 2: Weeks 3-4 - Ingestion v1

#### Week 3: SVS API Client & Discovery

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Implement SVS Search API client | `api_client.py` with pagination |
| 1 | Add rate limiting and retry logic | Polite crawler behavior |
| 2 | Implement SVS Page API client | Fetch detailed page data |
| 2 | Create ingestion pipeline orchestrator | `pipeline.py` with async jobs |
| 3 | Implement API discovery phase | Populate `svs_page` from API |
| 3 | Add progress tracking and logging | `ingest_run`, `ingest_item` records |
| 4 | Test full API ingestion (subset) | 100 pages ingested correctly |
| 5 | Run full discovery (all ~10,300 pages) | Complete `svs_page` baseline |

#### Week 4: HTML Crawling & Asset Extraction

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Implement HTML parser for SVS pages | Extract description, credits |
| 1 | Parse media groups and download links | `asset`, `asset_file` population |
| 2 | Extract and normalize tags/keywords | `tag`, `page_tag` records |
| 2 | Parse related pages | `svs_page_relation` records |
| 3 | Implement text chunking strategy | `page_text_chunk` creation |

**Text Chunking Parameters:**
- **Chunk size:** 512 tokens (target), 768 tokens (max)
- **Overlap:** 64 tokens between adjacent chunks
- **Boundaries:** Respect section boundaries (description, credits, captions)
- **Sentence integrity:** Never split mid-sentence
- **Minimum chunk:** 50 tokens (smaller text attached to previous chunk)

**Section types for `page_text_chunk.section`:**
- `description` - Main page description
- `credits` - Credits and attribution
- `download_notes` - Download/usage instructions
- `other` - Miscellaneous text

**Section types for `asset_text_chunk.section`:**
- `caption` - Image/video captions
- `transcript` - Video transcripts
- `readme` - Data file documentation
- `other` - Miscellaneous text

| 3 | Add content hashing for deduplication | Avoid duplicate chunks |
| 4 | Create admin CLI for ingestion | `python -m app.ingestion run` |
| 4 | Add error recovery and resume capability | Resumable pipeline |
| 5 | Full HTML crawl (subset for MVP) | 500+ pages fully enriched |

**Exit Criteria:**
- Database contains 10,000+ `svs_page` records (from API)
- 500+ pages have full HTML-extracted content
- Assets and files catalogued
- Tags normalized and linked
- Ingestion logs show success/error breakdown

---

### Phase 3: Weeks 5-6 - Search v1 + UI Browse

#### Week 5: Backend Search Implementation

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Implement keyword search (Postgres FTS) | Full-text search on title/description |
| 1 | Add filter support (media type, date range) | Query parameters working |
| 2 | Implement pagination with cursor/offset | Efficient large result sets |
| 2 | Add sorting options (date, relevance) | Sort parameter |
| 3 | Create search response aggregations | Facet counts for filters |
| 3 | Optimize queries with indexes | GIN indexes on text fields |
| 4 | Implement `/svs/{id}` with full details | Page detail endpoint complete |
| 4 | Implement `/assets/{id}` endpoint | Asset metadata endpoint |
| 5 | Add OpenAPI documentation | Auto-generated Swagger UI |

#### Week 6: Frontend Search UI

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Build SearchBar component | Auto-complete, keyboard navigation |
| 1 | Build SearchFilters component | Media type, date filters |
| 2 | Build SearchResults list | Paginated result cards |
| 2 | Build ResultCard component | Title, snippet, thumbnail, tags |
| 3 | Build Page detail view layout | Full page information |
| 3 | Build AssetGallery component | Grid of downloadable assets |
| 4 | Build RelatedPages component | Links to related SVS pages |
| 4 | Add loading states and error handling | Skeleton loaders, error boundaries |
| 5 | Mobile responsive design pass | Works on tablet/mobile |

**Exit Criteria:**
- Search returns relevant results for keywords
- Filters narrow results correctly
- Page detail view shows all metadata and assets
- Related pages link works
- UI is responsive and polished

---

### Phase 4: Weeks 7-8 - RAG v1

#### Week 7: Embeddings & Vector Search

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Set up sentence-transformers (BGE-large) | Embedding model loaded |
| 1 | Create embedding service | Generate embeddings for text |
| 2 | Implement batch embedding pipeline | Process all text chunks |
| 2 | Store embeddings in pgvector | `embedding` table populated |
| 3 | Implement vector similarity search | `<->` operator queries |
| 3 | Create hybrid retrieval service | Combine keyword + vector |
| 4 | Implement result ranking/fusion | RRF or weighted scoring |
| 4 | Add retrieval caching (Redis) | Performance optimization |
| 5 | Test retrieval quality | Measure recall on sample queries |

#### Week 8: LLM Integration & Chat UI

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Set up LangChain with pluggable backends | Support Ollama + OpenAI |
| 1 | Create LLM service abstraction | Switch backends via config |
| 2 | Implement context builder | Assemble retrieved chunks |
| 2 | Create RAG prompt templates | System prompt + citations |

**System Prompt Template:**
```
You are an assistant for NASA's Scientific Visualization Studio (SVS) archive.
Your role is to answer questions about NASA visualizations, missions, and scientific content.

CRITICAL RULES:
1. ONLY use information from the provided context
2. For EVERY factual statement, cite the source as [SVS-{id}]
3. If the context doesn't contain the answer, say: "I couldn't find information about that in the indexed SVS archive. Try searching for [suggested terms]."
4. Never invent or hallucinate information
5. Be concise but complete

Context from SVS archive:
{retrieved_chunks}
```

**User Prompt Template:**
```
Question: {user_query}

Provide a helpful answer citing your sources.
```

**Citation Extraction Pattern:**
- Parse response for `[SVS-XXXX]` patterns
- Map to chunk_id and svs_id for citation metadata
- Validate cited SVS IDs exist in context

| 3 | Implement `/chat/query` endpoint | Streaming response support |
| 3 | Add citation extraction from response | Link back to SVS pages |
| 4 | Build ChatContainer component | Message list, input |
| 4 | Build ChatMessage component | User/assistant styling |
| 5 | Build Citation component | Clickable source links |
| 5 | Add conversation history | Multi-turn context |

**Exit Criteria:**
- Embeddings generated for all text chunks
- Vector search returns semantically relevant results
- Chat endpoint answers questions about SVS content
- Responses include accurate citations
- Chat UI supports multi-turn conversation

---

### Phase 5: Weeks 9-10 - Hardening + Packaging

#### Week 9: Performance & Observability

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Add database connection pooling | SQLAlchemy pool config |
| 1 | Implement response caching | Cache frequent queries |
| 2 | Add API rate limiting | Prevent abuse |
| 2 | Optimize embedding batch size | Memory management |
| 3 | Add structured logging (JSON) | Log aggregation ready |
| 3 | Add basic metrics (Prometheus) | Request latency, error rates |
| 4 | Create health check endpoints | `/health`, `/ready` |
| 4 | Add database migration checks | Startup validation |
| 5 | Load testing | Identify bottlenecks |

#### Week 10: Documentation & Deployment

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Write local deployment guide | Step-by-step Docker setup |
| 1 | Write developer onboarding docs | Getting started guide |
| 2 | Create AWS reference architecture | CloudFormation/Terraform |
| 2 | Document environment variables | All config options |
| 3 | Security hardening | API key auth for admin |
| 3 | Add CORS configuration | Production origins |
| 4 | Create runbooks | Common operations |
| 4 | Final integration testing | All features verified |
| 5 | Tag MVP release | v0.1.0 release |

**Exit Criteria:**
- Application handles concurrent load
- Logs and metrics exportable
- Deployment documentation complete
- Security basics implemented
- MVP release tagged and documented

---

## API Endpoints

### Search
```
GET /api/v1/search
  ?q=mars                    # Search query (required)
  &media_type=video,image    # Filter by type
  &domain=heliophysics       # Filter by domain
  &mission=MAVEN             # Filter by mission
  &date_from=2020-01-01      # Published after
  &date_to=2025-12-31        # Published before
  &sort=relevance|date_desc  # Sort order
  &limit=20                  # Results per page (max 100)
  &offset=0                  # Pagination offset

UX Behavior:
- If query is numeric only (e.g., "5502"), redirect to /svs/5502 (SVS ID direct jump)
- Search by: keywords, mission, target (Mars), event (eclipse), or SVS ID

Response:
{
  "count": 1234,
  "results": [{
    "svs_id": 5502,
    "title": "Solar Storm...",
    "snippet": "...",
    "published_date": "2025-04-07",
    "canonical_url": "https://svs.gsfc.nasa.gov/5502",
    "thumbnail_url": "...",
    "media_types": ["video", "image"],
    "tags": ["Mars", "Solar Wind"],
    "score": 0.89
  }],
  "facets": {
    "media_type": {"video": 45, "image": 102},
    "domain": {"heliophysics": 23}
  },
  "next": "/api/v1/search?q=mars&offset=20",
  "previous": null
}
```

### Page Detail
```
GET /api/v1/svs/{svs_id}

Response:
{
  "svs_id": 5502,
  "title": "Solar Storm Excites Martian Magnetosphere",
  "canonical_url": "https://svs.gsfc.nasa.gov/5502",
  "published_date": "2025-04-07",
  "summary": "Full description...",
  "credits": [{"role": "Lead Animator", "name": "...", "organization": "NASA"}],
  "tags": [{"type": "keyword", "value": "Mars"}],
  "assets": [{
    "asset_id": "uuid",
    "title": "Flight A",
    "type": "video",
    "files": [{"variant": "hires", "url": "...", "mime_type": "video/mp4"}],
    "thumbnail_url": "..."
  }],
  "related_pages": [{"svs_id": 5123, "title": "...", "rel_type": "related"}]
}
```

### Asset Detail
```
GET /api/v1/assets/{asset_id}

Response:
{
  "asset_id": "uuid",
  "svs_id": 5502,
  "title": "Flight A - 4K",
  "type": "video",
  "dimensions": {"width": 3840, "height": 2160},
  "duration_seconds": 45.5,
  "files": [{
    "file_id": "uuid",
    "variant": "original",
    "url": "https://svs.gsfc.nasa.gov/vis/...",
    "mime_type": "video/mp4",
    "size_bytes": 406100000
  }],
  "thumbnails": [{"url": "...", "width": 320, "height": 180}]
}
```

### Chat (RAG)
```
POST /api/v1/chat/query
{
  "query": "How does solar wind affect Mars?",
  "conversation_id": "uuid-optional",
  "context_svs_id": 5502,              // Optional: "Ask about this page" context
  "settings": {"model": "gpt-4", "temperature": 0.7}
}

Response (streaming SSE):
event: token
data: {"content": "The solar wind "}

event: citation
data: {
  "svs_id": 5502,
  "title": "Solar Storm Excites Martian Magnetosphere",
  "chunk_id": "uuid",
  "section": "description",            // description|caption|transcript|credits
  "anchor": "#description",            // For section highlighting
  "excerpt": "2-3 line preview text..."
}

event: done
data: {"conversation_id": "uuid", "token_count": 245}
```

### Citation UX Requirements
- Every factual statement about SVS content must have a citation
- Citations show: SVS ID + title, section label, excerpt preview (2-3 lines)
- Clicking citation opens SVS page detail and highlights relevant section
- If retrieval fails: respond with "I couldn't find support in indexed SVS content"

### Admin
```
POST /api/v1/admin/ingest/run
{
  "mode": "full|incremental",
  "svs_ids": [5502, 5503],  // optional
  "skip_existing": true
}

GET /api/v1/admin/ingest/status/{run_id}
```

---

## Database Migrations

| Order | Migration | Tables Created |
|-------|-----------|----------------|
| 001 | initial_schema | `svs_page`, `asset`, `asset_file`, `asset_thumbnail` |
| 002 | tags_relations | `tag`, `page_tag`, `svs_page_relation` |
| 003 | text_chunks | `page_text_chunk`, `asset_text_chunk` |
| 004 | embeddings | `embedding` (with pgvector extension) |
| 005 | ingestion_tracking | `ingest_run`, `ingest_item` |
| 006 | indexes | GIN indexes for FTS, HNSW for vectors |

### pgvector Setup (Migration 004)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embedding (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL,
    chunk_type VARCHAR(10) NOT NULL CHECK (chunk_type IN ('page', 'asset')),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    dims INTEGER NOT NULL,
    embedding vector(1024),
    is_current BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign keys handled via application logic for polymorphic reference
    -- Validate chunk_id exists in appropriate table based on chunk_type
    CONSTRAINT valid_chunk_type CHECK (chunk_type IN ('page', 'asset'))
);

-- Indexes
CREATE INDEX embedding_hnsw_idx ON embedding
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX embedding_chunk_idx ON embedding(chunk_id, chunk_type);
CREATE INDEX embedding_model_idx ON embedding(model_name, model_version);
CREATE INDEX embedding_current_idx ON embedding(is_current) WHERE is_current = TRUE;
```

---

## Asset Storage Strategy (MVP)

### Approach: Metadata-Only with Proxied Links
For MVP, we do NOT download or store SVS assets locally:

| What We Store | What We Don't Store |
|---------------|---------------------|
| Asset metadata (dimensions, duration, format) | Actual video/image files |
| Original NASA URLs | Copies of media files |
| Generated thumbnails (optional P1) | Full-resolution assets |

### URL Handling
- All `asset_file.file_url` point to original NASA-hosted URLs
- `storage_uri` field reserved for P1 local caching
- Frontend displays NASA URLs directly for downloads

### Benefits
- No storage costs for MVP
- Always shows current NASA content
- Simpler legal/attribution handling
- Faster ingestion pipeline

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| NASA URLs change | Store `canonical_url` pattern; periodic link validation |
| NASA rate limits | Client-side download; no server proxy |
| Content disappears | `svs_page.status = 'missing'` flag; alert in UI |

### Thumbnail Strategy (P1)
- Generate thumbnails only after MVP launch
- Store in MinIO/S3 at `{bucket}/thumbnails/{asset_id}/{size}.jpg`
- Sizes: 320x180, 640x360

---

## Docker Compose Configuration

```yaml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: svs
      POSTGRES_PASSWORD: svspassword
      POSTGRES_DB: svs_browser
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"

  backend:
    build: ../../apps/backend
    environment:
      DATABASE_URL: postgresql+asyncpg://svs:svspassword@postgres:5432/svs_browser
      REDIS_URL: redis://redis:6379/0
      EMBEDDING_MODEL: BAAI/bge-large-en-v1.5
      LLM_BACKEND: ollama
      OLLAMA_BASE_URL: http://host.docker.internal:11434
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ../../apps/frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## Critical Path Dependencies

```
Week 1-2: Foundations
Repo Setup → Docker Compose → Database Schema → FastAPI Skeleton
                                    ↓
Week 3-4: Ingestion
SVS API Client → HTML Parser → Ingestion Pipeline
                                    ↓
Week 5-6: Search + UI
Search Backend → Search UI → Page Detail UI
        ↓
Week 7-8: RAG
Embedding Pipeline → Vector Search → LLM Integration → Chat UI
                                    ↓
Week 9-10: Hardening
Performance → Observability → Documentation → MVP Release
```

---

## Testing Strategy

### Testing Pyramid
- **Unit Tests (60%)**: Services, parsers, utils, isolated components
- **Integration Tests (30%)**: API tests, DB tests, component tests
- **E2E Tests (10%)**: Cypress/Playwright full user flows

### Backend Testing (pytest)
```python
# Unit test example
def test_parse_svs_page_extracts_title():
    html = load_fixture("svs_5502.html")
    result = parse_svs_page(html)
    assert result.title == "Solar Storm Excites Martian Magnetosphere"

# Integration test example
@pytest.mark.asyncio
async def test_search_returns_results(client, seeded_db):
    response = await client.get("/api/v1/search?q=mars")
    assert response.status_code == 200
    assert response.json()["count"] > 0
```

### Frontend Testing (Jest + Cypress)
```typescript
// Component test
it('calls onSearch when form submitted', async () => {
  const onSearch = jest.fn();
  render(<SearchBar onSearch={onSearch} />);
  await userEvent.type(screen.getByRole('textbox'), 'mars');
  await userEvent.click(screen.getByRole('button', { name: /search/i }));
  expect(onSearch).toHaveBeenCalledWith('mars');
});

// E2E test
it('searches and navigates to result', () => {
  cy.visit('/');
  cy.get('[data-testid="search-input"]').type('mars{enter}');
  cy.get('[data-testid="result-card"]').first().click();
  cy.url().should('match', /\/svs\/\d+/);
});
```

---

## Key Files to Create First

1. **`apps/backend/app/models/page.py`** - Core SVS_PAGE SQLAlchemy model
2. **`apps/backend/app/ingestion/api_client.py`** - SVS API client for discovery
3. **`apps/backend/app/services/retrieval.py`** - Hybrid search service
4. **`apps/frontend/src/components/search/SearchResults.tsx`** - Main search UI
5. **`infrastructure/docker/docker-compose.yml`** - Local development environment

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://svs:svspassword@localhost:5432/svs_browser

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO / S3
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Embedding
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5

# LLM
LLM_BACKEND=ollama  # ollama | openai | anthropic | bedrock
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Logging
LOG_LEVEL=INFO
```

---

## Authentication & Security

### Admin API Authentication
Admin endpoints (`/api/v1/admin/*`) require API key authentication:

```python
# Header-based API key
X-API-Key: {ADMIN_API_KEY}
```

| Endpoint Pattern | Auth Required | Notes |
|------------------|---------------|-------|
| `/api/v1/search` | None | Public read access |
| `/api/v1/svs/{id}` | None | Public read access |
| `/api/v1/assets/{id}` | None | Public read access |
| `/api/v1/chat/query` | Optional | Rate-limited per IP |
| `/api/v1/admin/*` | API Key | Full admin access |

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/search` | 60 requests | per minute per IP |
| `/chat/query` | 20 requests | per minute per IP |
| `/admin/*` | 30 requests | per minute per API key |

Exceeded limits return `429 Too Many Requests` with `Retry-After` header.

### Session Management
- Chat conversations use `conversation_id` (UUID)
- Conversations stored in Redis with 24-hour TTL
- No user accounts in MVP (anonymous sessions)
- Conversation history limited to last 10 messages

### CORS Configuration
```python
CORS_ORIGINS = [
    "http://localhost:3000",      # Local dev
    "https://svs-browser.nasa.gov" # Production (example)
]
```

---

## Error Handling

### Standard Error Response Format
All API errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {},
    "request_id": "uuid"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `LLM_UNAVAILABLE` | 503 | LLM backend unreachable |
| `RETRIEVAL_FAILED` | 500 | Vector/keyword search failed |
| `INGESTION_ERROR` | 500 | Crawl/parse failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### LLM Fallback Strategy
1. Primary: Configured LLM backend (Ollama/OpenAI/Anthropic)
2. On failure: Return cached response if available
3. On total failure: Return error with `LLM_UNAVAILABLE` code

```python
# Retry configuration
LLM_RETRY_ATTEMPTS = 3
LLM_RETRY_DELAY_MS = 1000
LLM_TIMEOUT_MS = 30000
```

### Ingestion Error Recovery
- Failed items logged to `ingest_item` with `status='error'`
- Automatic retry up to 3 times with exponential backoff
- Manual retry via admin endpoint: `POST /admin/ingest/retry/{item_id}`

---

## Core Screens (MVP)

### Home / Search (`/`)
**Layout:** Centered hero with search, grid sections below

| Section | Components | Styling |
|---------|------------|---------|
| Header | `Header`, `SVSBrowserTitle`, `PrimaryNav` | `flex justify-between items-center bg-white border-b` |
| Hero Search | `MainSearch` with large input + blue button | `text-center`, `rounded-lg` input |
| Quick Filters | `SearchFilterPills` - Video/Image/Data/Recently Released | `flex justify-center space-x-8` |
| Recent Highlights | `SectionHeader` + `VisualizationCardGrid` | Horizontal scroll or responsive grid |
| Quick Access | `QuickAccessSection` with 3 `FeatureBox` cards | `grid grid-cols-3 gap-6` |
| Footer | 4-column links | `bg-gray-50 border-t p-8 grid grid-cols-4` |

**QuickAccessSection Feature Boxes:**
1. **"Ask Questions"** → Links to Chat (`Start Chat` button)
2. **"Browse by Mission"** → Links to Browse (`Browse` button)
3. **"Direct SVS Access"** → SVS ID input (`Go to ID` button)

**VisualizationCard (Recent Highlights):**
- Image with `object-cover`
- Title (`font-semibold`), tags as `Badge`
- "View Details →" link

### Search Results (`/search?q=...`)
**Layout:** `flex` with `w-1/4` sidebar + `w-3/4` results area

| Section | Components | Styling |
|---------|------------|---------|
| Filter Sidebar | `FilterSidebar` with `FilterGroup` sections | `sticky p-6 bg-white border-r` |
| Active Filters | `PillFilterContainer` with `ActiveFilterPill` | `flex items-center space-x-2` |
| Results Header | Count + `SortMenu` dropdown | `flex justify-between items-center` |
| Results List | `VisualizationResultList` → `VisualizationResultCard` | Vertical stack |

**FilterSidebar Groups:**
- Media Type (checkboxes with counts: "Video 1,247")
- Date Range
- Domain/Topic
- Mission
- `ApplyFiltersButton` at bottom (`bg-blue-600 w-full`)

**ActiveFilterPill:** Dismissible badges (`bg-blue-100 text-blue-800` with ✕ icon)

**VisualizationResultCard:** Horizontal layout
- Left: `Thumbnail` (`w-32` or `w-48`)
- Right: Title (`font-bold`), description (`text-sm text-gray-700`), date (right-aligned)
- Tags: `Badge` components (`bg-gray-100 text-xs`)
- Quick actions: Open page, Copy SVS link, **"Ask AI about this"**

### SVS Page Detail (`/svs/{id}`)
1. **Header band** - Title, SVS ID, release date, canonical link, tags
2. **Preview panel** - Featured media (video player or hero image)
3. **Description** - Full text, expandable sections, credits block
4. **Assets** - Filterable gallery with format variants and downloads
5. **Related** - Related SVS pages list, "Similar pages" (P1)
6. **AI panel** - "Ask about this page" prefilled prompt (MVP optional / P1)

### Asset Detail (`/assets/{id}`)
- Preview (player/image)
- Metadata grid: type, format, resolution, fps, duration, checksum
- Files table: variant, url, mime type, size, filename
- Backlink to parent SVS page

### Chat / Q&A (`/chat`)
- Message thread with streaming responses
- Citations attached to answer blocks
- Citations panel (right side)
- Evidence popover showing chunk excerpt
- Clicking citation opens SVS page and highlights section

---

## MVP UI Component Inventory

### Layout
- `AppShell` - Header/footer wrapper
- `Header` - Site header container
- `SVSBrowserTitle` - Logo + "Scientific Visualization Studio" subtitle
- `PrimaryNav` - Search/Browse/Chat/About links
- `GlobalSearchInput` - Persistent search in header
- `Footer` - 4-column footer with links

### Homepage
- `MainSearch` - Hero search section (centered, large input)
- `SearchFilterPills` - Video/Image/Data/Recently Released tabs
- `SectionHeader` - "Recent Highlights" with "View all →" link
- `VisualizationCardGrid` - Horizontal scroll grid of cards
- `VisualizationCard` - Card with image, title, tags, "View Details →"
- `QuickAccessSection` - 3-column feature box grid
- `FeatureBox` - Icon + title + CTA button (Ask/Browse/Go to ID)

### Search Results
- `FilterSidebar` - Left rail filter panel (`sticky`, `w-1/4`)
- `FilterGroup` - Individual filter section (Media Type, Date, etc.)
- `FilterCheckboxList` - Checkboxes with counts ("Video 1,247")
- `ApplyFiltersButton` - Primary button (`bg-blue-600 w-full`)
- `PillFilterContainer` - Active filters wrapper
- `ActiveFilterPill` - Dismissible filter badge (`bg-blue-100`)
- `ResultsHeader` - Count + sort dropdown
- `SortMenu` - Relevance/Newest dropdown
- `VisualizationResultList` - Vertical list of results
- `VisualizationResultCard` - Horizontal card (thumb left, details right)
- `ResultTags` - Tag badges (`bg-gray-100 text-xs`)
- `Pagination` - Page navigation

### Page Detail
- `PageHeader` - Title, ID, date, external link
- `MediaHero` - Featured video/image preview
- `MetadataSummary` - Key metadata display
- `DescriptionSection` - Full text with expand
- `CreditsBlock` - Names/roles/organizations
- `AssetGallery` - Filterable asset grid
- `RelatedPagesList` - Related SVS pages

### Asset Detail
- `AssetHero` - Preview player/image
- `AssetMetadataGrid` - Technical specs
- `FileVariantsTable` - Download options

### Chat
- `ChatContainer` - Main chat wrapper
- `ChatMessage` - User/assistant messages
- `ChatComposer` - Input field + send
- `CitationBadge` - Inline citation marker
- `CitationsPanel` - Right-side citations list
- `EvidencePopover` - Chunk excerpt preview

### Utility
- `Skeleton` - Loading placeholders
- `EmptyState` - No results messaging
- `ErrorBoundary` - Error handling
- `Toast` - Notifications

---

## Tailwind Styling Tokens

### Colors & Backgrounds
```
Primary button:     bg-blue-600 hover:bg-blue-700 text-white
Active filter pill: bg-blue-100 text-blue-800
Tags/badges:        bg-gray-100 text-gray-700 text-xs
Header:             bg-white border-b
Footer:             bg-gray-50 border-t
Sidebar:            bg-white border-r
```

### Layout
```
Page wrapper:       max-w-7xl mx-auto px-4
Search results:     flex (sidebar w-1/4 + content w-3/4)
Filter sidebar:     sticky top-0 p-6
Card grid:          grid grid-cols-3 gap-6 (desktop)
Footer:             grid grid-cols-4 p-8
```

### Typography
```
Page title:         text-2xl font-bold
Section header:     text-xl font-semibold
Card title:         text-lg font-semibold
Body text:          text-sm text-gray-700
Subtitle:           text-xs text-gray-500
```

### Components
```
Search input:       rounded-lg border border-gray-300 px-4 py-3
Card:               rounded-lg border bg-white shadow-sm
Badge:              rounded-full px-2 py-1 text-xs
Button primary:     rounded-md bg-blue-600 px-4 py-2 text-white
Button secondary:   rounded-md border border-gray-300 px-4 py-2
```

---

## Performance Targets

### API Response Times (p95)

| Endpoint | Target | Max Acceptable |
|----------|--------|----------------|
| `/search` (keyword) | 200ms | 500ms |
| `/search` (hybrid with vector) | 400ms | 1000ms |
| `/svs/{id}` | 100ms | 300ms |
| `/chat/query` (time to first token) | 800ms | 2000ms |
| `/admin/ingest/run` (10 pages) | 30s | 60s |

### Ingestion Throughput
- API discovery: 1000 pages/minute
- HTML crawl + parse: 50 pages/minute (with 1s politeness delay)
- Embedding generation: 100 chunks/minute (local GPU)

### Concurrent Users
- MVP target: 50 concurrent users
- Search/browse: stateless, horizontally scalable
- Chat: limited by LLM backend capacity

---

## Post-MVP Features (P1/P2)

### P1 (Near-term)
- Knowledge graph store (Neo4j) + relationship enrichment
- Graph visualization in UI (Cytoscape.js)
- Entity extraction + normalization
- Asset preview rendering (video inline, image zoom)
- Autosuggest + typeahead entities
- Command palette: quick nav, "open SVS ID...", "jump to asset..."
- Browse by: mission, domain, target body, year

### P2 (Later)
- User accounts, collections, annotations
- Cross-link to DAAC datasets
- Scheduled incremental crawls
- Fine-grained access control
- Advanced graph-RAG retriever
- Admin dashboard: ingestion runs, failures, embedding coverage

---

## MVP Acceptance Criteria

### UI Acceptance
- Users can search and reach desired SVS pages within 2-3 clicks
- Page detail shows correct title, description, assets, download links
- Chat answers include citations that resolve to indexed SVS sources
- UI usable on desktop and tablet; mobile readable

### Functional Acceptance
- Search returns relevant results for keywords within 500ms
- Filters narrow results correctly
- All assets have working download links
- RAG responses are grounded with accurate citations
- No hallucinated content without retrieval support
