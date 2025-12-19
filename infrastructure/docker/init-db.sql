-- Initialize PostgreSQL extensions for SVS Browser

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation (backup for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
