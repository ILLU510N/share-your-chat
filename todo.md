# 腾讯文档导出改造计划

建议优先级：P0 为 MVP 必需，P1 为体验和安全完善，P2 为后续增强。

## 阶段 0：仓库理解与基线确认（P0）

- [x] 阅读 `readme.md`，记录原项目能力、限制和本地运行方式。
- [x] 理解 `src/manifest.json` 中的权限、content script、popup、options 配置。
- [x] 理解 `src/pages/popup*` 的弹窗职责和消息触发方式。
- [x] 理解 `src/content.ts` 的 content script 职责、按钮注入和消息监听。
- [x] 确认当前是否存在 background script；若不存在，记录不新增的理由或新增条件。
- [x] 找到 AI 对话提取逻辑：`src/modules/chatgpt/`、`src/modules/claude/`、`src/modules/gemini/`。
- [x] 找到统一聚合入口：`src/modules/chat-content.ts`。
- [x] 找到 Markdown 导出逻辑：`src/modules/content-handlers.ts` 的 `formatContent()`。
- [x] 确认项目构建、运行、调试方式：`npm run watch`、`npm run build`、`npm run check`、`npm run e2e`。
- [x] 记录当前基线行为：原有 Markdown、HTML、JSON、XML 导出均不应被破坏。

## 阶段 1：抽离统一 Markdown 导出能力（P0）

- [x] 设计 `exportCurrentConversationAsMarkdown()` 的返回结构。
- [x] 返回 `title`、`sourceUrl`、`platform`、`markdown`、`messageCount`、`failedMessages`。
- [x] 复用现有 `getChatContent()`、平台解析模块和 `formatContent(..., 'markdown')`。
- [x] 保持原有导出按钮和本地导出格式可用。
- [x] 为 ChatGPT 验证基础 Markdown 导出。
- [x] 为 Claude 验证基础 Markdown 导出。
- [x] 为 Gemini 验证基础 Markdown 导出。
- [x] 记录无法从 DOM 获取的附件、图片或特殊块限制。

## 阶段 2：新增或扩展插件设置页（P0）

- [x] 复用现有 `src/pages/options*` 页面，避免另建重复设置系统。
- [x] 新增腾讯文档配置表单：Client ID、Open ID、Access Token、Client Secret、API Key 等字段。
- [x] 根据官方请求头文档标记 Client ID、Open ID、Access Token 为创建和写入接口必填字段。
- [x] 使用 `chrome.storage` 或现有 `webext-options-sync` 封装保存用户配置。
- [x] 在 UI 中明确标注本地保存密钥的安全风险。
- [x] 禁止在源码中写死任何真实密钥、Token 或授权信息。
- [x] 增加保存成功、保存失败和清空配置的基本状态。

## 阶段 3：新增腾讯文档服务模块（P0）

- [x] 新建 `src/modules/tencent-docs/` 或同层级服务模块，命名如 `tencentDocsClient`。
- [x] 封装认证信息读取逻辑，不让 UI 直接拼接 OpenAPI 请求。
- [x] 定义 `createDocument()` 高层函数，并按官方文档实现 `POST /openapi/drive/v2/files`。
- [x] 定义 `writeMarkdownContent()` 高层函数，并按官方文档实现 `POST /openapi/doc/v3/{fileId}:batchUpdate`。
- [x] 定义 `exportMarkdownToTencentDocs()`，返回文档链接和必要元数据。
- [x] 官方 OpenAPI 文档已确认，阶段 3 跳过 mock 占位并直接实现真实请求边界。
- [x] 使用真实请求替代“待查官方文档”占位参数，不编造接口字段。
- [x] 确保错误对象不包含敏感 Token 或完整请求头。

## 阶段 4：打通导出到腾讯文档流程（P0）

- [x] 在页面内 export 按钮下拉菜单增加“Export to Tencent Docs”选项。
- [x] 点击后强制请求当前会话的 Markdown 数据。
- [x] 将 Markdown 内容交给 `tencentDocsClient` 高层函数。
- [x] 成功后在页面提示中展示腾讯文档链接。
- [x] 支持复制链接到剪贴板。
- [x] 失败时展示明确错误信息，不吞掉异常。
- [x] 保持原有导出入口和格式选择不被移除。

## 阶段 5：错误处理与用户体验（P1）

- [ ] 未配置腾讯文档参数时提示用户进入设置页。
- [ ] 当前页面不支持导出时给出明确提示。
- [ ] content script 未响应时提示用户刷新页面或检查扩展权限。
- [ ] 腾讯文档接口失败时展示可理解的错误摘要。
- [ ] 长对话导出时显示处理中状态。
- [ ] 导出过程中禁用按钮，防止重复点击。
- [ ] 对空会话、解析失败消息数大于 0 的情况给出提示。

## 阶段 6：安全与权限收敛（P1）

- [ ] 审查 `src/manifest.json` 的 `permissions` 和 `host_permissions`。
- [ ] 只保留 ChatGPT、Claude、Gemini 和腾讯文档 OpenAPI 所需权限。
- [ ] 腾讯文档接口域名标记为“待查官方文档”。
- [ ] 不申请 `<all_urls>` 等过宽权限，除非先说明必要性。
- [ ] 不打印敏感 Token、Client Secret、Cookie、Authorization header。
- [ ] 不把用户对话发送到除腾讯文档以外的任何服务。
- [ ] 检查构建产物和测试 fixture 中没有真实密钥。

## 阶段 7：验收测试（P0/P1）

- [ ] ChatGPT 单轮对话导出为 Markdown。
- [ ] ChatGPT 多轮对话导出为 Markdown。
- [ ] 含代码块对话导出，确认 fenced code block 保留。
- [ ] 含表格对话导出，确认 Markdown 结构可读。
- [ ] Claude 对话导出。
- [ ] Gemini 对话导出。
- [ ] 未配置腾讯文档参数时显示错误提示。
- [ ] 腾讯文档 mock 创建成功流程返回链接。
- [ ] 腾讯文档 mock 创建失败流程展示错误。
- [ ] 运行 `npm run check`。
- [ ] 运行 `npm run build`。
- [ ] 根据 UI 改动范围决定是否运行 `npm run e2e`。

## 暂不处理事项

- [ ] 不做自建后端服务。
- [ ] 不做多人协作权限管理。
- [ ] 不做 Chrome Web Store 发布适配。
- [ ] 不做复杂 DOCX 导出。
- [ ] 不做图片附件完整迁移。
- [ ] 不做跨账号 OAuth 托管服务。
