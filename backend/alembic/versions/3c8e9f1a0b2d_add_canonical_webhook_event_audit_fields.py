"""add_canonical_webhook_event_audit_fields

Revision ID: 3c8e9f1a0b2d
Revises: 2a5d3eeb2bd6
Create Date: 2026-09-20 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c8e9f1a0b2d'
down_revision: Union[str, Sequence[str], None] = '2a5d3eeb2bd6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure webhook_events table exists (e.g. fresh DB or baseline)
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()
    
    if 'webhook_events' not in tables:
        op.create_table(
            'webhook_events',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('source', sa.String(length=50), nullable=False, server_default='store'),
            sa.Column('event_type', sa.String(length=50), nullable=False),
            sa.Column('external_event_id', sa.String(length=150), nullable=True),
            sa.Column('idempotency_key', sa.String(length=150), unique=True, index=True, nullable=False),
            sa.Column('hmac_validated', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('correlation_id', sa.String(length=64), nullable=True),
            sa.Column('received_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint('source', 'external_event_id', name='uq_webhook_events_source_external_event_id')
        )
        op.create_index('ix_webhook_events_source', 'webhook_events', ['source'], unique=False)
        op.create_index('ix_webhook_events_external_event_id', 'webhook_events', ['external_event_id'], unique=False)
        op.create_index('ix_webhook_events_correlation_id', 'webhook_events', ['correlation_id'], unique=False)
    else:
        # Table already exists; add the new columns safely
        existing_cols = [c['name'] for c in insp.get_columns('webhook_events')]
        existing_constraints = [c['name'] for c in insp.get_unique_constraints('webhook_events')]
        existing_indexes = [i['name'] for i in insp.get_indexes('webhook_events')]
        with op.batch_alter_table('webhook_events', schema=None) as batch_op:
            if 'source' not in existing_cols:
                batch_op.add_column(sa.Column('source', sa.String(length=50), nullable=False, server_default='store'))
            if 'ix_webhook_events_source' not in existing_indexes:
                batch_op.create_index('ix_webhook_events_source', ['source'], unique=False)

            if 'external_event_id' not in existing_cols:
                batch_op.add_column(sa.Column('external_event_id', sa.String(length=150), nullable=True))
            if 'ix_webhook_events_external_event_id' not in existing_indexes:
                batch_op.create_index('ix_webhook_events_external_event_id', ['external_event_id'], unique=False)

            if 'hmac_validated' not in existing_cols:
                batch_op.add_column(sa.Column('hmac_validated', sa.Boolean(), nullable=False, server_default='0'))

            if 'correlation_id' not in existing_cols:
                batch_op.add_column(sa.Column('correlation_id', sa.String(length=64), nullable=True))
            if 'ix_webhook_events_correlation_id' not in existing_indexes:
                batch_op.create_index('ix_webhook_events_correlation_id', ['correlation_id'], unique=False)

            if 'received_at' not in existing_cols:
                batch_op.add_column(sa.Column('received_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))

            if 'uq_webhook_events_source_external_event_id' not in existing_constraints:
                try:
                    batch_op.create_unique_constraint(
                        'uq_webhook_events_source_external_event_id',
                        ['source', 'external_event_id']
                    )
                except Exception:
                    pass


def downgrade() -> None:
    with op.batch_alter_table('webhook_events', schema=None) as batch_op:
        batch_op.drop_constraint('uq_webhook_events_source_external_event_id', type_='unique')
        batch_op.drop_index('ix_webhook_events_correlation_id')
        batch_op.drop_index('ix_webhook_events_external_event_id')
        batch_op.drop_index('ix_webhook_events_source')
        batch_op.drop_column('received_at')
        batch_op.drop_column('correlation_id')
        batch_op.drop_column('hmac_validated')
        batch_op.drop_column('external_event_id')
        batch_op.drop_column('source')
