"""Application configuration using pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "SVS Browser API"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://svs:svspassword@localhost:5432/svs_browser"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MinIO / S3
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "svs-assets"
    minio_secure: bool = False

    # Embedding
    embedding_backend: str = "local"  # local | openai
    embedding_model: str = "BAAI/bge-large-en-v1.5"  # Local: HuggingFace model, OpenAI: model name
    embedding_dims: int = 1024  # BGE-large dimension (1024) or OpenAI (1536)

    # LLM
    llm_backend: str = "openai"  # ollama | openai | anthropic | bedrock
    llm_model: str = "gpt-4o"  # Model to use for chat
    ollama_base_url: str = "http://localhost:11434"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Rate Limiting
    rate_limit_search: int = 60  # requests per minute
    rate_limit_chat: int = 20  # requests per minute
    rate_limit_admin: int = 30  # requests per minute

    # Admin
    admin_api_key: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3010"]

    # Logging
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
