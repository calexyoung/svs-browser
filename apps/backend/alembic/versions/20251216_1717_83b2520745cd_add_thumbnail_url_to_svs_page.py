"""add_thumbnail_url_to_svs_page

Revision ID: 83b2520745cd
Revises: 001
Create Date: 2025-12-16 17:17:57.791316
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '83b2520745cd'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column('svs_page', sa.Column('thumbnail_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column('svs_page', 'thumbnail_url')
