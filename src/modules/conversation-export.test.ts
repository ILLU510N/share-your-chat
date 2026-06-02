import assert from 'node:assert/strict';
import { test } from 'node:test';

import { exportCurrentConversationAsMarkdown } from './conversation-export.ts';

test('exportCurrentConversationAsMarkdown 强制将当前会话格式化为 Markdown', async () => {
  const result = await exportCurrentConversationAsMarkdown({
    collectMessages: async () => ({
      messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '已整理' },
      ],
      failedMessages: 1,
    }),
    detectSite: () => 'chatgpt',
    formatContent: async (messages, format, metadata) => {
      assert.equal(format, 'markdown');
      assert.deepEqual(metadata, { assistantDisplayName: 'ChatGPT' });
      assert.deepEqual(messages, [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '已整理' },
      ]);
      return '### User\n\n你好\n\n### ChatGPT\n\n已整理\n\n';
    },
    getAssistantDisplayName: () => 'ChatGPT',
    getDocumentTitle: () => '一个超过三十六个字符的会话标题用于验证腾讯文档标题长度限制会被处理',
    getSourceUrl: () => 'https://chatgpt.com/c/example',
  });

  assert.equal(result.platform, 'chatgpt');
  assert.equal(result.sourceUrl, 'https://chatgpt.com/c/example');
  assert.equal(result.messageCount, 2);
  assert.equal(result.failedMessages, 1);
  assert.equal(result.markdown, '### User\n\n你好\n\n### ChatGPT\n\n已整理\n\n');
  assert.ok(result.title.length <= 36);
});
