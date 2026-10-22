"""add enrollment_requests table

Revision ID: ca6a02c008ec
Revises: dfdf55999b5e
Create Date: 2026-10-21 20:23:53.361479

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca6a02c008ec'
down_revision: Union[str, Sequence[str], None] = 'dfdf55999b5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create `enrollment_requests`, the table behind POST
    /api/metal-archive/enrollment (links_bio.models.enrollment).

    Additive only: a new table, nothing on an existing table is touched.
    The columns use sa.String() like the rest of the schema; Alembic's
    autogenerate wrote sqlmodel's AutoString here, which is the same VARCHAR
    on SQLite but would need an extra `import sqlmodel` in this file.
    """
    op.create_table('enrollment_requests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('guardian_name', sa.String(), nullable=False),
    sa.Column('relationship', sa.String(), nullable=False),
    sa.Column('phone', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('community', sa.String(), nullable=False),
    sa.Column('address', sa.String(), nullable=False),
    sa.Column('child_name', sa.String(), nullable=False),
    sa.Column('birth_date', sa.Date(), nullable=False),
    sa.Column('grade', sa.String(), nullable=False),
    sa.Column('current_school', sa.String(), nullable=False),
    sa.Column('household_size', sa.Integer(), nullable=False),
    sa.Column('monthly_income', sa.String(), nullable=False),
    sa.Column('reason', sa.String(), nullable=False),
    sa.Column('consent', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop `enrollment_requests` (and with it every request stored so far)."""
    op.drop_table('enrollment_requests')
