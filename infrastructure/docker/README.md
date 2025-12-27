# SVS Browser - Docker Setup

Run the entire SVS Browser stack in isolated Docker containers with configurable ports.

## Quick Start

```bash
# From this directory (infrastructure/docker/)

# 1. Copy environment template
cp .env.example .env

# 2. (Optional) Edit .env to change ports if you have conflicts

# 3. Start all services
docker compose up -d

# 4. Run database migrations
docker compose exec backend alembic upgrade head

# 5. Access the application
# Frontend: http://localhost:3010
# Backend API: http://localhost:8010
# MinIO Console: http://localhost:9001
```

## Port Configuration

All external ports are configurable via `.env` to avoid conflicts with other projects:

| Service    | Default Port | Environment Variable |
|------------|--------------|---------------------|
| Frontend   | 3010         | `FRONTEND_PORT`     |
| Backend    | 8010         | `BACKEND_PORT`      |
| PostgreSQL | 5433         | `POSTGRES_PORT`     |
| Redis      | 6380         | `REDIS_PORT`        |
| MinIO API  | 9000         | `MINIO_API_PORT`    |
| MinIO UI   | 9001         | `MINIO_CONSOLE_PORT`|

## Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# Rebuild after code changes
docker compose build --no-cache

# Run database migrations
docker compose exec backend alembic upgrade head

# Run backend tests
docker compose exec backend pytest

# Access PostgreSQL
docker compose exec postgres psql -U svs -d svs_browser

# Access Redis CLI
docker compose exec redis redis-cli
```

## Development Mode

For frontend hot-reloading during development:

```bash
# Use the dev profile for frontend hot-reload
docker compose --profile dev up -d frontend-dev

# Or run frontend locally and only containerize backend services
docker compose up -d postgres redis minio backend
cd ../../apps/frontend && npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Frontend │  │ Backend  │  │ Postgres │  │  Redis   │    │
│  │  :3010   │─▶│  :8010   │─▶│  :5433   │  │  :6380   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                      │                                       │
│                      ▼                                       │
│               ┌──────────┐                                  │
│               │  MinIO   │                                  │
│               │  :9000   │                                  │
│               └──────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Port already in use
Edit `.env` and change the conflicting port:
```bash
# Example: if port 5433 is taken, use 5434
POSTGRES_PORT=5434
```

### Database connection issues
```bash
# Check if postgres is healthy
docker compose ps

# View postgres logs
docker compose logs postgres
```

### Reset everything
```bash
docker compose down -v
docker compose up -d
docker compose exec backend alembic upgrade head
```
