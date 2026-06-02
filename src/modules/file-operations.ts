import browser from 'webextension-polyfill';

import { getChatContent } from '@/modules/chat-content';
import { exportCurrentConversationAsMarkdown } from '@/modules/conversation-export';
import {
  EXPORT_TO_TENCENT_DOCS_MESSAGE,
  TencentDocsExportResponse,
} from '@/modules/tencent-docs/export-message-handler';

export async function copyToClipboard() {
  const { content, messageCount, failedMessages } = await getChatContent(false);
  await navigator.clipboard.writeText(content);

  const failedText = failedMessages > 0 ? `\n⚠️ Failed messages: ${failedMessages}` : '';
  alert(
    `✅ Chat copied to clipboard successfully!\n\nStats:\n📝 Total messages: ${messageCount}\n📏 Total length: ${content.length.toLocaleString()} characters${failedText}`
  );
}

export async function saveToFile() {
  const { format, content, messageCount, failedMessages } = await getChatContent(true);
  const mimeTypes: { [key: string]: string } = {
    markdown: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
  };

  const extensions: { [key: string]: string } = {
    markdown: 'md',
    json: 'json',
    xml: 'xml',
    html: 'html',
  };

  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${new Date().toISOString().split('T')[0]}.${extensions[format] || 'txt'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const failedText = failedMessages > 0 ? `\n⚠️ Failed messages: ${failedMessages}` : '';
  alert(
    `💾 Chat saved to file successfully!\n\nStats:\n📝 Total messages: ${messageCount}\n📏 Total length: ${content.length.toLocaleString()} characters\n📄 Format: ${format.toUpperCase()}\n📁 Filename: ${a.download}${failedText}`
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

function assertTencentDocsExportResponse(
  response: unknown
): asserts response is TencentDocsExportResponse {
  if (!response || typeof response !== 'object' || !('success' in response)) {
    throw new Error('腾讯文档导出后台服务未响应，请重新加载扩展后再试。');
  }
}

export async function exportToTencentDocs() {
  try {
    const conversation = await exportCurrentConversationAsMarkdown();
    const response = await browser.runtime.sendMessage({
      type: EXPORT_TO_TENCENT_DOCS_MESSAGE,
      payload: conversation,
    });

    assertTencentDocsExportResponse(response);

    if (!response.success) {
      throw new Error(response.error);
    }

    let clipboardStatus = '链接已复制到剪贴板。';

    try {
      await navigator.clipboard.writeText(response.data.documentUrl);
    } catch {
      clipboardStatus = '链接复制失败，请手动复制下方链接。';
    }

    const failedText =
      response.data.failedMessages && response.data.failedMessages > 0
        ? `\n⚠️ Failed messages: ${response.data.failedMessages}`
        : '';

    alert(
      `✅ 已导出到腾讯文档。\n\n${clipboardStatus}\n\n🔗 ${response.data.documentUrl}\n\nStats:\n📝 Total messages: ${response.data.messageCount ?? conversation.messageCount}${failedText}`
    );
  } catch (error) {
    alert(`导出到腾讯文档失败：${getErrorMessage(error)}`);
  }
}
