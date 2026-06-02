import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

import optionsStorage, { ExportType, TencentDocsOptions } from '@/options-storage';
import '@/styles/global.css';

type TencentDocsField = {
  key: keyof TencentDocsOptions;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  description: string;
};

type StatusMessage = {
  type: 'success' | 'error';
  text: string;
};

const emptyTencentDocsOptions: TencentDocsOptions = {
  tencentDocsClientId: '',
  tencentDocsAccessToken: '',
  tencentDocsOpenId: '',
};

const tencentDocsFields: TencentDocsField[] = [
  {
    key: 'tencentDocsClientId',
    label: 'Client ID',
    type: 'text',
    placeholder: '待用户填写',
    description: '官方 Header：Client-Id，创建和写入接口必填。',
  },
  {
    key: 'tencentDocsOpenId',
    label: 'Open ID',
    type: 'text',
    placeholder: '待用户填写',
    description: '官方 Header：Open-Id，创建和写入接口必填。',
  },
  {
    key: 'tencentDocsAccessToken',
    label: 'Access Token',
    type: 'password',
    placeholder: '待用户填写',
    description: '官方 Header：Access-Token，创建和写入接口必填。',
  },
];

function getTencentDocsStorageError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function OptionsPage() {
  const [exportType, setExportType] = useState<ExportType>('markdown');
  const [tencentDocsOptions, setTencentDocsOptions] =
    useState<TencentDocsOptions>(emptyTencentDocsOptions);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    optionsStorage.getAll().then((options) => {
      if (options.exportType) {
        setExportType(options.exportType as ExportType);
      }

      setTencentDocsOptions({
        tencentDocsClientId: options.tencentDocsClientId || '',
        tencentDocsAccessToken: options.tencentDocsAccessToken || '',
        tencentDocsOpenId: options.tencentDocsOpenId || '',
      });
    });
  }, []);

  const handleExportTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ExportType;
    setExportType(value);
    optionsStorage.set({ exportType: value });
  };

  const handleTencentDocsFieldChange = (key: keyof TencentDocsOptions, value: string) => {
    setTencentDocsOptions((currentOptions) => ({
      ...currentOptions,
      [key]: value,
    }));
    setStatus(null);
  };

  const saveTencentDocsOptions = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      await optionsStorage.set({ ...tencentDocsOptions });
      setStatus({ type: 'success', text: '腾讯文档配置已保存。' });
    } catch (error) {
      // 只记录异常摘要，不输出表单值、Token 或完整授权信息。
      console.error('保存腾讯文档配置失败:', getTencentDocsStorageError(error));
      setStatus({ type: 'error', text: '保存失败，请检查扩展存储权限后重试。' });
    } finally {
      setIsSaving(false);
    }
  };

  const clearTencentDocsOptions = async () => {
    setIsSaving(true);
    setStatus(null);

    try {
      await optionsStorage.set({ ...emptyTencentDocsOptions });
      setTencentDocsOptions(emptyTencentDocsOptions);
      setStatus({ type: 'success', text: '腾讯文档配置已清空。' });
    } catch (error) {
      // 只记录异常摘要，不输出表单值、Token 或完整授权信息。
      console.error('清空腾讯文档配置失败:', getTencentDocsStorageError(error));
      setStatus({ type: 'error', text: '清空失败，请检查扩展存储权限后重试。' });
    } finally {
      setIsSaving(false);
    }
  };

  const statusClassName =
    status?.type === 'error' ? 'text-sm text-red-300' : 'text-sm text-emerald-300';

  return (
    <div id="root" className="min-h-screen !bg-zinc-950 text-zinc-100">
      <div id="container" className="container mx-auto max-w-3xl p-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Chat Export Settings</h1>
          <p className="text-sm text-zinc-400">
            Configure how your chat exports will be formatted.
          </p>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="export-type">Format</label>
            <select
              id="export-type"
              value={exportType}
              onChange={handleExportTypeChange}
              className="flex h-9 w-[180px] rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="markdown">Markdown</option>
              <option value="xml">XML</option>
              <option value="json">JSON</option>
              <option value="html">HTML</option>
            </select>
            <p className="text-sm text-zinc-400">Preferred export format</p>
          </div>

          <form
            onSubmit={saveTencentDocsOptions}
            className="space-y-4 border-t border-zinc-800 pt-4"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Tencent Docs</h2>
              <p className="text-sm text-zinc-400">
                官方 OpenAPI 请求头必填 Client-Id、Open-Id 和 Access-Token。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {tencentDocsFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label htmlFor={field.key} className="text-sm font-medium text-zinc-200">
                    {field.label}
                  </label>
                  <input
                    id={field.key}
                    type={field.type}
                    value={tencentDocsOptions[field.key]}
                    onChange={(event) =>
                      handleTencentDocsFieldChange(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-zinc-500">{field.description}</p>
                </div>
              ))}
            </div>

            <div className="border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
              腾讯文档密钥会通过扩展设置保存到浏览器
              storage；本机或浏览器账号可访问环境请自行保护，不要填入共享账号或公开测试凭据。
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存配置'}
              </button>
              <button
                type="button"
                onClick={clearTencentDocsOptions}
                disabled={isSaving}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空配置
              </button>
            </div>

            {status && <p className={statusClassName}>{status.text}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
