import browser from 'webextension-polyfill';

import { exportMarkdownToTencentDocs, readTencentDocsConfig } from '@/modules/tencent-docs';
import { handleTencentDocsExportMessage } from '@/modules/tencent-docs/export-message-handler';

browser.runtime.onMessage.addListener((message: unknown) =>
  handleTencentDocsExportMessage(message, {
    exportMarkdown: exportMarkdownToTencentDocs,
    readConfig: readTencentDocsConfig,
  })
);
