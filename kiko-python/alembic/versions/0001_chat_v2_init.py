"""chat v2 initial tables

Revision ID: 0001_chat_v2_init
Revises:
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


revision = '0001_chat_v2_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('last_response_id', sa.String(), nullable=True),
        sa.Column('compaction_cursor', sa.String(), nullable=True),
        sa.Column('conversation_state_version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_sessions_user_id'), 'chat_sessions', ['user_id'], unique=False)

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('reasoning_content', sa.Text(), nullable=False),
        sa.Column('usage_json', sa.JSON(), nullable=True),
        sa.Column('citations_json', sa.JSON(), nullable=True),
        sa.Column('tool_trace_json', sa.JSON(), nullable=True),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('provider_request_id', sa.String(), nullable=True),
        sa.Column('stream_protocol_version', sa.String(), nullable=False),
        sa.Column('first_token_ms', sa.Integer(), nullable=True),
        sa.Column('end_to_end_ms', sa.Integer(), nullable=True),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('message_index', sa.Integer(), nullable=False),
        sa.Column('feedback', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chat_messages_session_id'), 'chat_messages', ['session_id'], unique=False)

    op.create_table(
        'ai_tasks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('user_message_id', sa.String(), nullable=True),
        sa.Column('assistant_message_id', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('tool_context', sa.JSON(), nullable=True),
        sa.Column('cancelled_by', sa.String(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_tasks_session_id'), 'ai_tasks', ['session_id'], unique=False)

    op.create_table(
        'message_chunks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('chunk_type', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('reasoning_content', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['chat_messages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_message_chunks_message_id'), 'message_chunks', ['message_id'], unique=False)
    op.create_index('idx_message_chunks_message_index', 'message_chunks', ['message_id', 'chunk_index'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_message_chunks_message_index', table_name='message_chunks')
    op.drop_index(op.f('ix_message_chunks_message_id'), table_name='message_chunks')
    op.drop_table('message_chunks')

    op.drop_index(op.f('ix_ai_tasks_session_id'), table_name='ai_tasks')
    op.drop_table('ai_tasks')

    op.drop_index(op.f('ix_chat_messages_session_id'), table_name='chat_messages')
    op.drop_table('chat_messages')

    op.drop_index(op.f('ix_chat_sessions_user_id'), table_name='chat_sessions')
    op.drop_table('chat_sessions')
