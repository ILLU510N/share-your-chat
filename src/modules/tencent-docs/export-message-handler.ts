import type { MarkdownConversationExport } from '../conversation-export';

import type {
  ExportMarkdownToTencentDocsInput,
  ExportMarkdownToTencentDocsResult,
  TencentDocsConfig,
} from './tencent-docs-client';

export const EXPORT_TO_TENCENT_DOCS_MESSAGE = 'EXPORT_TO_TENCENT_DOCS';

export type TencentDocsExportMessage = {
  type: typeof EXPORT_TO_TENCENT_DOCS_MESSAGE;
  payload: MarkdownConversationExport;
};

export type TencentDocsExportResponse =
  | {
      success: true;
      data: ExportMarkdownToTencentDocsResult;
    }
  | {
      success: false;
      error: string;
    };

export interface TencentDocsExportMessageHandlerDependencies {
  exportMarkdown: (
    input: ExportMarkdownToTencentDocsInput
  ) => Promise<ExportMarkdownToTencentDocsResult>;
  readConfig: () => Promise<TencentDocsConfig>;
}

function isTencentDocsExportMessage(message: unknown): message is TencentDocsExportMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as Partial<TencentDocsExportMessage>;
  const payload = candidate.payload as Partial<MarkdownConversationExport> | undefined;

  return (
    candidate.type === EXPORT_TO_TENCENT_DOCS_MESSAGE &&
    Boolean(payload) &&
    typeof payload?.title === 'string' &&
    typeof payload.markdown === 'string' &&
    typeof payload.sourceUrl === 'string' &&
    (payload.platform === 'chatgpt' ||
      payload.platform === 'claude' ||
      payload.platform === 'gemini') &&
    typeof payload.messageCount === 'number' &&
    typeof payload.failedMessages === 'number'
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '导出到腾讯文档失败：未知错误。';
}

export async function handleTencentDocsExportMessage(
  message: unknown,
  dependencies: TencentDocsExportMessageHandlerDependencies
): Promise<TencentDocsExportResponse | undefined> {
  if (!isTencentDocsExportMessage(message)) {
    return undefined;
  }

  try {
    const config = await dependencies.readConfig();
    const result = await dependencies.exportMarkdown({
      title: message.payload.title,
      markdown: message.payload.markdown,
      config,
      sourceUrl: message.payload.sourceUrl,
      platform: message.payload.platform,
      messageCount: message.payload.messageCount,
      failedMessages: message.payload.failedMessages,
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}
