const TENCENT_DOCS_API_BASE_URL = 'https://docs.qq.com';
const DEFAULT_INSERT_INDEX = 1;
const TENCENT_DOCS_TITLE_MAX_LENGTH = 36;

export interface TencentDocsConfig {
  clientId: string;
  accessToken: string;
  openId: string;
}

export interface TencentDocsOptionsLike {
  tencentDocsClientId?: string;
  tencentDocsAccessToken?: string;
  tencentDocsOpenId?: string;
}

export interface TencentDocsDocumentInfo {
  id: string;
  title: string;
  type: string;
  url: string;
}

export interface CreateDocumentInput {
  title: string;
  config: TencentDocsConfig;
  folderID?: string;
}

export interface WriteMarkdownContentInput {
  fileId: string;
  markdown: string;
  config: TencentDocsConfig;
  insertIndex?: number;
  version?: number;
}

export interface ExportMarkdownToTencentDocsInput {
  title: string;
  markdown: string;
  config: TencentDocsConfig;
  sourceUrl?: string;
  platform?: string;
  messageCount?: number;
  failedMessages?: number;
}

export interface ExportMarkdownToTencentDocsResult {
  documentId: string;
  documentTitle: string;
  documentType: string;
  documentUrl: string;
  sourceUrl?: string;
  platform?: string;
  messageCount?: number;
  failedMessages?: number;
}

export interface TencentDocsClientDependencies {
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
}

type TencentDocsCreateDocumentResponse = {
  ret?: number;
  msg?: string;
  data?: {
    ID?: string;
    title?: string;
    type?: string;
    url?: string;
  };
};

type TencentDocsErrorResponse = {
  ret?: number;
  code?: number;
  msg?: string;
  message?: string;
};

export class TencentDocsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TencentDocsConfigError';
  }
}

export class TencentDocsApiError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly ret?: number;
  readonly code?: number;

  constructor({
    endpoint,
    status,
    ret,
    code,
    message,
  }: {
    endpoint: string;
    status: number;
    ret?: number;
    code?: number;
    message: string;
  }) {
    super(message);
    this.name = 'TencentDocsApiError';
    this.endpoint = endpoint;
    this.status = status;
    this.ret = ret;
    this.code = code;
  }
}

function normalizeRequiredValue(value: string | undefined): string {
  return (value || '').trim();
}

export function getTencentDocsConfigFromOptions(
  options: TencentDocsOptionsLike
): TencentDocsConfig {
  const config = {
    clientId: normalizeRequiredValue(options.tencentDocsClientId),
    accessToken: normalizeRequiredValue(options.tencentDocsAccessToken),
    openId: normalizeRequiredValue(options.tencentDocsOpenId),
  };
  const missingFields: string[] = [];

  if (!config.clientId) {
    missingFields.push('Client ID');
  }

  if (!config.accessToken) {
    missingFields.push('Access Token');
  }

  if (!config.openId) {
    missingFields.push('Open ID');
  }

  if (missingFields.length > 0) {
    throw new TencentDocsConfigError(`腾讯文档配置缺少官方必填项：${missingFields.join('、')}`);
  }

  return config;
}

function getFetchImplementation(dependencies?: TencentDocsClientDependencies): typeof fetch {
  if (dependencies?.fetchImpl) {
    return dependencies.fetchImpl;
  }

  if (globalThis.fetch) {
    return globalThis.fetch.bind(globalThis);
  }

  throw new TencentDocsConfigError('当前运行环境不支持 fetch，无法调用腾讯文档 OpenAPI。');
}

function getApiBaseUrl(dependencies?: TencentDocsClientDependencies): string {
  return (dependencies?.apiBaseUrl || TENCENT_DOCS_API_BASE_URL).replace(/\/+$/, '');
}

function buildAuthHeaders(config: TencentDocsConfig, contentType: string): Record<string, string> {
  return {
    'Access-Token': config.accessToken,
    'Client-Id': config.clientId,
    'Open-Id': config.openId,
    'Content-Type': contentType,
    Accept: 'application/json',
  };
}

function sanitizeApiText(text: string | undefined, config: TencentDocsConfig): string {
  let sanitizedText = text || '未知错误';

  for (const secret of [config.clientId, config.accessToken, config.openId]) {
    if (secret) {
      sanitizedText = sanitizedText.split(secret).join('[已隐藏]');
    }
  }

  return sanitizedText;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { msg: text };
  }
}

function throwTencentDocsApiError({
  endpoint,
  response,
  body,
  config,
}: {
  endpoint: string;
  response: Response;
  body: TencentDocsErrorResponse;
  config: TencentDocsConfig;
}): never {
  const apiMessage = sanitizeApiText(body.msg || body.message, config);
  const businessCode = body.ret ?? body.code;

  throw new TencentDocsApiError({
    endpoint,
    status: response.status,
    ret: body.ret,
    code: body.code,
    message: `腾讯文档接口调用失败：${apiMessage}（HTTP ${response.status}${
      businessCode === undefined ? '' : `，业务码 ${businessCode}`
    }）`,
  });
}

function assertValidTitle(title: string): string {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new TencentDocsConfigError('腾讯文档标题不能为空。');
  }

  if (normalizedTitle.length > TENCENT_DOCS_TITLE_MAX_LENGTH) {
    throw new TencentDocsConfigError(
      `腾讯文档标题长度不能超过 ${TENCENT_DOCS_TITLE_MAX_LENGTH} 个字符。`
    );
  }

  return normalizedTitle;
}

function assertCreateDocumentData(
  body: TencentDocsCreateDocumentResponse,
  response: Response,
  config: TencentDocsConfig
): TencentDocsDocumentInfo {
  if (body.ret !== 0) {
    throwTencentDocsApiError({
      endpoint: '/openapi/drive/v2/files',
      response,
      body,
      config,
    });
  }

  if (!body.data?.ID || !body.data?.title || !body.data?.type || !body.data?.url) {
    throw new TencentDocsApiError({
      endpoint: '/openapi/drive/v2/files',
      status: response.status,
      message: '腾讯文档新建文档接口响应缺少必要文档信息。',
    });
  }

  return {
    id: body.data.ID,
    title: body.data.title,
    type: body.data.type,
    url: body.data.url,
  };
}

export async function createDocument(
  input: CreateDocumentInput,
  dependencies?: TencentDocsClientDependencies
): Promise<TencentDocsDocumentInfo> {
  const title = assertValidTitle(input.title);
  const endpoint = '/openapi/drive/v2/files';
  const body = new URLSearchParams();

  body.set('title', title);
  body.set('type', 'doc');

  if (input.folderID) {
    body.set('folderID', input.folderID);
  }

  const response = await getFetchImplementation(dependencies)(
    `${getApiBaseUrl(dependencies)}${endpoint}`,
    {
      method: 'POST',
      headers: buildAuthHeaders(input.config, 'application/x-www-form-urlencoded'),
      body,
    }
  );
  const responseBody = (await parseJsonResponse(response)) as TencentDocsCreateDocumentResponse;

  if (!response.ok) {
    throwTencentDocsApiError({
      endpoint,
      response,
      body: responseBody,
      config: input.config,
    });
  }

  return assertCreateDocumentData(responseBody, response, input.config);
}

export async function writeMarkdownContent(
  input: WriteMarkdownContentInput,
  dependencies?: TencentDocsClientDependencies
): Promise<void> {
  const endpoint = `/openapi/doc/v3/${encodeURIComponent(input.fileId)}:batchUpdate`;
  const requestBody: {
    requests: Array<{
      insertText: {
        text: string;
        location: { index: number };
      };
    }>;
    version?: number;
  } = {
    requests: [
      {
        insertText: {
          text: input.markdown,
          location: { index: input.insertIndex ?? DEFAULT_INSERT_INDEX },
        },
      },
    ],
  };

  if (input.version !== undefined) {
    requestBody.version = input.version;
  }

  const response = await getFetchImplementation(dependencies)(
    `${getApiBaseUrl(dependencies)}${endpoint}`,
    {
      method: 'POST',
      headers: buildAuthHeaders(input.config, 'application/json'),
      body: JSON.stringify(requestBody),
    }
  );
  const responseBody = (await parseJsonResponse(response)) as TencentDocsErrorResponse;

  if (!response.ok || (responseBody.ret !== undefined && responseBody.ret !== 0)) {
    throwTencentDocsApiError({
      endpoint,
      response,
      body: responseBody,
      config: input.config,
    });
  }
}

export async function exportMarkdownToTencentDocs(
  input: ExportMarkdownToTencentDocsInput,
  dependencies?: TencentDocsClientDependencies
): Promise<ExportMarkdownToTencentDocsResult> {
  const documentInfo = await createDocument(
    {
      title: input.title,
      config: input.config,
    },
    dependencies
  );

  await writeMarkdownContent(
    {
      fileId: documentInfo.id,
      markdown: input.markdown,
      config: input.config,
    },
    dependencies
  );

  return {
    documentId: documentInfo.id,
    documentTitle: documentInfo.title,
    documentType: documentInfo.type,
    documentUrl: documentInfo.url,
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    messageCount: input.messageCount,
    failedMessages: input.failedMessages,
  };
}
