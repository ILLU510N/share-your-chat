import OptionsSync from 'webext-options-sync';
import browser from 'webextension-polyfill';

export type ExportType = 'markdown' | 'xml' | 'json' | 'html';

export interface TencentDocsOptions {
  tencentDocsClientId: string;
  tencentDocsAccessToken: string;
  tencentDocsOpenId: string;
}

export interface Options extends TencentDocsOptions {
  exportType: ExportType;
  [key: string]: string;
}

export const defaultOptions: Options = {
  exportType: 'markdown',
  tencentDocsClientId: '',
  tencentDocsAccessToken: '',
  tencentDocsOpenId: '',
};

// Create a wrapper that handles cases where storage API is not available
class SafeOptionsStorage {
  private optionsSync: OptionsSync<Options> | null = null;
  private initialized = false;

  private ensureInitialized(): OptionsSync<Options> | null {
    if (this.initialized) {
      return this.optionsSync;
    }

    this.initialized = true;

    try {
      // Check if browser.storage is available
      if (!browser?.storage?.sync) {
        console.warn('browser.storage.sync is not available, using defaults');
        return null;
      }

      this.optionsSync = new OptionsSync<Options>({
        defaults: defaultOptions,
        migrations: [OptionsSync.migrations.removeUnused],
        // 腾讯文档配置可能包含密钥，禁止 options-sync 在控制台输出配置内容。
        logging: false,
      });

      return this.optionsSync;
    } catch (error) {
      console.warn('Failed to initialize OptionsSync:', error);
      return null;
    }
  }

  async getAll(): Promise<Options> {
    const sync = this.ensureInitialized();
    if (!sync) {
      return { ...defaultOptions };
    }

    try {
      return await sync.getAll();
    } catch (error) {
      console.warn('Failed to get options, using defaults:', error);
      return { ...defaultOptions };
    }
  }

  async set(options: Partial<Options>): Promise<void> {
    const sync = this.ensureInitialized();
    if (!sync) {
      console.warn('Cannot save options: storage not available');
      return;
    }

    try {
      await sync.set(options);
    } catch (error) {
      console.error('Failed to save options:', error);
      throw error;
    }
  }
}

const optionsStorage = new SafeOptionsStorage();

export default optionsStorage;
