# SVS Browser - Development Commands

.PHONY: help install dev build test lint clean docker-up docker-down migrate

# Default target
help:
	@echo "SVS Browser - Available commands:"
	@echo ""
	@echo "  make install      - Install all dependencies"
	@echo "  make dev          - Start development servers"
	@echo "  make build        - Build for production"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Run linters"
	@echo "  make clean        - Clean build artifacts"
	@echo ""
	@echo "Docker commands:"
	@echo "  make docker-up    - Start Docker services"
	@echo "  make docker-down  - Stop Docker services"
	@echo "  make docker-logs  - View Docker logs"
	@echo ""
	@echo "Database commands:"
	@echo "  make migrate      - Run database migrations"
	@echo "  make migrate-new  - Create new migration (NAME=migration_name)"

# Installation
install: install-backend install-frontend

install-backend:
	cd apps/backend && pip install -e ".[dev]"

install-frontend:
	cd apps/frontend && npm install

# Development
dev: docker-up
	@echo "Starting development servers..."
	@trap 'make docker-down' EXIT; \
	cd apps/backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 & \
	cd apps/frontend && npm run dev & \
	wait

dev-backend:
	cd apps/backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd apps/frontend && npm run dev

# Build
build: build-backend build-frontend

build-backend:
	cd apps/backend && pip install build && python -m build

build-frontend:
	cd apps/frontend && npm run build

# Testing
test: test-backend test-frontend

test-backend:
	cd apps/backend && pytest

test-frontend:
	cd apps/frontend && npm test

# Linting
lint: lint-backend lint-frontend

lint-backend:
	cd apps/backend && ruff check . && ruff format --check .

lint-frontend:
	cd apps/frontend && npm run lint && npm run typecheck

# Format
format: format-backend format-frontend

format-backend:
	cd apps/backend && ruff format . && ruff check --fix .

format-frontend:
	cd apps/frontend && npm run format

# Clean
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

# Docker
docker-up:
	cd infrastructure/docker && docker compose up -d postgres redis minio

docker-down:
	cd infrastructure/docker && docker compose down

docker-logs:
	cd infrastructure/docker && docker compose logs -f

docker-build:
	cd infrastructure/docker && docker compose build

docker-all:
	cd infrastructure/docker && docker compose up -d

# Database
migrate:
	cd apps/backend && alembic upgrade head

migrate-new:
	cd apps/backend && alembic revision --autogenerate -m "$(NAME)"

migrate-down:
	cd apps/backend && alembic downgrade -1

db-reset:
	cd infrastructure/docker && docker compose down -v postgres
	cd infrastructure/docker && docker compose up -d postgres
	@echo "Waiting for PostgreSQL to start..."
	@sleep 5
	cd apps/backend && alembic upgrade head
