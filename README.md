# NASA SVS Browser

A web application providing searchable, AI-augmented access to NASA's Scientific Visualization Studio archive.

## Features

- **Search** - Keyword and semantic search across 10,000+ SVS visualizations
- **Browse** - Filter by media type, mission, domain, and date
- **AI Chat** - Ask questions about NASA visualizations with cited answers
- **Detail Views** - Full metadata, assets, and related content for each visualization

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker and Docker Compose

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/svs-browser.git
   cd svs-browser
   ```

2. **Start infrastructure services**
   ```bash
   make docker-up
   ```

3. **Install dependencies**
   ```bash
   make install
   ```

4. **Run database migrations**
   ```bash
   make migrate
   ```

5. **Start development servers**
   ```bash
   make dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Development

### Available Commands

```bash
make help           # Show all available commands
make dev            # Start all development servers
make dev-backend    # Start backend only
make dev-frontend   # Start frontend only
make test           # Run all tests
make lint           # Run linters
make format         # Format code
```

### Project Structure

```
svs-browser/
├── apps/
│   ├── backend/        # FastAPI (Python)
│   │   ├── app/        # Application code
│   │   ├── alembic/    # Database migrations
│   │   └── tests/      # Backend tests
│   └── frontend/       # Next.js (TypeScript)
│       └── src/        # Application code
├── infrastructure/
│   └── docker/         # Docker Compose config
└── docs/               # Documentation
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp infrastructure/docker/.env.example infrastructure/docker/.env
```

See the file for all available configuration options.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/search` | Search visualizations |
| `GET /api/v1/svs/{id}` | Get page details |
| `GET /api/v1/assets/{id}` | Get asset details |
| `POST /api/v1/chat/query` | Ask AI about SVS content |
| `POST /api/v1/admin/ingest/run` | Trigger ingestion (admin) |

## Architecture

- **Backend**: FastAPI, SQLAlchemy, Alembic, pgvector
- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Database**: PostgreSQL 16 with pgvector extension
- **Cache**: Redis
- **Storage**: MinIO (local) / S3 (production)

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [UI Interface Guide](./SVS%20Browser%20UI%20Interface%20Guide.md)
- [PDR](./svs-browser%20Preliminary%20Design%20Review%20(PDR).md)

## Data Source

Data from [NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov)

## License

MIT
