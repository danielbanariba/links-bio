"""add submissions year column

Revision ID: dfdf55999b5e
Revises: 91469e4c0110
Create Date: 2026-10-06 17:37:38.163184

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfdf55999b5e'
down_revision: Union[str, Sequence[str], None] = '91469e4c0110'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the `year` column the Submission model has had since 2026-06-15
    (be5984f) but that was never migrated into the live `submissions` table,
    causing every POST /api/metal-archive/submit to fail with a 500
    (sqlite3.OperationalError: table submissions has no column named year).

    NOT NULL with server_default='' so existing rows backfill cleanly and the
    model's own `Field(default="")` stays satisfied. batch_alter_table is
    required on SQLite: ALTER TABLE ADD COLUMN can't add a NOT NULL column
    without a default in one step, and batch mode handles the recreate.
    """
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('year', sa.String(), nullable=False, server_default='')
        )


def downgrade() -> None:
    """Drop the `year` column."""
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.drop_column('year')
