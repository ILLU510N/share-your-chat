import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EXPORT_TO_TENCENT_DOCS_MESSAGE,
  handleTencentDocsExportMessage,
} from './export-message-handler.ts';

const testConfig = {
  clientId: 'client-id',
  accessToken: 'access-token',
  openId: 'open-id',
};

test('handleTencentDocsExportMessage 将 Markdown 会话交给腾讯文档高层导出函数', async () => {
  const exportCalls: unknown[] = [];
  const response = await handleTencentDocsExportMessage(
    {
      type: EXPORT_TO_TENCENT_DOCS_MESSAGE,
      payload: {
        title: 'ChatGPT Conversation',
        markdown: '### User\n\n你好\n\n',
        sourceUrl: 'https://chatgpt.com/c/example',
        platform: 'chatgpt',
        messageCount: 1,
        failedMessages: 0,
      },
    },
    {
      exportMarkdown: async (input) => {
        exportCalls.push(input);
        return {
          documentId: '300000000$AAAAAAAAAAAA',
          documentTitle: input.title,
          documentType: 'doc',
          documentUrl: 'https://docs.qq.com/doc/DAAAAAAAAAAAA',
          sourceUrl: input.sourceUrl,
          platform: input.platform,
          messageCount: input.messageCount,
          failedMessages: input.failedMessages,
        };
      },
      readConfig: async () => testConfig,
    }
  );

  assert.deepEqual(exportCalls, [
    {
      title: 'ChatGPT Conversation',
      markdown: '### User\n\n你好\n\n',
      sourceUrl: 'https://chatgpt.com/c/example',
      platform: 'chatgpt',
      messageCount: 1,
      failedMessages: 0,
      config: testConfig,
    },
  ]);
  assert.deepEqual(response, {
    success: true,
    data: {
      documentId: '300000000$AAAAAAAAAAAA',
      documentTitle: 'ChatGPT Conversation',
      documentType: 'doc',
      documentUrl: 'https://docs.qq.com/doc/DAAAAAAAAAAAA',
      sourceUrl: 'https://chatgpt.com/c/example',
      platform: 'chatgpt',
      messageCount: 1,
      failedMessages: 0,
    },
  });
});

test('handleTencentDocsExportMessage 忽略非腾讯文档导出消息', async () => {
  const response = await handleTencentDocsExportMessage(
    { type: 'UNKNOWN' },
    {
      exportMarkdown: async () => {
        throw new Error('不应调用导出函数');
      },
      readConfig: async () => testConfig,
    }
  );

  assert.equal(response, undefined);
});
