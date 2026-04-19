import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assistantMessageHasStreamingContent,
  doesActiveTaskMatchMessage,
  isEffectivelyStreamingAssistantMessage,
  resolveGeneratedImageMessageStatus,
  shouldClearActiveTaskForGeneratedImageUpdate,
} from './generatedImageTaskState';

test('generated-image terminal payload maps streaming assistant row to complete', () => {
  const nextStatus = resolveGeneratedImageMessageStatus({
    currentStatus: 'streaming',
    messageType: 'generated-image',
    messageData: {
      generatedImage: {
        status: 'complete',
      },
    },
  });

  assert.equal(nextStatus, 'complete');
});

test('generated-image failed payload maps assistant row to error', () => {
  const nextStatus = resolveGeneratedImageMessageStatus({
    currentStatus: 'streaming',
    messageType: 'generated-image',
    messageData: {
      generatedImage: {
        status: 'failed',
        errorMessage: 'provider failed',
      },
    },
  });

  assert.equal(nextStatus, 'error');
});

test('terminal generated-image payload is not treated as effectively streaming', () => {
  const isStreaming = isEffectivelyStreamingAssistantMessage({
    role: 'assistant',
    status: 'streaming',
    type: 'generated-image',
    data: {
      generatedImage: {
        status: 'complete',
      },
    },
  });
  const hasStreamingContent = assistantMessageHasStreamingContent({
    role: 'assistant',
    status: 'streaming',
    type: 'generated-image',
    content: '',
    reasoning_content: '',
    data: {
      generatedImage: {
        status: 'complete',
        images: [{ previewUrl: 'https://example.com/image.png' }],
      },
    },
  });

  assert.equal(isStreaming, false);
  assert.equal(hasStreamingContent, false);
});

test('active task matches the bound assistant message id when present', () => {
  const matches = doesActiveTaskMatchMessage(
    {
      id: 'real-task-id',
      messageId: 'assistant-123',
    },
    'assistant-123'
  );

  assert.equal(matches, true);
});

test('terminal generated-image update clears only the matching active task', () => {
  const shouldClearCurrentTask = shouldClearActiveTaskForGeneratedImageUpdate({
    activeTask: {
      id: 'real-task-id',
      messageId: 'assistant-123',
    },
    targetMessageId: 'assistant-123',
    messageType: 'generated-image',
    messageData: {
      generatedImage: {
        status: 'complete',
      },
    },
  });
  const shouldLeaveNewerTaskAlone = shouldClearActiveTaskForGeneratedImageUpdate({
    activeTask: {
      id: 'next-real-task-id',
      messageId: 'assistant-999',
    },
    targetMessageId: 'assistant-123',
    messageType: 'generated-image',
    messageData: {
      generatedImage: {
        status: 'complete',
      },
    },
  });

  assert.equal(shouldClearCurrentTask, true);
  assert.equal(shouldLeaveNewerTaskAlone, false);
});
