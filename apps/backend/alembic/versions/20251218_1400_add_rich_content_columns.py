"""add_rich_content_columns

Revision ID: add_rich_content
Revises: 83b2520745cd
Create Date: 2025-12-18 14:00:00.000000

Add columns for storing rich content with HTML formatting:
- svs_page.content_json: JSONB with structured paragraphs and sanitized HTML
- asset.caption_html: HTML caption for the asset
- asset.caption_text: Plain text caption for search/accessibility
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_rich_content"
down_revision: str | None = "83b2520745cd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add rich content columns."""
    # Add content_json to svs_page for structured content with HTML
    op.add_column("svs_page", sa.Column("content_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Add caption fields to asset
    op.add_column("asset", sa.Column("caption_html", sa.Text(), nullable=True))
    op.add_column("asset", sa.Column("caption_text", sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove rich content columns."""
    op.drop_column("asset", "caption_text")
    op.drop_column("asset", "caption_html")
    op.drop_column("svs_page", "content_json")
