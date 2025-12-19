"""Add thumbnail_storage_uri column to svs_page.

Revision ID: add_thumbnail_storage
Revises: add_rich_content
Create Date: 2025-12-18 22:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_thumbnail_storage"
down_revision: Union[str, None] = "add_rich_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add thumbnail_storage_uri column for local thumbnail caching."""
    op.add_column(
        "svs_page",
        sa.Column("thumbnail_storage_uri", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    """Remove thumbnail_storage_uri column."""
    op.drop_column("svs_page", "thumbnail_storage_uri")
