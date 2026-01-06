/**
 * 历史会话调试工具
 * 用于诊断历史会话加载问题
 */

import React, { useState, useEffect, useCallback } from 'react';

interface ConversationData {
  id: string;
  title: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
}

export const ConversationDebugger: React.FC = () => {
  const [info, setInfo] = useState<{
    count: number;
    totalSize: number;
    conversations: ConversationData[];
    errors: string[];
  }>({
    count: 0,
    totalSize: 0,
    conversations: [],
    errors: [],
  });

  const diagnose = useCallback(() => {
    const errors: string[] = [];
    let conversations: ConversationData[] = [];
    let totalSize = 0;

    try {
      const saved = localStorage.getItem('kiko-conversations');

      if (!saved) {
        errors.push('No data found in localStorage');
      } else {
        totalSize = new Blob([saved]).size;

        try {
          conversations = JSON.parse(saved);

          if (!Array.isArray(conversations)) {
            errors.push('Data is not an array');
          }

          // Validate each conversation
          conversations.forEach((conv, i) => {
            if (!conv.id) errors.push(`Conversation ${i} missing id`);
            if (!conv.title) errors.push(`Conversation ${i} missing title`);
            if (!Array.isArray(conv.messages)) errors.push(`Conversation ${i} messages is not array`);
          });

        } catch (e) {
          errors.push(`JSON parse error: ${e}`);
        }
      }
    } catch (e) {
      errors.push(`localStorage error: ${e}`);
    }

    setInfo({
      count: conversations.length,
      totalSize,
      conversations,
      errors,
    });
  }, []);

  useEffect(() => {
    void diagnose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearData = () => {
    if (confirm('Clear all conversation history?')) {
      localStorage.removeItem('kiko-conversations');
      localStorage.removeItem('kiko-active-conversation');
      diagnose();
      alert('Cleared! Please refresh the page.');
    }
  };

  const createTestConversation = () => {
    const testConv = {
      id: `conv-test-${Date.now()}`,
      title: 'Test Conversation',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi! How can I help?',
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const existing = info.conversations;
    const updated = [testConv, ...existing];
    localStorage.setItem('kiko-conversations', JSON.stringify(updated));
    diagnose();
    alert('Test conversation created! Please refresh the page.');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      background: '#1a1a1a',
      color: '#fff',
      padding: 20,
      borderRadius: 8,
      maxWidth: 400,
      maxHeight: 600,
      overflow: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      zIndex: 9999,
      fontSize: 12,
      fontFamily: 'monospace',
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: 14 }}>🔍 Conversation Debugger</h3>

      <div style={{ marginBottom: 15 }}>
        <strong>Status:</strong>
        <div style={{ marginTop: 5 }}>
          • Conversations: <span style={{ color: info.count > 0 ? '#0f0' : '#f00' }}>{info.count}</span>
        </div>
        <div>
          • Storage Size: {(info.totalSize / 1024).toFixed(2)} KB
        </div>
        <div>
          • Max Limit: 100 conversations
        </div>
      </div>

      {info.errors.length > 0 && (
        <div style={{
          background: '#ff000020',
          padding: 10,
          borderRadius: 4,
          marginBottom: 15,
          border: '1px solid #ff0000'
        }}>
          <strong style={{ color: '#ff0000' }}>⚠️ Errors:</strong>
          {info.errors.map((err, i) => (
            <div key={i} style={{ marginTop: 5, color: '#ff6b6b' }}>• {err}</div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 15 }}>
        <strong>Conversations:</strong>
        <div style={{
          marginTop: 5,
          maxHeight: 200,
          overflow: 'auto',
          background: '#2a2a2a',
          padding: 8,
          borderRadius: 4,
        }}>
          {info.conversations.length === 0 ? (
            <div style={{ color: '#888' }}>No conversations</div>
          ) : (
            info.conversations.map((conv, i) => (
              <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #444' }}>
                <div><strong>{conv.title}</strong></div>
                <div style={{ color: '#888', fontSize: 10 }}>
                  ID: {conv.id}
                </div>
                <div style={{ color: '#888', fontSize: 10 }}>
                  Messages: {conv.messages?.length || 0}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <button
          onClick={diagnose}
          style={{
            padding: '8px 12px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          🔄 Refresh
        </button>

        <button
          onClick={createTestConversation}
          style={{
            padding: '8px 12px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ➕ Create Test Conversation
        </button>

        <button
          onClick={clearData}
          style={{
            padding: '8px 12px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          🗑️ Clear All Data
        </button>
      </div>

      <div style={{ marginTop: 15, fontSize: 10, color: '#888' }}>
        Press F12 to check console logs
      </div>
    </div>
  );
};

export default ConversationDebugger;
