import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createExportMenuOptions } from './export-menu-options.ts';

test('createExportMenuOptions 在原有导出入口后追加腾讯文档导出入口', () => {
  const noop = async () => {};
  const options = createExportMenuOptions({
    copyToClipboard: noop,
    exportToTencentDocs: noop,
    saveToFile: noop,
  });

  assert.deepEqual(
    options.map((option) => option.text),
    ['Copy to Clipboard', 'Save to File', 'Export to Tencent Docs']
  );
});
