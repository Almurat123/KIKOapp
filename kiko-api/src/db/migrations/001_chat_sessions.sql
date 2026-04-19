-- Chat Architecture Redesign: Backend-Task-Based System
-- Migration: 001_chat_sessions
-- Created: 2024-12-21

-- CONTEXT MEMORY
-- Updated: 2026-04-17
-- Author: Almurat
-- Reason: fresh SQL bootstrap files must follow the current product default,
--         which moved from GPT to free Kimi 2.5 Instant/Fast.
-- Goal: keep newly bootstrapped chat_sessions rows aligned with the canonical
--       frontend/backend default and the persisted reasoning level for split-
--       effort families.
-- Owns: legacy SQL bootstrap defaults for chat session persistence.
-- Does Not Own: Prisma-managed production migrations or per-user overrides.
-- Design Language:
-- - Bootstrap defaults must not drift from kiko-api/src/config/chatModels.ts.
-- - Do not use historical migration literals as the product default source.
-- - Bootstrap rows must also include a reasoning-level column so refreshes can
--   reopen sessions with the saved effort state.
-- Document Provenance:
-- - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
-- - Kind: repo doc
-- - Retrieved: 2026-04-17
-- - Applied To: legacy chat session bootstrap default
-- - Verification: verified in code
-- - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
-- - Kind: repo doc
-- - Retrieved: 2026-04-19
-- - Applied To: legacy chat session bootstrap reasoning persistence
-- See also:
-- - /Users/almurat/KiKo/system-journal/INDEX.md
-- - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
-- - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md

-- =============================================
-- Chat Sessions (Conversations)
-- =============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,  -- Privy user ID (DID)
  title VARCHAR(500) DEFAULT 'New Chat',
  model VARCHAR(50) DEFAULT 'kimi-k2-5-instant',
  reasoning_level VARCHAR(20) NOT NULL DEFAULT 'fast',
  status VARCHAR(20) DEFAULT 'active',  -- active, archived
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Chat Messages
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- user, assistant, system, tool
  content TEXT NOT NULL DEFAULT '',
  reasoning_content TEXT,  -- For reasoning-capable model outputs (DeepSeek Reasoner, Grok Reasoning)
  citations JSONB,  -- Array of citation URLs
  usage JSONB,  -- Token usage stats {prompt_tokens, completion_tokens, total_tokens}
  tool_calls JSONB,  -- Tool calls made by assistant
  tool_call_id VARCHAR(100),  -- For tool response messages
  message_index INTEGER NOT NULL,  -- Order within session
  status VARCHAR(20) DEFAULT 'complete',  -- streaming, complete, error
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- AI Tasks (for background execution)
-- =============================================
CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  assistant_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  model VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'queued',  -- queued, running, done, error, cancelled
  error_message TEXT,
  tool_context JSONB,  -- {userId, walletAddress, chainId} for tool execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Message Chunks (for streaming persistence)
-- =============================================
CREATE TABLE IF NOT EXISTS message_chunks (
  id SERIAL PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT,
  reasoning_content TEXT,
  chunk_type VARCHAR(20) DEFAULT 'content',  -- content, reasoning, tool_call, tool_result, citation
  metadata JSONB,  -- Additional data (tool name, status, etc.)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, chunk_index)
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- Sessions: Find user's sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);

-- Messages: Find session messages in order
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_order ON chat_messages(session_id, message_index);
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);

-- Tasks: Worker polling and status checking
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_session ON ai_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created ON ai_tasks(created_at);

-- Chunks: Fetch chunks for a message in order
CREATE INDEX IF NOT EXISTS idx_message_chunks_message ON message_chunks(message_id, chunk_index);
