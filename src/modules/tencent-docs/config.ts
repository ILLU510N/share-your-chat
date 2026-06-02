import optionsStorage from '@/options-storage';

import { TencentDocsConfig, getTencentDocsConfigFromOptions } from './tencent-docs-client';

export async function readTencentDocsConfig(): Promise<TencentDocsConfig> {
  const options = await optionsStorage.getAll();

  return getTencentDocsConfigFromOptions(options);
}
