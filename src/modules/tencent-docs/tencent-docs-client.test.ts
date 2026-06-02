import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createDocument,
  exportMarkdownToTencentDocs,
  getTencentDocsConfigFromOptions,
  writeMarkdownContent,
} from './tencent-docs-client.ts';

const testConfig = {
  clientId: 'client-id',
  accessToken: 'access-token',
  openId: 'open-id',
};

type FetchCall = {
  url: string;
  init: RequestInit;
};

type FetchFixture = {
  body: unknown;
  status?: number;
};

function createFetch(fixtures: FetchFixture[]) {
  const calls: FetchCall[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init: init || {} });
    const fixture = fixtures.shift();

    if (!fixture) {
      throw new Error('没有为测试请求准备响应');
    }

    return new Response(JSON.stringify(fixture.body), {
      status: fixture.status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return { calls, fetchImpl };
}

test('getTencentDocsConfigFromOptions 读取官方请求头需要的三项认证配置', () => {
  const config = getTencentDocsConfigFromOptions({
    exportType: 'markdown',
    tencentDocsClientId: ' client-id ',
    tencentDocsAccessToken: ' access-token ',
    tencentDocsOpenId: ' open-id ',
  });

  assert.deepEqual(config, testConfig);
});

test('getTencentDocsConfigFromOptions 缺少官方必填配置时抛出不含密钥值的错误', () => {
  assert.throws(
    () =>
      getTencentDocsConfigFromOptions({
        exportType: 'markdown',
        tencentDocsClientId: 'client-id',
        tencentDocsAccessToken: 'access-token-value',
        tencentDocsOpenId: '',
      }),
    (error) => {
      const text = String(error);

      assert.match(text, /Open ID/);
      assert.doesNotMatch(text, /access-token-value/);
      return true;
    }
  );
});

test('createDocument 按官方新建文档接口发送表单请求并返回文档信息', async () => {
  const { calls, fetchImpl } = createFetch([
    {
      body: {
        ret: 0,
        msg: 'Succeed',
        data: {
          ID: '300000000$AAAAAAAAAAAA',
          title: 'Chat Export',
          type: 'doc',
          url: 'https://docs.qq.com/doc/DAAAAAAAAAAAA',
        },
      },
    },
  ]);

  const documentInfo = await createDocument(
    { title: 'Chat Export', config: testConfig },
    { fetchImpl }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://docs.qq.com/openapi/drive/v2/files');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string, string>)['Access-Token'], 'access-token');
  assert.equal((calls[0].init.headers as Record<string, string>)['Client-Id'], 'client-id');
  assert.equal((calls[0].init.headers as Record<string, string>)['Open-Id'], 'open-id');
  assert.equal(
    (calls[0].init.headers as Record<string, string>)['Content-Type'],
    'application/x-www-form-urlencoded'
  );
  assert.equal((calls[0].init.headers as Record<string, string>)['Accept'], 'application/json');

  const body = calls[0].init.body as URLSearchParams;
  assert.equal(body.get('title'), 'Chat Export');
  assert.equal(body.get('type'), 'doc');
  assert.deepEqual(documentInfo, {
    id: '300000000$AAAAAAAAAAAA',
    title: 'Chat Export',
    type: 'doc',
    url: 'https://docs.qq.com/doc/DAAAAAAAAAAAA',
  });
});

test('writeMarkdownContent 按官方 Doc batchUpdate 接口插入 Markdown 原文', async () => {
  const { calls, fetchImpl } = createFetch([{ body: {} }]);

  await writeMarkdownContent(
    {
      fileId: '300000000$AAAAAAAAAAAA',
      markdown: '### User\n\n你好',
      config: testConfig,
    },
    { fetchImpl }
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://docs.qq.com/openapi/doc/v3/300000000%24AAAAAAAAAAAA:batchUpdate'
  );
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string, string>)['Access-Token'], 'access-token');
  assert.equal((calls[0].init.headers as Record<string, string>)['Client-Id'], 'client-id');
  assert.equal((calls[0].init.headers as Record<string, string>)['Open-Id'], 'open-id');
  assert.equal(
    (calls[0].init.headers as Record<string, string>)['Content-Type'],
    'application/json'
  );

  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    requests: [
      {
        insertText: {
          text: '### User\n\n你好',
          location: { index: 1 },
        },
      },
    ],
  });
});

test('exportMarkdownToTencentDocs 先创建在线文档再写入 Markdown 并返回元数据', async () => {
  const { calls, fetchImpl } = createFetch([
    {
      body: {
        ret: 0,
        msg: 'Succeed',
        data: {
          ID: '300000000$BBBBBBBBBBBB',
          title: '阶段 3',
          type: 'doc',
          url: 'https://docs.qq.com/doc/DBBBBBBBBBBBB',
        },
      },
    },
    { body: {} },
  ]);

  const result = await exportMarkdownToTencentDocs(
    {
      title: '阶段 3',
      markdown: '### Assistant\n\n完成',
      config: testConfig,
      sourceUrl: 'https://chatgpt.com/c/example',
      platform: 'chatgpt',
      messageCount: 2,
      failedMessages: 0,
    },
    { fetchImpl }
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(result, {
    documentId: '300000000$BBBBBBBBBBBB',
    documentTitle: '阶段 3',
    documentType: 'doc',
    documentUrl: 'https://docs.qq.com/doc/DBBBBBBBBBBBB',
    sourceUrl: 'https://chatgpt.com/c/example',
    platform: 'chatgpt',
    messageCount: 2,
    failedMessages: 0,
  });
});

test('接口失败时错误对象不包含敏感认证信息或完整请求头', async () => {
  const { fetchImpl } = createFetch([
    {
      status: 401,
      body: {
        ret: 37019,
        msg: 'Token 校验失败，错误或过期',
      },
    },
  ]);

  await assert.rejects(
    () =>
      createDocument(
        {
          title: '失败示例',
          config: {
            clientId: 'sensitive-client-id',
            accessToken: 'sensitive-access-token',
            openId: 'sensitive-open-id',
          },
        },
        { fetchImpl }
      ),
    (error) => {
      const serializedError = JSON.stringify(error);
      const text = String(error);

      assert.match(text, /腾讯文档接口调用失败/);
      assert.doesNotMatch(serializedError, /sensitive-client-id/);
      assert.doesNotMatch(serializedError, /sensitive-access-token/);
      assert.doesNotMatch(serializedError, /sensitive-open-id/);
      assert.doesNotMatch(serializedError, /Access-Token|Client-Id|Open-Id/);
      return true;
    }
  );
});
