# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the NASA Scientific Visualization Studio (SVS) Knowledge Browser - a web application that provides searchable, explorable, AI-augmented access to NASA's SVS visualization archive (9,948 pages catalogued through July 2025).

**Status:** Implementation-ready. Complete design documentation available.

## Documentation Structure

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_PLAN.md` | Full technical specification: repo structure, API specs, database schema, Docker config, phased timeline |
| `SVS Browser UI Interface Guide.md` | UI/UX specifications: components, responsive design, accessibility, keyboard shortcuts, validation |
| `svs-browser Preliminary Design Review (PDR).md` | Original architecture vision and data models |
| `svs_pages.csv` | **Data file:** 9,948 SVS page entries (ID, URL, Title) through July 2025 |

## Architecture

### Seven-Layer System
1. **Ingestion & Crawling** - Two-phase hybrid: SVS API discovery → HTML crawling
2. **Data & Metadata Storage** - PostgreSQL 16 + pgvector (metadata), MinIO/S3 (assets)
3. **Knowledge Graph & Embeddings** - Neo4j/Neptune (P1), pgvector (MVP)
4. **RAG / LLM Reasoning** - Hybrid retrieval (keyword + vector) → LLM with citations
5. **Backend API** - FastAPI (Python), SQLAlchemy, Alembic
6. **Frontend** - Next.js 14, TypeScript, TailwindCSS, Lucide icons
7. **Deployment** - Docker Compose (local), ECS/EKS + RDS + S3 (AWS)

### Repository Structure
```
svs-browser/
├── apps/
│   ├── backend/           # FastAPI + SQLAlchemy
│   │   ├── app/
│   │   │   ├── api/v1/    # Endpoints: search, pages, assets, chat, admin
│   │   │   ├── models/    # SQLAlchemy models
│   │   │   ├── services/  # Business logic (search, retrieval, embedding)
│   │   │   └── ingestion/ # Crawler, parser, chunker
│   │   └── alembic/       # Database migrations
│   └── frontend/          # Next.js 14 App Router
│       └── src/
│           ├── app/       # Routes: /, /search, /svs/[id], /chat
│           ├── components/# UI components by domain
│           └── hooks/     # useSearch, useChat, usePage
├── infrastructure/
│   └── docker/            # docker-compose.yml
└── docs/
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic |
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis |
| Object Storage | MinIO (local) / S3 (production) |
| Embeddings | BAAI/bge-large-en-v1.5 (1024 dims) |
| LLM Framework | LangChain |
| LLM Backends | Ollama (local), OpenAI, Anthropic, AWS Bedrock |
| Icons | Lucide React |

## Key Technical Decisions

### Text Chunking
- **Size:** 512 tokens (target), 768 max
- **Overlap:** 64 tokens
- **Boundaries:** Respect section boundaries (description, credits, captions)

### Embedding Schema
```sql
CREATE TABLE embedding (
    chunk_id UUID NOT NULL,
    chunk_type VARCHAR(10) NOT NULL,  -- 'page' or 'asset'
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    embedding vector(1024),
    is_current BOOLEAN DEFAULT TRUE
);
```

### RAG Citation Requirements
- Every factual statement must cite `[SVS-{id}]`
- Citations include: svs_id, title, section, excerpt
- If retrieval fails: "I couldn't find information about that in the indexed SVS archive"

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/search` | GET | Hybrid search with filters, pagination |
| `/api/v1/svs/{id}` | GET | Page detail with assets, related |
| `/api/v1/assets/{id}` | GET | Asset metadata and file variants |
| `/api/v1/chat/query` | POST | RAG Q&A with streaming SSE |
| `/api/v1/admin/ingest/run` | POST | Trigger ingestion (API key required) |

### Authentication
- Public endpoints: search, svs, assets
- Rate-limited: chat (20 req/min per IP)
- API key required: admin endpoints

## UI Components (Core)

| Component | Purpose |
|-----------|---------|
| `SearchBar` | Hero/compact variants, `/` shortcut |
| `ResultCard` | Thumbnail, title, snippet, tags, actions |
| `FilterSidebar` | Media type, date, domain, mission filters |
| `Pagination` | Ellipsis display, keyboard nav |
| `ChatMessage` | User/assistant with inline citations |
| `CitationBadge` | Clickable citation with popover |

### Responsive Breakpoints
- `sm`: 640px (mobile landscape)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- Mobile: FilterSidebar becomes drawer

## SVS Data Sources

### Local Data File: `svs_pages.csv`
```csv
ID,URL,Title
1,https://svs.gsfc.nasa.gov/1/,Tidal Streams in Massive X-ray Binary Systems
...
31355,https://svs.gsfc.nasa.gov/31355/,Curiosity Postcard
```
- **Entries:** 9,948 SVS pages
- **ID Range:** 1 to 31355 (non-contiguous)
- **Coverage:** Through July 2025
- **Use:** Seed data for ingestion pipeline; validation against API discovery

### SVS Search API
```
Base: https://svs.gsfc.nasa.gov/api/search/
Params: search, missions, limit (max ~2000), offset
Response: { count, results, next, previous }
Result fields: id, url, title, description, release_date, result_type
```

## Development Commands

```bash
# Start local development (once implemented)
docker compose -f infrastructure/docker/docker-compose.yml up

# Run backend tests
cd apps/backend && pytest

# Run frontend dev server
cd apps/frontend && npm run dev

# Run database migrations
cd apps/backend && alembic upgrade head

# Trigger ingestion
python -m app.ingestion run
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Search (keyword) | < 200ms p95 |
| Search (hybrid) | < 400ms p95 |
| Chat (time to first token) | < 800ms |
| Concurrent users | 50 (MVP) |
