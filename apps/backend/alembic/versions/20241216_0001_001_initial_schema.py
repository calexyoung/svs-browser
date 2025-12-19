"""Initial schema - core tables.

Revision ID: 001
Revises:
Create Date: 2024-12-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial database schema."""
    # Enable required extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Create svs_page table
    op.create_table(
        "svs_page",
        sa.Column("svs_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("canonical_url", sa.String(length=500), nullable=False),
        sa.Column("published_date", sa.Date(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("credits_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("api_source", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("html_crawled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("svs_id", name=op.f("pk_svs_page")),
    )
    op.create_index("ix_svs_page_search_vector", "svs_page", ["search_vector"], postgresql_using="gin")
    op.create_index(op.f("ix_svs_page_published_date"), "svs_page", ["published_date"])
    op.create_index(op.f("ix_svs_page_status"), "svs_page", ["status"])

    # Create svs_page_relation table
    op.create_table(
        "svs_page_relation",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_svs_id", sa.Integer(), nullable=False),
        sa.Column("target_svs_id", sa.Integer(), nullable=False),
        sa.Column("relation_type", sa.String(length=50), nullable=False, server_default="related"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["source_svs_id"], ["svs_page.svs_id"], name=op.f("fk_svs_page_relation_source_svs_id_svs_page"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_svs_id"], ["svs_page.svs_id"], name=op.f("fk_svs_page_relation_target_svs_id_svs_page"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_svs_page_relation")),
    )
    op.create_index(op.f("ix_svs_page_relation_source"), "svs_page_relation", ["source_svs_id"])
    op.create_index(op.f("ix_svs_page_relation_target"), "svs_page_relation", ["target_svs_id"])

    # Create asset table
    op.create_table(
        "asset",
        sa.Column("asset_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("svs_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("media_type", sa.String(length=20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["svs_id"], ["svs_page.svs_id"], name=op.f("fk_asset_svs_id_svs_page"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("asset_id", name=op.f("pk_asset")),
    )
    op.create_index(op.f("ix_asset_svs_id"), "asset", ["svs_id"])
    op.create_index(op.f("ix_asset_media_type"), "asset", ["media_type"])

    # Create asset_file table
    op.create_table(
        "asset_file",
        sa.Column("file_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("asset_id", sa.UUID(), nullable=False),
        sa.Column("variant", sa.String(length=50), nullable=False),
        sa.Column("file_url", sa.String(length=1000), nullable=False),
        sa.Column("storage_uri", sa.String(length=1000), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("filename", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.asset_id"], name=op.f("fk_asset_file_asset_id_asset"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("file_id", name=op.f("pk_asset_file")),
    )
    op.create_index(op.f("ix_asset_file_asset_id"), "asset_file", ["asset_id"])
    op.create_index(op.f("ix_asset_file_variant"), "asset_file", ["variant"])

    # Create asset_thumbnail table
    op.create_table(
        "asset_thumbnail",
        sa.Column("thumbnail_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("asset_id", sa.UUID(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("storage_uri", sa.String(length=1000), nullable=True),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.asset_id"], name=op.f("fk_asset_thumbnail_asset_id_asset"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("thumbnail_id", name=op.f("pk_asset_thumbnail")),
    )
    op.create_index(op.f("ix_asset_thumbnail_asset_id"), "asset_thumbnail", ["asset_id"])

    # Create tag table
    op.create_table(
        "tag",
        sa.Column("tag_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tag_type", sa.String(length=50), nullable=False),
        sa.Column("value", sa.String(length=200), nullable=False),
        sa.Column("normalized_value", sa.String(length=200), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("tag_id", name=op.f("pk_tag")),
        sa.UniqueConstraint("tag_type", "normalized_value", name="uq_tag_type_value"),
    )
    op.create_index(op.f("ix_tag_type"), "tag", ["tag_type"])
    op.create_index(op.f("ix_tag_normalized_value"), "tag", ["normalized_value"])

    # Create page_tag table
    op.create_table(
        "page_tag",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("svs_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["svs_id"], ["svs_page.svs_id"], name=op.f("fk_page_tag_svs_id_svs_page"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tag.tag_id"], name=op.f("fk_page_tag_tag_id_tag"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_page_tag")),
        sa.UniqueConstraint("svs_id", "tag_id", name="uq_page_tag"),
    )
    op.create_index(op.f("ix_page_tag_svs_id"), "page_tag", ["svs_id"])
    op.create_index(op.f("ix_page_tag_tag_id"), "page_tag", ["tag_id"])

    # Create page_text_chunk table
    op.create_table(
        "page_text_chunk",
        sa.Column("chunk_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("svs_id", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(length=50), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["svs_id"], ["svs_page.svs_id"], name=op.f("fk_page_text_chunk_svs_id_svs_page"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chunk_id", name=op.f("pk_page_text_chunk")),
    )
    op.create_index(op.f("ix_page_text_chunk_svs_id"), "page_text_chunk", ["svs_id"])
    op.create_index(op.f("ix_page_text_chunk_section"), "page_text_chunk", ["section"])
    op.create_index(op.f("ix_page_text_chunk_hash"), "page_text_chunk", ["content_hash"])

    # Create asset_text_chunk table
    op.create_table(
        "asset_text_chunk",
        sa.Column("chunk_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("asset_id", sa.UUID(), nullable=False),
        sa.Column("section", sa.String(length=50), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.asset_id"], name=op.f("fk_asset_text_chunk_asset_id_asset"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chunk_id", name=op.f("pk_asset_text_chunk")),
    )
    op.create_index(op.f("ix_asset_text_chunk_asset_id"), "asset_text_chunk", ["asset_id"])
    op.create_index(op.f("ix_asset_text_chunk_section"), "asset_text_chunk", ["section"])
    op.create_index(op.f("ix_asset_text_chunk_hash"), "asset_text_chunk", ["content_hash"])

    # Create embedding table with pgvector
    op.create_table(
        "embedding",
        sa.Column("embedding_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("chunk_id", sa.UUID(), nullable=False),
        sa.Column("chunk_type", sa.String(length=10), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("dims", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(1024), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("chunk_type IN ('page', 'asset')", name="valid_chunk_type"),
        sa.PrimaryKeyConstraint("embedding_id", name=op.f("pk_embedding")),
    )
    op.create_index(op.f("ix_embedding_chunk"), "embedding", ["chunk_id", "chunk_type"])
    op.create_index(op.f("ix_embedding_model"), "embedding", ["model_name", "model_version"])
    op.create_index(
        "ix_embedding_current",
        "embedding",
        ["is_current"],
        postgresql_where=sa.text("is_current = TRUE"),
    )
    # HNSW index for vector similarity search
    op.execute("""
        CREATE INDEX ix_embedding_hnsw ON embedding
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # Create ingest_run table
    op.create_table(
        "ingest_run",
        sa.Column("run_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("config_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("run_id", name=op.f("pk_ingest_run")),
    )
    op.create_index(op.f("ix_ingest_run_status"), "ingest_run", ["status"])
    op.create_index(op.f("ix_ingest_run_started_at"), "ingest_run", ["started_at"])

    # Create ingest_item table
    op.create_table(
        "ingest_item",
        sa.Column("item_id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("svs_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("phase", sa.String(length=30), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["ingest_run.run_id"], name=op.f("fk_ingest_item_run_id_ingest_run"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("item_id", name=op.f("pk_ingest_item")),
    )
    op.create_index(op.f("ix_ingest_item_run_id"), "ingest_item", ["run_id"])
    op.create_index(op.f("ix_ingest_item_svs_id"), "ingest_item", ["svs_id"])
    op.create_index(op.f("ix_ingest_item_status"), "ingest_item", ["status"])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table("ingest_item")
    op.drop_table("ingest_run")
    op.drop_index("ix_embedding_hnsw", table_name="embedding")
    op.drop_table("embedding")
    op.drop_table("asset_text_chunk")
    op.drop_table("page_text_chunk")
    op.drop_table("page_tag")
    op.drop_table("tag")
    op.drop_table("asset_thumbnail")
    op.drop_table("asset_file")
    op.drop_table("asset")
    op.drop_table("svs_page_relation")
    op.drop_table("svs_page")
