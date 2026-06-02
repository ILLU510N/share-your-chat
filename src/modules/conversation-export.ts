import type { FormatMetadata } from './content-handlers';
import type { Message, Site } from './types';

export interface MarkdownConversationExport {
  title: string;
  sourceUrl: string;
  platform: Site;
  markdown: string;
  messageCount: number;
  failedMessages: number;
}

export interface ConversationMessageCollection {
  messages: Message[];
  failedMessages: number;
}

export interface ExportCurrentConversationAsMarkdownDependencies {
  collectMessages?: (site: Site) => Promise<ConversationMessageCollection>;
  detectSite?: () => Promise<Site> | Site;
  formatContent?: (
    messages: Message[],
    format: 'markdown',
    metadata?: FormatMetadata
  ) => Promise<string>;
  getAssistantDisplayName?: (site: Site) => Promise<string> | string;
  getDocumentTitle?: () => string;
  getSourceUrl?: () => string;
}

const TENCENT_DOCS_TITLE_MAX_LENGTH = 36;

function normalizeDocumentTitle(title: string, site: Site): string {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  const fallbackTitle = `${site} chat export`;
  const titleForExport = normalizedTitle || fallbackTitle;

  // 腾讯文档新建文档接口限制标题长度，这里在进入 OpenAPI 前收敛到合法范围。
  return titleForExport.slice(0, TENCENT_DOCS_TITLE_MAX_LENGTH);
}

async function collectMessagesForSite(site: Site): Promise<ConversationMessageCollection> {
  if (site === 'chatgpt') {
    const { getChatGPTChatContent } = await import('@/modules/chatgpt/chat-content');
    const { chatgptMessages, failedChatgptMessages } = await getChatGPTChatContent();

    return { messages: chatgptMessages, failedMessages: failedChatgptMessages };
  }

  if (site === 'gemini') {
    const { getGeminiChatContent } = await import('@/modules/gemini/chat-content');
    const { geminiMessages, failedGeminiMessages } = await getGeminiChatContent();

    return { messages: geminiMessages, failedMessages: failedGeminiMessages };
  }

  const { getClaudeChatContent } = await import('@/modules/claude/chat-content');
  const { claudeMessages, failedClaudeMessages } = await getClaudeChatContent();

  return { messages: claudeMessages, failedMessages: failedClaudeMessages };
}

async function formatMarkdownContent(
  messages: Message[],
  metadata: FormatMetadata
): Promise<string> {
  const { formatContent } = await import('./content-handlers');

  return formatContent(messages, 'markdown', metadata);
}

function getCurrentDocumentTitle(): string {
  return document.title;
}

function getCurrentSourceUrl(): string {
  return window.location.href;
}

async function getCurrentSite(): Promise<Site> {
  const { detectSite } = await import('./site-detection');

  return detectSite();
}

async function getCurrentAssistantDisplayName(site: Site): Promise<string> {
  const { getAssistantDisplayName } = await import('./platform-metadata');

  return getAssistantDisplayName(site);
}

export async function exportCurrentConversationAsMarkdown(
  dependencies: ExportCurrentConversationAsMarkdownDependencies = {}
): Promise<MarkdownConversationExport> {
  const detectSite = dependencies.detectSite ?? getCurrentSite;
  const site = await detectSite();
  const collectMessages = dependencies.collectMessages ?? collectMessagesForSite;
  const { messages, failedMessages } = await collectMessages(site);
  const getAssistantDisplayName =
    dependencies.getAssistantDisplayName ?? getCurrentAssistantDisplayName;
  const assistantDisplayName = await getAssistantDisplayName(site);
  const formatContent = dependencies.formatContent ?? formatMarkdownContent;
  const markdown = await formatContent(messages, 'markdown', { assistantDisplayName });
  const getDocumentTitle = dependencies.getDocumentTitle ?? getCurrentDocumentTitle;
  const getSourceUrl = dependencies.getSourceUrl ?? getCurrentSourceUrl;

  return {
    title: normalizeDocumentTitle(getDocumentTitle(), site),
    sourceUrl: getSourceUrl(),
    platform: site,
    markdown,
    messageCount: messages.length,
    failedMessages,
  };
}
